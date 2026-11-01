import AppKit
import Foundation
import MLBBCore

enum TemplateKind: String, CaseIterable, Identifiable {
    case hero = "heroes"
    case item = "items"

    var id: String { rawValue }
    var title: String { self == .hero ? "Heroes" : "Items" }
}

struct TemplateSample: Identifiable {
    var id: URL { url }
    let label: String
    let kind: TemplateKind
    let url: URL
    let descriptor: IconDescriptor
    let image: CGImage
}

/// Reference icons used for recognition (and as pictures in the UI).
/// Stored as PNG files: <root>/<heroes|items>/<Label>/<uuid>.png — easy to inspect, back up or share.
@MainActor
final class TemplateLibrary: ObservableObject {
    @Published private(set) var samples: [TemplateKind: [TemplateSample]] = [:]
    @Published private(set) var revision = 0
    let root: URL

    private var thumbnails: [String: NSImage] = [:]
    private nonisolated let store = MatcherStore()

    init(root: URL) {
        self.root = root
        for k in TemplateKind.allCases {
            try? FileManager.default.createDirectory(at: root.appendingPathComponent(k.rawValue), withIntermediateDirectories: true)
        }
        reload()
    }

    func count(_ kind: TemplateKind) -> Int { samples[kind]?.count ?? 0 }
    func labels(_ kind: TemplateKind) -> [String] { Array(Set((samples[kind] ?? []).map(\.label))).sorted() }

    func reload() {
        var all: [TemplateKind: [TemplateSample]] = [:]
        let fm = FileManager.default
        for kind in TemplateKind.allCases {
            let dir = root.appendingPathComponent(kind.rawValue)
            var list: [TemplateSample] = []
            let labelDirs = (try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.isDirectoryKey])) ?? []
            for labelDir in labelDirs where labelDir.hasDirectoryPath {
                let label = labelDir.lastPathComponent
                let files = (try? fm.contentsOfDirectory(at: labelDir, includingPropertiesForKeys: nil)) ?? []
                for f in files where ["png", "jpg", "jpeg"].contains(f.pathExtension.lowercased()) {
                    guard let img = ImageTools.load(f) else { continue }
                    list.append(TemplateSample(label: label, kind: kind, url: f, descriptor: ImageTools.descriptor(img), image: img))
                }
            }
            all[kind] = list.sorted { $0.label < $1.label }
        }
        samples = all
        thumbnails.removeAll()
        rebuildMatchers()
        revision += 1
    }

    private func rebuildMatchers() {
        let heroes = IconMatcher(entries: (samples[.hero] ?? []).map { .init(label: $0.label, descriptor: $0.descriptor) })
        let items = IconMatcher(entries: (samples[.item] ?? []).map { .init(label: $0.label, descriptor: $0.descriptor) })
        store.set(hero: heroes, item: items)
    }

    /// Thread-safe copies for the analysis queue.
    nonisolated func matchers() -> (hero: IconMatcher, item: IconMatcher) { store.get() }

    @discardableResult
    func add(_ image: CGImage, label: String, kind: TemplateKind) throws -> URL {
        let safe = label.replacingOccurrences(of: "/", with: "-")
        let dir = root.appendingPathComponent(kind.rawValue).appendingPathComponent(safe, isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent(UUID().uuidString).appendingPathExtension("png")
        try ImageTools.savePNG(image, to: url)
        reload()
        return url
    }

    func delete(_ sample: TemplateSample) {
        try? FileManager.default.removeItem(at: sample.url)
        let dir = sample.url.deletingLastPathComponent()
        if let rest = try? FileManager.default.contentsOfDirectory(atPath: dir.path), rest.isEmpty {
            try? FileManager.default.removeItem(at: dir)
        }
        reload()
    }

    /// Imports a folder of images named after heroes/items ("Selena.png", "Athena's Shield.png"),
    /// or sub-folders named after them. Names are matched against the database; unmatched files are reported.
    func importFolder(_ folder: URL, kind: TemplateKind, database: GameDatabase) -> (imported: Int, skipped: [String]) {
        let fm = FileManager.default
        var imported = 0
        var skipped: [String] = []
        guard let walker = fm.enumerator(at: folder, includingPropertiesForKeys: nil) else { return (0, []) }
        for case let url as URL in walker where ["png", "jpg", "jpeg", "webp"].contains(url.pathExtension.lowercased()) {
            let fileName = url.deletingPathExtension().lastPathComponent
            let parent = url.deletingLastPathComponent().lastPathComponent
            let label: String?
            switch kind {
            case .hero: label = database.hero(named: fileName)?.name ?? database.hero(named: parent)?.name
            case .item: label = database.item(named: fileName)?.name ?? database.item(named: parent)?.name
            }
            guard let label, let img = ImageTools.load(url) else {
                skipped.append(url.lastPathComponent)
                continue
            }
            let dir = root.appendingPathComponent(kind.rawValue).appendingPathComponent(label, isDirectory: true)
            try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
            if (try? ImageTools.savePNG(img, to: dir.appendingPathComponent(UUID().uuidString + ".png"))) != nil { imported += 1 }
        }
        reload()
        return (imported, skipped)
    }

    func thumbnail(_ label: String?, kind: TemplateKind) -> NSImage? {
        guard let label else { return nil }
        let key = kind.rawValue + "/" + label
        if let t = thumbnails[key] { return t }
        guard let s = samples[kind]?.first(where: { $0.label == label }) else { return nil }
        let img = ImageTools.nsImage(s.image)
        thumbnails[key] = img
        return img
    }
}

/// Lock-protected matcher snapshot shared with the analysis queue.
final class MatcherStore: @unchecked Sendable {
    private let lock = NSLock()
    private var hero = IconMatcher()
    private var item = IconMatcher()

    func set(hero: IconMatcher, item: IconMatcher) {
        lock.lock()
        self.hero = hero
        self.item = item
        lock.unlock()
    }

    func get() -> (hero: IconMatcher, item: IconMatcher) {
        lock.lock()
        defer { lock.unlock() }
        return (hero, item)
    }
}
