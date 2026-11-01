import Foundation

// MARK: - Basic enums

public enum DamageType: String, Codable, Sendable, CaseIterable {
    case physical
    case magic
    case mixed
    case trueDamage = "true"

    public var displayName: String {
        switch self {
        case .physical: return "Physical"
        case .magic: return "Magic"
        case .mixed: return "Mixed"
        case .trueDamage: return "True"
        }
    }
}

public enum DamageProfile: String, Codable, Sendable, CaseIterable {
    case burst
    case sustained
    case mixed

    public var hebrew: String {
        switch self {
        case .burst: return "בורסט"
        case .sustained: return "מתמשך"
        case .mixed: return "מעורב"
        }
    }
}

public enum Lane: String, Codable, Sendable, CaseIterable, Identifiable {
    case gold, exp, mid, jungle, roam
    public var id: String { rawValue }
    public var displayName: String {
        switch self {
        case .gold: return "Gold Lane"
        case .exp: return "EXP Lane"
        case .mid: return "Mid Lane"
        case .jungle: return "Jungle"
        case .roam: return "Roam"
        }
    }
}

public enum TeamSide: String, Codable, Sendable, CaseIterable, Hashable {
    case ally, enemy
}

/// The kind of build a hero follows. Determines which items are usable and how much defence is reasonable.
public enum Archetype: String, Codable, Sendable, CaseIterable {
    case marksman
    case assassinPhysical = "assassin_phys"
    case assassinMagic = "assassin_magic"
    case mage
    case fighterPhysical = "fighter_phys"
    case fighterMagic = "fighter_magic"
    case tank
    case support

    public var displayName: String {
        switch self {
        case .marksman: return "Marksman"
        case .assassinPhysical: return "Assassin (Physical)"
        case .assassinMagic: return "Assassin (Magic)"
        case .mage: return "Mage"
        case .fighterPhysical: return "Fighter (Physical)"
        case .fighterMagic: return "Fighter (Magic)"
        case .tank: return "Tank"
        case .support: return "Support"
        }
    }

    /// How much the hero benefits from defensive answers (squishy carries need them, but also lose damage).
    public var survivalNeed: Double {
        switch self {
        case .tank: return 1.0
        case .support: return 0.85
        case .marksman, .mage: return 0.8
        case .assassinPhysical, .assassinMagic: return 0.7
        case .fighterPhysical, .fighterMagic: return 0.75
        }
    }

    /// How much the hero should prioritise offensive answers (anti-heal, penetration).
    public var offenseCounterNeed: Double {
        switch self {
        case .tank: return 0.5
        case .support: return 0.4
        default: return 1.0
        }
    }

    /// Maximum number of pure defence items before the build stops doing its job.
    public var maxDefensiveItems: Int {
        switch self {
        case .tank, .support: return 6
        case .fighterPhysical, .fighterMagic: return 3
        default: return 2
        }
    }

    public var isMagic: Bool { self == .mage || self == .assassinMagic || self == .fighterMagic }
}

// MARK: - Threat dimensions

/// The axes along which an enemy team is analysed and items are rated.
public enum ThreatDimension: String, Codable, Sendable, CaseIterable, Hashable {
    case physical, magic, burst, sustained, cc, healing, shields, basicAttack, dive, tanky

    public var hebrew: String {
        switch self {
        case .physical: return "נזק פיזי"
        case .magic: return "נזק קסם"
        case .burst: return "נזק בורסט"
        case .sustained: return "נזק מתמשך"
        case .cc: return "שליטה (CC)"
        case .healing: return "ריפוי והחלמה"
        case .shields: return "מגנים"
        case .basicAttack: return "התקפות בסיס"
        case .dive: return "צלילה של מתנקשים"
        case .tanky: return "הגנה ו-HP גבוהים"
        }
    }

    /// Dimensions answered by surviving (defence items).
    public static let survival: [ThreatDimension] = [.physical, .magic, .burst, .sustained, .cc, .basicAttack, .dive]
    /// Dimensions answered by dealing damage differently (anti-heal, penetration).
    public static let offensive: [ThreatDimension] = [.healing, .shields, .tanky]
}

// MARK: - Hero

public struct Hero: Codable, Sendable, Hashable, Identifiable {
    public var id: String { name }
    public let name: String
    public let roles: [String]
    public let lanes: [Lane]
    public let damageType: DamageType
    public let damageProfile: DamageProfile
    /// 0...3 qualitative scales.
    public let cc: Int
    public let healing: Int
    public let shields: Int
    public let mobility: Int
    public let tankiness: Int
    public let basicAttacker: Bool
    /// lane rawValue (or "*") -> build template id.
    public let builds: [String: String]
    public let strongAgainst: [String]
    public let weakAgainst: [String]
    public let synergy: [String]
    /// "curated" = reviewed kit profile, "role-default" = derived from role only.
    public let profileSource: String

    public var primaryRole: String { roles.first ?? "Unknown" }
    public var isCuratedProfile: Bool { profileSource == "curated" }

    public var archetype: Archetype {
        let magic = damageType == .magic
        switch primaryRole {
        case "Marksman": return magic ? .mage : .marksman
        case "Assassin": return magic ? .assassinMagic : .assassinPhysical
        case "Mage": return .mage
        case "Fighter": return magic ? .fighterMagic : .fighterPhysical
        case "Tank": return .tank
        case "Support": return .support
        default: return magic ? .mage : .fighterPhysical
        }
    }
}

// MARK: - Item

public enum ItemCategory: String, Codable, Sendable, CaseIterable {
    case boots, physical, magic, defense, support
}

public struct Item: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    public let category: ItemCategory
    /// Archetypes that can use the item. Empty = everyone.
    public let usableBy: [Archetype]
    public let tags: [String]
    /// ThreatDimension rawValue -> 0...1 strength of the answer.
    public let counters: [String: Double]
    public let effect: String
    public let tradeoff: String

    public func weight(_ d: ThreatDimension) -> Double { counters[d.rawValue] ?? 0 }
    public func isUsable(by a: Archetype) -> Bool { usableBy.isEmpty || usableBy.contains(a) }
    public func has(tag: String) -> Bool { tags.contains(tag) }
    public var isDefensive: Bool { category == .defense }
    public var counterStrength: Double { counters.values.reduce(0, +) }
}

public struct BuildTemplate: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let items: [String]
    public let emblem: String
    public let spell: String
    public let note: String
}

// MARK: - Screen / recognition

public enum GameScreen: String, Codable, Sendable, CaseIterable, Hashable {
    case unknown, draft, inGame, scoreboard, results

    public var displayName: String {
        switch self {
        case .unknown: return "Unknown"
        case .draft: return "Draft"
        case .inGame: return "In Game"
        case .scoreboard: return "Scoreboard"
        case .results: return "Results"
        }
    }
}

/// Where a hero slot was observed. Draft order and scoreboard order are not the same, so they are tracked apart.
public enum SlotSource: String, Codable, Sendable, Hashable {
    case draft, scoreboard
}

/// Result of recognising one icon crop.
public enum Recognition: Equatable, Sendable {
    /// Confident match.
    case match(label: String, confidence: Double)
    /// Something is there but the matcher is not sure. `bestGuess` is only for diagnostics, never shown as fact.
    case uncertain(bestGuess: String?, confidence: Double)
    /// The slot is empty (no item).
    case empty
}
