// swift-tools-version:5.9
// MLBB Live Companion — macOS app (SwiftUI + ScreenCaptureKit + Vision).
// Build the app bundle with ./scripts/build_app.sh, or open this file in Xcode.
import PackageDescription

let package = Package(
    name: "MLBBLiveCompanion",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "MLBBLiveCompanion", targets: ["MLBBLiveCompanion"]),
        .library(name: "MLBBCore", targets: ["MLBBCore"]),
    ],
    targets: [
        // Pure Swift logic: database, icon matching, tracking, recommendation engine. No Apple UI frameworks.
        .target(name: "MLBBCore", path: "Sources/MLBBCore"),
        // macOS app: capture, Vision OCR, SwiftUI dashboard.
        .executableTarget(
            name: "MLBBLiveCompanion",
            dependencies: ["MLBBCore"],
            path: "Sources/MLBBLiveCompanion"
        ),
        .testTarget(
            name: "MLBBCoreTests",
            dependencies: ["MLBBCore"],
            path: "Tests/MLBBCoreTests"
        ),
    ]
)
