import Foundation
import MLBBCore

/// All user data lives in ~/Library/Application Support/MLBBLiveCompanion (local only).
enum AppPaths {
    static let support: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let url = base.appendingPathComponent("MLBBLiveCompanion", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }()

    static var templates: URL { support.appendingPathComponent("Templates", isDirectory: true) }
    static var anchors: URL {
        let u = support.appendingPathComponent("Anchors", isDirectory: true)
        try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }
    static var layoutFile: URL { support.appendingPathComponent("layout.json") }
    /// Editable copy of the database. When present it overrides the bundled one.
    static var userDatabase: URL { support.appendingPathComponent("Database", isDirectory: true) }

    /// Bundled read-only database: inside the .app, or the source tree when run with `swift run` / Xcode.
    static var bundledDatabase: URL? {
        var candidates: [URL] = []
        if let res = Bundle.main.resourceURL { candidates.append(res.appendingPathComponent("Data", isDirectory: true)) }
        let sourceRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()   // Storage
            .deletingLastPathComponent()   // MLBBLiveCompanion
            .deletingLastPathComponent()   // Sources
            .deletingLastPathComponent()   // package root
        candidates.append(sourceRoot.appendingPathComponent("Resources/Data", isDirectory: true))
        return candidates.first { FileManager.default.fileExists(atPath: $0.appendingPathComponent("heroes.json").path) }
    }

    static var activeDatabase: URL? {
        if FileManager.default.fileExists(atPath: userDatabase.appendingPathComponent("heroes.json").path) { return userDatabase }
        return bundledDatabase
    }

    /// Copies the bundled database to the editable location (does not overwrite existing files).
    static func makeEditableDatabaseCopy() throws -> URL {
        guard let src = bundledDatabase else { throw CocoaError(.fileNoSuchFile) }
        let fm = FileManager.default
        try fm.createDirectory(at: userDatabase, withIntermediateDirectories: true)
        for name in ["heroes.json", "items.json", "builds.json"] {
            let dst = userDatabase.appendingPathComponent(name)
            if !fm.fileExists(atPath: dst.path) { try fm.copyItem(at: src.appendingPathComponent(name), to: dst) }
        }
        return userDatabase
    }

    static func loadLayout() -> LayoutProfile {
        guard let data = try? Data(contentsOf: layoutFile),
              let layout = try? JSONDecoder().decode(LayoutProfile.self, from: data) else { return .empty }
        return layout
    }

    static func saveLayout(_ layout: LayoutProfile) {
        let enc = JSONEncoder()
        enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        if let data = try? enc.encode(layout) { try? data.write(to: layoutFile, options: .atomic) }
    }

    static func anchorImageURL(_ id: UUID) -> URL { anchors.appendingPathComponent(id.uuidString + ".png") }
}
