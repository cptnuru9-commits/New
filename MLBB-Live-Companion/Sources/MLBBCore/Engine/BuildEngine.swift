import Foundation

public enum GamePhase: String, Sendable, CaseIterable {
    case early, mid, late

    public var hebrew: String {
        switch self {
        case .early: return "תחילת משחק"
        case .mid: return "אמצע משחק"
        case .late: return "סוף משחק"
        }
    }

    /// Defensive answers matter more later, when enemies have their core items.
    var survivalFactor: Double {
        switch self {
        case .early: return 0.7
        case .mid: return 1.0
        case .late: return 1.2
        }
    }

    /// From the in-game clock when it was read, otherwise from how many items the player already has.
    public static func estimate(clockSeconds: Int?, ownedItems: Int) -> GamePhase {
        if let c = clockSeconds { return c < 6 * 60 ? .early : (c < 14 * 60 ? .mid : .late) }
        return ownedItems <= 2 ? .early : (ownedItems <= 4 ? .mid : .late)
    }
}

public enum StepKind: String, Sendable {
    case boots, core, situational, counter
    public var label: String {
        switch self {
        case .boots: return "Boots"
        case .core: return "Core"
        case .situational: return "Situational"
        case .counter: return "Counter"
        }
    }
}

public struct BuildAlternative: Sendable, Equatable {
    public let item: Item
    public let condition: String
}

public struct BuildStep: Sendable, Equatable, Identifiable {
    public var id: String { item.id }
    public let position: Int
    public let item: Item
    public let kind: StepKind
    public let owned: Bool
    public let reason: String
    public let effectiveAgainst: [String]
    public let alternative: BuildAlternative?
    public let tradeoff: String
    public let score: Double
    public let nextItemName: String?
}

public struct BuildRecommendation: Sendable, Equatable {
    public let hero: Hero
    public let archetype: Archetype
    public let lane: Lane?
    public let templateID: String?
    public let templateLabel: String
    public let emblem: String
    public let spell: String
    public let phase: GamePhase
    public let steps: [BuildStep]
    public let threat: ThreatProfile
    public let warnings: [String]

    /// The first item in the order that the player does not own yet.
    public var buyNow: BuildStep? { steps.first { !$0.owned } }
    public var owned: [BuildStep] { steps.filter(\.owned) }
}

public struct BuildContext: Sendable {
    public var myHero: Hero
    public var lane: Lane?
    public var enemies: [PlayerSnapshot]
    public var ownedItems: [Item]
    public var gameClockSeconds: Int?

    public init(myHero: Hero, lane: Lane? = nil, enemies: [PlayerSnapshot], ownedItems: [Item] = [], gameClockSeconds: Int? = nil) {
        self.myHero = myHero
        self.lane = lane
        self.enemies = enemies
        self.ownedItems = ownedItems
        self.gameClockSeconds = gameClockSeconds
    }
}

/// Rule-based, explainable build engine.
/// Keeps the hero's core damage items from its template and fills boots and situational slots
/// with the items that best answer the detected enemy threats, with an explanation for each choice.
public struct BuildEngine: Sendable {
    public let db: GameDatabase
    /// Bonus that keeps template items unless a counter is clearly better.
    public var templateBonus = 0.32
    public var bootsTemplateBonus = 0.4
    public var antiHealThreshold = 0.18
    public var penetrationThreshold = 0.35

    public init(database: GameDatabase) { db = database }

