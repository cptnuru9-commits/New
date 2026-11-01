import AppKit
import CoreImage
import CoreMedia
import ScreenCaptureKit

/// A capturable window as shown in the picker.
struct CaptureWindowInfo: Identifiable, Hashable {
    let id: CGWindowID
    let appName: String
    let bundleID: String
    let title: String
    let width: Int
    let height: Int

    var isQuickTime: Bool { bundleID == "com.apple.QuickTimePlayerX" || appName.localizedCaseInsensitiveContains("QuickTime") }
    var displayTitle: String { title.isEmpty ? appName : "\(appName) — \(title)" }
}

/// Wraps ScreenCaptureKit: lists windows and streams frames of one window.
/// Frames are delivered on a private queue; nothing is written to disk.
final class CaptureService: NSObject, SCStreamOutput, SCStreamDelegate {
    private var activeStream: SCStream?
    private let frameQueue = DispatchQueue(label: "mlbb.capture.frames", qos: .userInitiated)
    private let ciContext = CIContext(options: [.cacheIntermediates: false])

    /// Called on the capture queue for every complete frame.
    var onFrame: ((CGImage, Date) -> Void)?
    /// Called on the main actor when the stream stops by itself (window closed, permission revoked...).
    var onStop: (@MainActor (String) -> Void)?

    static var hasPermission: Bool { CGPreflightScreenCaptureAccess() }

    @discardableResult
    static func requestPermission() -> Bool { CGRequestScreenCaptureAccess() }

    static func openPrivacySettings() {
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture") {
            NSWorkspace.shared.open(url)
        }
    }

    /// On-screen application windows, QuickTime first.
    static func availableWindows() async throws -> [(CaptureWindowInfo, SCWindow)] {
        let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
        let ownPID = ProcessInfo.processInfo.processIdentifier
        let list: [(CaptureWindowInfo, SCWindow)] = content.windows.compactMap { w in
            guard w.windowLayer == 0, w.frame.width >= 200, w.frame.height >= 150,
                  let app = w.owningApplication, app.processID != ownPID else { return nil }
            let info = CaptureWindowInfo(id: w.windowID, appName: app.applicationName, bundleID: app.bundleIdentifier,
                                         title: w.title ?? "", width: Int(w.frame.width), height: Int(w.frame.height))
            return (info, w)
        }
        return list.sorted { a, b in
            if a.0.isQuickTime != b.0.isQuickTime { return a.0.isQuickTime }
            return a.0.displayTitle < b.0.displayTitle
        }
    }

    func start(window: SCWindow, framesPerSecond: Int) async throws {
        await stop()
        let filter = SCContentFilter(desktopIndependentWindow: window)
        let config = SCStreamConfiguration()
        // Capture at up to 2x the window size, capped for performance on a MacBook Air.
        let scale = min(2.0, 2200.0 / max(1, Double(window.frame.width)))
        config.width = max(320, Int(Double(window.frame.width) * scale))
        config.height = max(240, Int(Double(window.frame.height) * scale))
        config.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale(max(1, min(30, framesPerSecond))))
        config.pixelFormat = kCVPixelFormatType_32BGRA
        config.showsCursor = false
        config.queueDepth = 4
        let stream = SCStream(filter: filter, configuration: config, delegate: self)
        try stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: frameQueue)
        try await stream.startCapture()
        activeStream = stream
    }

    func stop() async {
        guard let current = activeStream else { return }
        activeStream = nil
        try? await current.stopCapture()
    }

    var isRunning: Bool { activeStream != nil }

    // MARK: SCStreamOutput

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen, sampleBuffer.isValid else { return }
        // Only complete frames carry new pixels (idle/blank frames are skipped).
        guard let attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
              let info = attachments.first,
              let rawStatus = info[SCStreamFrameInfo.status] as? Int,
              let status = SCFrameStatus(rawValue: rawStatus), status == .complete,
              let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let ci = CIImage(cvPixelBuffer: pixelBuffer)
        guard let cg = ciContext.createCGImage(ci, from: ci.extent) else { return }
        onFrame?(cg, Date())
    }

    // MARK: SCStreamDelegate

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        activeStream = nil
        let message = error.localizedDescription
        if let onStop {
            Task { @MainActor in onStop(message) }
        }
    }
}
