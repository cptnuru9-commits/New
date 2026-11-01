import Foundation

public struct ThreatContribution: Sendable, Equatable {
    public let hero: String
    public let value: Double
}

/// Aggregated threat of the (detected part of the) enemy team. Values are 0...1.
public struct ThreatProfile: Sendable, Equatable {
    public var values: [ThreatDimension: Double]
    public var contributions: [ThreatDimension: [ThreatContribution]]
    public var knownEnemies: Int
    public var unknownEnemies: Int
    public var enemyPhysicalDefenseItems: Int
    public var enemyMagicDefenseItems: Int

    public static let none = ThreatProfile(values: [:], contributions: [:], knownEnemies: 0, unknownEnemies: 5,
                                           enemyPhysicalDefenseItems: 0, enemyMagicDefenseItems: 0)

    public subscript(_ d: ThreatDimension) -> Double { values[d] ?? 0 }

    /// Fraction of enemy damage that is physical (0.5 when unknown).
    public var physicalShare: Double {
        let p = self[.physical], m = self[.magic]
        return p + m > 0.0001 ? p / (p + m) : 0.5
    }

    public var ranked: [(dimension: ThreatDimension, value: Double)] {
        ThreatDimension.allCases.map { (dimension: $0, value: self[$0]) }.sorted { $0.value > $1.value }
    }

    /// Heroes contributing most to the given weighted dimensions.
    public func topHeroes(for weights: [ThreatDimension: Double], limit: Int = 3) -> [String] {
        var score: [String: Double] = [:]
        for (d, w) in weights where w > 0 {
            for c in contributions[d] ?? [] { score[c.hero, default: 0] += c.value * w }
        }
        return score.filter { $0.value > 0.05 }.sorted { $0.value > $1.value }.prefix(limit).map(\.key)
    }
}

public enum ThreatAnalyzer {
    static func damageWeight(_ h: Hero) -> Double {
        switch h.primaryRole {
        case "Marksman", "Assassin", "Mage": return 1.0
        case "Fighter": return 0.85
        case "Support": return 0.45
        case "Tank": return 0.35
        default: return 0.7
        }
    }

    /// Per-hero threat vector, 0...1 per dimension.
    public static func vector(for h: Hero) -> [ThreatDimension: Double] {
        let w = damageWeight(h)
        var v: [ThreatDimension: Double] = [:]
        switch h.damageType {
        case .physical: v[.physical] = w
        case .magic: v[.magic] = w
        case .mixed, .trueDamage:
            v[.physical] = w * 0.5
            v[.magic] = w * 0.5
        }
        switch h.damageProfile {
        case .burst:
            v[.burst] = w
            v[.sustained] = w * 0.15
        case .sustained:
            v[.sustained] = w
            v[.burst] = w * 0.15
        case .mixed:
            v[.burst] = w * 0.5
            v[.sustained] = w * 0.5
        }
        v[.cc] = Double(h.cc) / 3
        v[.healing] = Double(h.healing) / 3
        v[.shields] = Double(h.shields) / 3
        v[.tanky] = Double(h.tankiness) / 3
        v[.basicAttack] = h.basicAttacker ? w : 0
        let diver = h.primaryRole == "Assassin" || h.primaryRole == "Fighter"
        v[.dive] = Double(h.mobility) / 3 * (diver ? w : 0.3)
        return v
    }

    /// Item-based adjustments: what an enemy has bought changes what they threaten.
    static func itemVector(_ item: Item) -> [ThreatDimension: Double] {
        var v: [ThreatDimension: Double] = [:]
        if item.has(tag: "lifesteal") || item.has(tag: "spellVamp") || item.has(tag: "hpRegen") { v[.healing, default: 0] += 0.25 }
        if item.has(tag: "shield") { v[.shields, default: 0] += 0.2 }
        if item.has(tag: "physicalDefense") || item.has(tag: "magicDefense") || item.has(tag: "hp") { v[.tanky, default: 0] += 0.2 }
        if item.has(tag: "critical") || item.has(tag: "attackSpeed") {
            v[.basicAttack, default: 0] += 0.25
            v[.physical, default: 0] += 0.1
        }
        if item.category == .magic { v[.magic, default: 0] += 0.1 }
        if item.category == .physical { v[.physical, default: 0] += 0.1 }
        if item.has(tag: "burst") || item.has(tag: "execute") { v[.burst, default: 0] += 0.15 }
        return v
    }

    public static func analyze(enemies: [PlayerSnapshot]) -> ThreatProfile {
        var sums: [ThreatDimension: Double] = [:]
        var contrib: [ThreatDimension: [ThreatContribution]] = [:]
        var known = 0
        var physDef = 0, magDef = 0
        for p in enemies {
            guard let h = p.hero.hero else { continue }
            known += 1
            var v = vector(for: h)
            for di in p.items {
                guard let item = di.item else { continue }
                for (d, x) in itemVector(item) { v[d, default: 0] += x }
                if item.has(tag: "physicalDefense") { physDef += 1 }
                if item.has(tag: "magicDefense") { magDef += 1 }
            }
            for (d, x) in v where x > 0 {
                sums[d, default: 0] += x
                contrib[d, default: []].append(ThreatContribution(hero: h.name, value: x))
            }
        }
        var values: [ThreatDimension: Double] = [:]
        for d in ThreatDimension.allCases { values[d] = min(1, (sums[d] ?? 0) / 5) }
        for d in contrib.keys { contrib[d]?.sort { $0.value > $1.value } }
        return ThreatProfile(values: values, contributions: contrib, knownEnemies: known,
                             unknownEnemies: max(0, enemies.count - known),
                             enemyPhysicalDefenseItems: physDef, enemyMagicDefenseItems: magDef)
    }

    /// Short Hebrew description of the main thing to respect about a hero.
    public static func mainThreat(of h: Hero) -> String {
        if h.cc >= 3 && h.tankiness >= 2 { return "פתיחת קרב ושליטה כבדה (CC)" }
        if h.healing >= 3 { return "ריפוי לקבוצה — שקלו Anti-Heal" }
        if h.shields >= 3 { return "מגנים חזקים" }
        if h.healing >= 2 { return "החלמה עצמית גבוהה — שקלו Anti-Heal" }
        let type: String
        switch h.damageType {
        case .physical: type = "פיזי"
        case .magic: type = "קסם"
        case .mixed: type = "מעורב"
        case .trueDamage: type = "אמיתי (True)"
        }
        if h.primaryRole == "Assassin" || (h.mobility >= 3 && h.damageProfile == .burst) { return "צלילה ובורסט \(type) על שבירים" }
        if h.basicAttacker && h.damageProfile != .burst { return "DPS \(type) מהתקפות בסיס" }
        if h.cc >= 3 { return "שליטה כבדה (CC) ונזק \(type)" }
        return "נזק \(h.damageProfile.hebrew) \(type)"
    }
}