    public func recommend(_ ctx: BuildContext) -> BuildRecommendation {
        let hero = ctx.myHero
        let archetype = hero.archetype
        let template = db.template(for: hero, lane: ctx.lane)
        let templateItems = (template?.items ?? []).compactMap { db.item(id: $0) }
        let threat = ThreatAnalyzer.analyze(enemies: ctx.enemies)
        let owned = Self.unique(ctx.ownedItems)
        let phase = GamePhase.estimate(clockSeconds: ctx.gameClockSeconds, ownedItems: owned.count)
        let need = archetype.survivalNeed * phase.survivalFactor

        var warnings: [String] = []
        if template == nil { warnings.append("אין במאגר תבנית בילד ל-\(hero.name) — נדרש עדכון של builds.json.") }
        if !hero.isCuratedProfile { warnings.append("פרופיל היכולות של \(hero.name) נגזר מהתפקיד בלבד (role-default) — כדאי לעדכן את heroes.json.") }
        if threat.knownEnemies == 0 {
            warnings.append("גיבורי האויב עוד לא זוהו — מוצג הבילד הבסיסי בלי התאמות.")
        } else if threat.unknownEnemies > 0 {
            warnings.append("\(threat.unknownEnemies) מגיבורי האויב עוד לא זוהו — ההתאמות חלקיות.")
        }

        func score(_ item: Item, _ residual: [ThreatDimension: Double]) -> Double {
            var s = 0.0
            for d in ThreatDimension.survival { s += (residual[d] ?? 0) * item.weight(d) * need }
            for d in ThreatDimension.offensive { s += (residual[d] ?? 0) * item.weight(d) * archetype.offenseCounterNeed }
            return s
        }

        // 1. Boots
        let templateBoots = templateItems.first { $0.category == .boots }
        let bootsPool = db.items.filter { $0.category == .boots && $0.isUsable(by: archetype) }
        let rankedBoots = bootsPool.map { b in
            (item: b, score: score(b, threat.values) + (b.id == templateBoots?.id ? bootsTemplateBonus : 0))
        }.sorted { $0.score > $1.score }
        var boots = rankedBoots.first?.item ?? templateBoots
        if let ownedBoots = owned.first(where: { $0.category == .boots }) { boots = ownedBoots }

        // 2. Core damage items (first two non-boots template items)
        let nonBoots = templateItems.filter { $0.category != .boots }
        let core = Array(nonBoots.prefix(2))
        let templateRest = Array(nonBoots.dropFirst(2))
        var chosenIDs = Set(core.map(\.id))
        if let boots { chosenIDs.insert(boots.id) }

        // 3. Situational slots: greedy choice with diminishing returns per threat dimension.
        let slots = max(0, 6 - core.count - (boots == nil ? 0 : 1))
        let pool = db.items.filter { it in
            it.category != .boots && it.isUsable(by: archetype) && !chosenIDs.contains(it.id)
                && (it.counterStrength > 0 || templateRest.contains(it))
        }
        var residual = threat.values
        var defenseCount = core.filter(\.isDefensive).count
        var picks: [(item: Item, score: Double, fromTemplate: Bool)] = []
        for _ in 0..<slots {
            var best: (item: Item, score: Double, fromTemplate: Bool)?
            for cand in pool where !chosenIDs.contains(cand.id) {
                let fromTemplate = templateRest.contains(cand)
                var s = score(cand, residual) + (fromTemplate ? templateBonus : 0)
                if cand.isDefensive && defenseCount >= archetype.maxDefensiveItems { s -= 10 }
                if s > (best?.score ?? -.infinity) { best = (cand, s, fromTemplate) }
            }
            guard let pick = best else { break }
            picks.append(pick)
            chosenIDs.insert(pick.item.id)
            if pick.item.isDefensive { defenseCount += 1 }
            for d in ThreatDimension.allCases {
                residual[d] = (residual[d] ?? 0) * (1 - 0.6 * min(1, pick.item.weight(d)))
            }
        }

        // 4. Mandatory answers: anti-heal against heavy healing, penetration against stacked defence.
        // Damage dealers get these from a damage item (e.g. Sea Halberd), not from a tank item.
        let dealer = archetype != .tank && archetype != .support
        func ensure(tag: String, when needed: Bool) {
            guard needed else { return }
            let counts: (Item) -> Bool = { $0.has(tag: tag) && (!dealer || !$0.isDefensive) }
            guard !(core + picks.map(\.item)).contains(where: counts) else { return }
            let options = db.items.filter {
                counts($0) && $0.isUsable(by: archetype) && !chosenIDs.contains($0.id) && $0.category != .boots
            }
            guard let add = options.max(by: { score($0, threat.values) < score($1, threat.values) }) else { return }
            let newPick = (item: add, score: score(add, threat.values) + 0.5, fromTemplate: false)
            if let same = picks.firstIndex(where: { $0.item.has(tag: tag) }) {
                // A defensive item with the same tag was picked: swap it for the damage version.
                chosenIDs.remove(picks[same].item.id)
                picks[same] = newPick
            } else if picks.count < slots {
                picks.append(newPick)
            } else if let idx = picks.indices.min(by: { lhs, rhs in
                // Replace the weakest pick, preferring non-template picks.
                (picks[lhs].score - (picks[lhs].fromTemplate ? 0 : 0.2)) < (picks[rhs].score - (picks[rhs].fromTemplate ? 0 : 0.2))
            }) {
                chosenIDs.remove(picks[idx].item.id)
                picks[idx] = newPick
            }
            chosenIDs.insert(add.id)
        }
        ensure(tag: "antiHeal", when: threat[.healing] >= antiHealThreshold)
        let penTag = archetype.isMagic ? "magicPenetration" : "penetration"
        ensure(tag: penTag, when: dealer && threat[.tanky] >= penetrationThreshold)

        // 5. Owned items always stay in the build.
        var situational = picks.sorted { $0.score > $1.score }.map(\.item)
        for o in owned where o.category != .boots && !core.contains(o) && !situational.contains(o) {
            if situational.count >= slots, let lastNonOwned = situational.lastIndex(where: { !owned.contains($0) }) {
                situational.remove(at: lastNonOwned)
            }
            situational.append(o)
        }

        // 6. Order: core #1, boots, core #2, situational by urgency.
        var order: [(Item, StepKind)] = []
        if let c0 = core.first { order.append((c0, .core)) }
        if let boots { order.append((boots, .boots)) }
        for c in core.dropFirst() { order.append((c, .core)) }
        for s in situational {
            let k: StepKind = score(s, threat.values) >= 0.15 ? .counter : .situational
            order.append((s, k))
        }
        // Owned items first (already bought), then the rest in recommended order.
        let ownedIDs = Set(owned.map(\.id))
        let sorted = order.filter { ownedIDs.contains($0.0.id) } + order.filter { !ownedIDs.contains($0.0.id) }

        var steps: [BuildStep] = []
        for (i, entry) in sorted.enumerated() {
            let (item, kind) = entry
            let next = i + 1 < sorted.count ? sorted[i + 1].0.name : nil
            let (reason, against) = explain(item: item, kind: kind, hero: hero, template: template,
                                            templateBoots: templateBoots, threat: threat)
            let alt = alternative(for: item, kind: kind, archetype: archetype, chosen: Set(sorted.map { $0.0.id }),
                                  threat: threat, score: { score($0, threat.values) })
            var tradeoff = item.tradeoff
            if item.isDefensive && archetype.survivalNeed < 1 && archetype != .support {
                tradeoff += " מוותרים על נזק לטובת הישרדות."
            }
            steps.append(BuildStep(position: i + 1, item: item, kind: kind, owned: ownedIDs.contains(item.id),
                                   reason: reason, effectiveAgainst: against, alternative: alt, tradeoff: tradeoff,
                                   score: score(item, threat.values), nextItemName: next))
        }

        return BuildRecommendation(hero: hero, archetype: archetype, lane: ctx.lane ?? hero.lanes.first,
                                   templateID: template?.id, templateLabel: template?.label ?? archetype.displayName,
                                   emblem: template?.emblem ?? "", spell: template?.spell ?? "",
                                   phase: phase, steps: steps, threat: threat, warnings: warnings)
    }

