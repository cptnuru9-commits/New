import AVFoundation
import CoreMediaIO
import Foundation

/// Detects an iPad / iPhone connected by USB as a screen-capture device (the same device QuickTime uses).
/// Read-only: it never opens the device, it only checks that it is present.
@MainActor
final class IOSDeviceMonitor: ObservableObject {
    @Published private(set) var deviceNames: [String] = []
    @Published private(set) var lastCheck: Date?
    private var timer: Timer?
    private var observers: [NSObjectProtocol] = []

    var isConnected: Bool { !deviceNames.isEmpty }

    func start() {
        Self.allowScreenCaptureDevices()
        refresh()
        let center = NotificationCenter.default
        for name in ["AVCaptureDeviceWasConnectedNotification", "AVCaptureDeviceWasDisconnectedNotification"] {
            observers.append(center.addObserver(forName: Notification.Name(name), object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in self?.refresh() }
            })
        }
        // iOS devices can take a few seconds to appear after enabling CoreMediaIO screen devices.
        timer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.refresh() }
        }
    }

    func refresh() {
        let session = AVCaptureDevice.DiscoverySession(deviceTypes: [.external], mediaType: nil, position: .unspecified)
        deviceNames = session.devices
            .filter { $0.modelID == "iOS Device" || $0.localizedName.localizedCaseInsensitiveContains("iPad") || $0.localizedName.localizedCaseInsensitiveContains("iPhone") }
            .map(\.localizedName)
        lastCheck = Date()
    }

    /// Opt-in that makes USB-connected iOS screens visible as capture devices (documented CoreMediaIO property).
    private static func allowScreenCaptureDevices() {
        var address = CMIOObjectPropertyAddress(
            mSelector: CMIOObjectPropertySelector(kCMIOHardwarePropertyAllowScreenCaptureDevices),
            mScope: CMIOObjectPropertyScope(kCMIOObjectPropertyScopeGlobal),
            mElement: CMIOObjectPropertyElement(kCMIOObjectPropertyElementMain))
        var allow: UInt32 = 1
        _ = CMIOObjectSetPropertyData(CMIOObjectID(kCMIOObjectSystemObject), &address, 0, nil,
                                      UInt32(MemoryLayout<UInt32>.size), &allow)
    }
}
