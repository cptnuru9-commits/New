import CoreGraphics
import Foundation
import MLBBCore

/// Receives frames from the capture queue, throttles the preview, skips unchanged frames
/// and runs analysis on a background queue — never more than one analysis at a time.
final class FramePipeline: @unchecked Sendable {
    enum Result {
        case analysed(FrameAnalysis)
        /// Frame identical to the previous one: the previous observation is re-used (cheap).
        case duplicate(Date)
    }

    private let lock = NSLock()
    private var config = AnalysisConfig()
    private var busy = false
    private var lastAnalysis = Date.distantPast
    private var lastPreview = Date.distantPast
    private var lastFingerprint: FrameFingerprint?
    private var analysedCount = 0
    private let queue = DispatchQueue(label: "mlbb.analysis", qos: .userInitiated)

    var previewInterval: TimeInterval = 1.0 / 12
    var onPreview: (@MainActor (CGImage) -> Void)?
    var onResult: (@MainActor (Result) -> Void)?

    func update(_ c: AnalysisConfig) {
        lock.lock()
        config = c
        lock.unlock()
    }

    /// Forget the last fingerprint so the next frame is analysed even if unchanged (e.g. after recalibration).
    func invalidate() {
        lock.lock()
        lastFingerprint = nil
        lock.unlock()
    }

    func submit(_ image: CGImage, at time: Date) {
        lock.lock()
        let wantPreview = time.timeIntervalSince(lastPreview) >= previewInterval
        if wantPreview { lastPreview = time }
        let cfg = config
        let wantAnalysis = !busy && time.timeIntervalSince(lastAnalysis) >= cfg.interval
        if wantAnalysis {
            busy = true
            lastAnalysis = time
            analysedCount += 1
        }
        let runOCR = analysedCount % max(1, cfg.ocrEvery) == 1 || cfg.ocrEvery <= 1
        lock.unlock()

        if wantPreview, let onPreview {
            Task { @MainActor in onPreview(image) }
        }
        guard wantAnalysis else { return }

        queue.async { [weak self] in
            guard let self else { return }
            let fp = ImageTools.fingerprint(image)
            self.lock.lock()
            let previous = self.lastFingerprint
            self.lock.unlock()
            let result: Result
            if let previous, fp.difference(to: previous) < cfg.duplicateThreshold {
                result = .duplicate(time)
            } else {
                result = .analysed(FrameAnalyzer.analyze(image, at: time, config: cfg, runOCR: runOCR))
                self.lock.lock()
                self.lastFingerprint = fp
                self.lock.unlock()
            }
            self.lock.lock()
            self.busy = false
            self.lock.unlock()
            if let onResult = self.onResult {
                Task { @MainActor in onResult(result) }
            }
        }
    }
}