    // MARK: Explanations

    func contributingDimensions(_ item: Item, _ threat: ThreatProfile) -> [(ThreatDimension, Double)] {
        ThreatDimension.allCases.map { ($0, threat[$0] * item.weight($0)) }
            .filter { $0.1 > 0.05 }
            .sorted { $0.1 > $1.1 }
    }

    func explain(item: Item, kind: StepKind, hero: Hero, template: BuildTemplate?, templateBoots: Item?,
                 threat: ThreatProfile) -> (String, [String]) {
        let dims = contributingDimensions(item, threat)
        var weights: [ThreatDimension: Double] = [:]
        for d in ThreatDimension.allCases { weights[d] = item.weight(d) }
        let against = threat.topHeroes(for: weights)
        let threatText = dims.prefix(2).map { $0.0.hebrew }.joined(separator: " ו")
        let againstText = against.isEmpty ? "" : " (\(against.joined(separator: ", ")))"

        switch kind {
        case .core:
            return ("חפץ ליבה בבילד \(template?.label ?? hero.archetype.displayName) — מקור הנזק העיקרי של \(hero.name). \(item.effect)", against)
        case .boots:
            if let tb = templateBoots, tb.id != item.id, !dims.isEmpty {
                return ("\(item.name) במקום \(tb.name): ליריב \(threatText) משמעותי\(againstText). \(item.effect)", against)
            }
            return ("המגפיים של הבילד הבסיסי. \(item.effect)", against)
        case .counter:
            if dims.isEmpty { return (item.effect, against) }
            return ("ליריב \(threatText) משמעותי\(againstText). \(item.effect)", against)
        case .situational:
            return ("משלים את הבילד. \(item.effect)", against)
        }
    }

    func alternative(for item: Item, kind: StepKind, archetype: Archetype, chosen: Set<String>,
                     threat: ThreatProfile, score: (Item) -> Double) -> BuildAlternative? {
        let mainDim = ThreatDimension.allCases.max { item.weight($0) < item.weight($1) }
        let candidates = db.items.filter {
            $0.id != item.id && !chosen.contains($0.id) && $0.isUsable(by: archetype)
                && ((kind == .boots) == ($0.category == .boots))
        }
        if kind == .core {
            guard let alt = candidates.filter({ $0.category == item.category && $0.counterStrength > 0 })
                .max(by: { score($0) < score($1) }) else { return nil }
            let d = ThreatDimension.allCases.max { alt.weight($0) < alt.weight($1) } ?? .physical
            return BuildAlternative(item: alt, condition: "אם \(d.hebrew) של היריב הופך לבעיה המרכזית")
        }
        // Prefer an alternative that answers a different threat than this item.
        let different = candidates.filter { c in
            let d = ThreatDimension.allCases.max { c.weight($0) < c.weight($1) }
            return c.counterStrength > 0 && d != mainDim
        }
        guard let alt = (different.isEmpty ? candidates : different).max(by: { score($0) < score($1) }) else { return nil }
        let d = ThreatDimension.allCases.max { alt.weight($0) < alt.weight($1) }
        let condition: String
        if let d, alt.weight(d) > 0 {
            condition = "אם \(d.hebrew) של היריב מתחזק"
        } else {
            condition = "אם צריך יותר נזק במקום הגנה"
        }
        return BuildAlternative(item: alt, condition: condition)
    }

    static func unique(_ items: [Item]) -> [Item] {
        var seen = Set<String>()
        return items.filter { seen.insert($0.id).inserted }
    }
}
