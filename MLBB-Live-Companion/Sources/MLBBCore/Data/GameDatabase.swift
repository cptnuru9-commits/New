import Foundation

public struct HeroFile: Codable, Sendable {
    public let schemaVersion: Int
    public let lastReviewed: String
    public let dataNote: String
    public let heroes: [Hero]
}

public struct ItemFile: Codable, Sendable {
    public let schemaVersion: Int
    public let lastReviewed: String
    public let dataNote: String
    public let items: [Item]
}

public struct BuildFile: Codable, Sendable {
    public let schemaVersion: Int
    public let lastReviewed: String
    public let dataNote: String
    public let templates: [BuildTemplate]
    public let archetypeDefaults: [String: String]
}

public enum DatabaseError: Error, LocalizedError {
    case missingFile(String)
    case invalid(String, Error)

    public var errorDescription: String? {
        switch self {
        case .missingFile(let f): return "Database file not found: \(f)"
        case .invalid(let f, let e): return "Database file \(f) is invalid: \(e)"
        }
    }
}

/// Local, editable game database (heroes, items, build templates).
public struct GameDatabase: Sendable {
    public let heroes: [Hero]
    public let items: [Item]
    public let templates: [String: BuildTemplate]
    public let archetypeDefaults: [String: String]
    public let lastReviewed: String
    public let notes: [String]
    public let sourceURL: URL?

    private let heroIndex: [String: Int]
    private let itemIndex: [String: Int]

    public init(heroes: [Hero], items: [Item], templates: [BuildTemplate], archetypeDefaults: [String: String],
                lastReviewed: String = "", notes: [String] = [], sourceURL: URL? = nil) {
        self.heroes = heroes.sorted { $0.name < $1.name }
        self.items = items
        self.templates = Dictionary(templates.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        self.archetypeDefaults = archetypeDefaults
        self.lastReviewed = lastReviewed
        self.notes = notes
        self.sourceURL = sourceURL
        var hi: [String: Int] = [:]
        for (i, h) in self.heroes.enumerated() { hi[NameMatcher.normalize(h.name)] = i }
        heroIndex = hi
        var ii: [String: Int] = [:]
        for (i, it) in items.enumerated() {
            ii[NameMatcher.normalize(it.name)] = i
            ii[NameMatcher.normalize(it.id)] = i
        }
        itemIndex = ii
    }

    public static func load(from directory: URL) throws -> GameDatabase {
        func read<T: Decodable>(_ name: String, as type: T.Type) throws -> T {
            let url = directory.appendingPathComponent(name)
            guard FileManager.default.fileExists(atPath: url.path) else { throw DatabaseError.missingFile(url.path) }
            do {
                return try JSONDecoder().decode(T.self, from: Data(contentsOf: url))
            } catch {
                throw DatabaseError.invalid(name, error)
            }
        }
        let h = try read("heroes.json", as: HeroFile.self)
        let i = try read("items.json", as: ItemFile.self)
        let b = try read("builds.json", as: BuildFile.self)
        return GameDatabase(heroes: h.heroes, items: i.items, templates: b.templates,
                            archetypeDefaults: b.archetypeDefaults,
                            lastReviewed: [h.lastReviewed, i.lastReviewed, b.lastReviewed].min() ?? "",
                            notes: [h.dataNote, i.dataNote, b.dataNote], sourceURL: directory)
    }

    // MARK: Lookup

    public func hero(named name: String) -> Hero? {
        let key = NameMatcher.normalize(name)
        if let i = heroIndex[key] { return heroes[i] }
        if let best = NameMatcher.bestMatch(key, in: Array(heroIndex.keys), maxDistance: key.count > 5 ? 2 : 1),
           let i = heroIndex[best] { return heroes[i] }
        return nil
    }

    public func item(named name: String) -> Item? {
        let key = NameMatcher.normalize(name)
        if let i = itemIndex[key] { return items[i] }
        return nil
    }

    public func item(id: String) -> Item? { item(named: id) }

    public func template(for hero: Hero, lane: Lane?) -> BuildTemplate? {
        var keys: [String] = []
        if let lane { keys.append(lane.rawValue) }
        if let first = hero.lanes.first { keys.append(first.rawValue) }
        keys.append("*")
        for k in keys { if let t = hero.builds[k], let tpl = templates[t] { return tpl } }
        if let def = archetypeDefaults[hero.archetype.rawValue] { return templates[def] }
        return nil
    }

    // MARK: Validation

    /// Consistency problems in the data files (empty = OK).
    public func validate() -> [String] {
        var problems: [String] = []
        var seen = Set<String>()
        for h in heroes {
            if !seen.insert(NameMatcher.normalize(h.name)).inserted { problems.append("Duplicate hero \(h.name)") }
            for (lane, t) in h.builds where templates[t] == nil { problems.append("\(h.name): unknown template \(t) for \(lane)") }
            for v in [h.cc, h.healing, h.shields, h.mobility, h.tankiness] where !(0...3).contains(v) {
                problems.append("\(h.name): scale value \(v) outside 0...3")
            }
        }
        for t in templates.values {
            for id in t.items where item(id: id) == nil { problems.append("Template \(t.id): unknown item \(id)") }
        }
        for it in items {
            for key in it.counters.keys where ThreatDimension(rawValue: key) == nil {
                problems.append("Item \(it.id): unknown counter dimension \(key)")
            }
        }
        for (a, t) in archetypeDefaults where templates[t] == nil { problems.append("Archetype \(a): unknown template \(t)") }
        return problems
    }
}
