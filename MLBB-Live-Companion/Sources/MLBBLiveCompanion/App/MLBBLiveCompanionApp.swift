import AppKit
import SwiftUI

@main
struct MLBBLiveCompanionApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup("MLBB Live Companion") {
            RootView()
                .environmentObject(model)
                .environmentObject(model.library)
                .environmentObject(model.deviceMonitor)
                .preferredColorScheme(.dark)
                .frame(minWidth: 1180, minHeight: 740)
        }
        .defaultSize(width: 1500, height: 920)
        .commands {
            CommandGroup(after: .newItem) {
                Button("New Match") { model.newMatch() }
                    .keyboardShortcut("n", modifiers: [.command, .shift])
            }
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Needed when launched as a bare executable (swift run); harmless inside the .app bundle.
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}
