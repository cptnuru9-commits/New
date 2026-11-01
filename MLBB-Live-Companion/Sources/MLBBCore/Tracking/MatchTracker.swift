import Foundation

public struct HeroSlotID: Hashable, Sendable {
    public let source: SlotSource
    public let side: TeamSide
    public let index: Int
    public init(source: SlotSource, side: TeamSide, index: Int) {
        self.source = source
        self.side = side
        self.index = index
    }
}

public struct ItemSlotID: Hashable, Sendable {
    public let side: TeamSide
    public let player: Int
    public let index: Int
    public init(side: TeamSide, player: Int, index: Int) {
        self.side = side
        self.player = player
        self.index = index
    }
}

/// Everything extracted from one analysed frame.
public struct FrameObservation: Sendable {
    public var time: Date
    public var screenEvidence: [GameScreen: Double] = [:]
    public var heroes: [HeroSlotID: Recognition] = [:]
    public var items: [ItemSlotID: Recognition] = [:]
    /// Ally slot where the player's own name was read (OCR).
    public var mySlotHint: HeroSlotID?
    public var gameClockSeconds: Int?

    public init(time: Date) { self.time = time }
}

// MARK: - Slot tracker

public struct SlotState: Equatable, Sendable {
    public var label: String?
    public var confidence: Double = 0
    public var firstSeen: Date?
    public var lastSeen: Date?
    public var lastObservation: Date?
    public var isEmpty = false
    /// Last uncertain guess (diagnostics only).
    public var bestGuess: String?
    public var bestGuessConfidence: Double = 0

    public var everObserved: Bool { lastObservation != nil }
}

/// Temporal voting for one slot: a label is accepted only after it wins `minVotes` of the last `windowSize`
/// frames with enough confidence. One noisy frame can never flip a confirmed slot.
public struct SlotTracker: Sendable {
    public var windowSize: Int
    public var minVotes: Int
    public var minConfidence: Double
    public let allowsEmpty: Bool

    private var votes: [Recognition] = []
    public private(set) var state = SlotState()

    public init(allowsEmpty: Bool, windowSize: Int = 6, minVotes: Int = 3, minConfidence: Double = 0.5) {
        self.allowsEmpty = allowsEmpty
        self.windowSize = windowSize
        self.minVotes = minVotes
        self.minConfidence = minConfidence
    }

    public mutating func observe(_ r: Recognition, at t: Date) {
        votes.append(r)
        if votes.count > windowSize { votes.removeFirst(votes.count - windowSize) }
        state.lastObservation = t

        var counts: [String: Int] = [:]
        var confSum: [String: Double] = [:]
        var emptyCount = 0
        for v in votes {
            switch v {
            case let .match(label, c) where c >= minConfidence:
                counts[label, default: 0] += 1
                confSum[label, default: 0] += c
            case .empty:
                emptyCount += 1
            default:
                break
            }
        }

        if case let .uncertain(guess, c) = r {
            state.bestGuess = guess
            state.bestGuessConfidence = c
        }

        let top = counts.max { a, b in a.value == b.value ? (confSum[a.key] ?? 0) < (confSum[b.key] ?? 0) : a.value < b.value }
        if let top, top.value >= minVotes {
            if state.label != top.key {
                state.label = top.key
                state.firstSeen = t
            }
            state.isEmpty = false
            state.confidence = (confSum[top.key] ?? 0) / Double(top.value)
            if case let .match(l, _) = r, l == top.key { state.lastSeen = t }
            if state.lastSeen == nil { state.lastSeen = t }
        } else if allowsEmpty, emptyCount >= minVotes, case .empty = r {
            state.label = nil
            state.isEmpty = true
            state.confidence = 1
            state.lastSeen = t
        }
    }

    public mutating func reset() {
        votes.removeAll()
        state = SlotState()
    }
}

// MARK: - Screen detector

/// Smooths per-frame screen evidence with exponential decay and hysteresis.
public struct ScreenStateDetector: Sendable {
    public private(set) var current: GameScreen = .unknown
    public private(set) var confidence: Double = 0
    public private(set) var since: Date?
    private var scores: [GameScreen: Double] = [:]
    public var decay: Double = 0.6
    public var enterThreshold: Double = 0.5
    public var switchMargin: Double = 0.1

    public init() {}

    public mutating func update(evidence: [GameScreen: Double], at t: Date) {
        for s in GameScreen.allCases where s != .unknown {
            let e = min(1, max(0, evidence[s] ?? 0))
            scores[s] = (scores[s] ?? 0) * decay + e * (1 - decay)
        }
        guard let best = scores.max(by: { $0.value < $1.value }) else { return }
        if best.value >= enterThreshold, best.key != current {
            let currentScore = scores[current] ?? 0
            if current == .unknown || best.value > currentScore + switchMargin {
                current = best.key
                since = t
            }
        }
        confidence = current == .unknown ? 0 : (scores[current] ?? 0)
        if current != .unknown && confidence < 0.1 {
            current = .unknown
            since = t
            confidence = 0
        }
    }

    public mutating func override(_ screen: GameScreen, at t: Date) {
        current = screen
        since = t
        scores = [:]
        if screen != .unknown { scores[screen] = 1 }
        confidence = screen == .unknown ? 0 : 1
    }
}

// MARK: - Snapshot types

public enum DetectionStatus: String, Sendable {
    /// Recognised with enough votes.
    case confirmed
    /// Seen on screen but not recognised confidently — shown as "Unknown".
    case unknown
    /// Not on screen yet in this match.
    case notSeen
}

public struct DetectedHero: Sendable, Equatable, Identifiable {
    public var id: String { "\(side.rawValue)-\(index)" }
    public let side: TeamSide
    public let index: Int
    public let label: String?
    public let hero: Hero?
    public let confidence: Double
    public let lastSeen: Date?
    public let observed: Bool
    public let bestGuess: String?
    public let bestGuessConfidence: Double

    public var status: DetectionStatus { label != nil ? .confirmed : (observed ? .unknown : .notSeen) }

    public static func notSeen(side: TeamSide, index: Int) -> DetectedHero {
        DetectedHero(side: side, index: index, label: nil, hero: nil, confidence: 0, lastSeen: nil, observed: false, bestGuess: nil, bestGuessConfidence: 0)
    }
}

public struct DetectedItem: Sendable, Equatable, Identifiable {
    public var id: String { "\(slot)-\(label)" }
    public let slot: Int
    public let label: String
    public let item: Item?
    public let confidence: Double
    public let firstSeen: Date?
    public let lastSeen: Date?
}

public struct PlayerSnapshot: Sendable, Equatable, Identifiable {
    public var id: String { hero.id }
    public let hero: DetectedHero
    public let items: [DetectedItem]
    /// Item slots of this player were visible at least once (scoreboard opened).
    public let itemsObserved: Bool
    public let itemsLastSeen: Date?
    public let isMe: Bool
}

public struct MatchSnapshot: Sendable, Equatable {
    public let screen: GameScreen
    public let screenConfidence: Double
    public let screenSince: Date?
    public let allies: [PlayerSnapshot]
    public let enemies: [PlayerSnapshot]
    public let mySlot: Int?
    /// "manual", "name" (player name read by OCR) or nil.
    public let mySlotSource: String?
    public let rosterSource: SlotSource?
    public let gameClockSeconds: Int?
    public let lastUpdate: Date?

    public var me: PlayerSnapshot? { mySlot.flatMap { s in allies.indices.contains(s) ? allies[s] : nil } }
    public var allPlayers: [PlayerSnapshot] { allies + enemies }

    public static let empty = MatchSnapshot(
        screen: .unknown, screenConfidence: 0, screenSince: nil,
        allies: (0..<5).map { PlayerSnapshot(hero: .notSeen(side: .ally, index: $0), items: [], itemsObserved: false, itemsLastSeen: nil, isMe: false) },
        enemies: (0..<5).map { PlayerSnapshot(hero: .notSeen(side: .enemy, index: $0), items: [], itemsObserved: false, itemsLastSeen: nil, isMe: false) },
        mySlot: nil, mySlotSource: nil, rosterSource: nil, gameClockSeconds: nil, lastUpdate: nil)
}

// MARK: - Match tracker

/// Accumulates observations over a match and produces stable snapshots.
public struct MatchTracker: Sendable {
    public private(set) var screen = ScreenStateDetector()
    private var heroTrackers: [HeroSlotID: SlotTracker] = [:]
    private var itemTrackers: [ItemSlotID: SlotTracker] = [:]
    private var mySlotVotes: [HeroSlotID: Int] = [:]
    public private(set) var gameClock: Int?
    public private(set) var gameClockAt: Date?
    public private(set) var lastUpdate: Date?
    public private(set) var matchCount = 0

    public var minVotes: Int
    public var minConfidence: Double

    public init(minVotes: Int = 3, minConfidence: Double = 0.5) {
        self.minVotes = minVotes
        self.minConfidence = minConfidence
    }

    public mutating func ingest(_ o: FrameObservation) {
        let previous = screen.current
        screen.update(evidence: o.screenEvidence, at: o.time)
        // A new draft after a game means a new match.
        if screen.current == .draft, [.inGame, .scoreboard, .results].contains(previous) {
            resetMatch()
        }
        for (slot, r) in o.heroes {
            var t = heroTrackers[slot] ?? SlotTracker(allowsEmpty: false, minVotes: minVotes, minConfidence: minConfidence)
            t.observe(r, at: o.time)
            heroTrackers[slot] = t
        }
        for (slot, r) in o.items {
            var t = itemTrackers[slot] ?? SlotTracker(allowsEmpty: true, minVotes: minVotes, minConfidence: minConfidence)
            t.observe(r, at: o.time)
            itemTrackers[slot] = t
        }
        if let hint = o.mySlotHint { mySlotVotes[hint, default: 0] += 1 }
        if let c = o.gameClockSeconds {
            gameClock = c
            gameClockAt = o.time
        }
        lastUpdate = o.time
    }

    public mutating func overrideScreen(_ s: GameScreen, at t: Date) { screen.override(s, at: t) }

    public mutating func resetMatch() {
        heroTrackers.removeAll()
        itemTrackers.removeAll()
        mySlotVotes.removeAll()
        gameClock = nil
        gameClockAt = nil
        matchCount += 1
    }

    /// Estimated current game time, extrapolated from the last clock reading.
    public func estimatedClock(now: Date) -> Int? {
        guard let c = gameClock, let at = gameClockAt else { return nil }
        let elapsed = now.timeIntervalSince(at)
        return elapsed < 120 ? c + Int(elapsed) : c
    }

    public func snapshot(database db: GameDatabase?, mySlotOverride: Int?, now: Date = Date()) -> MatchSnapshot {
        // Prefer the scoreboard roster (it is the one items are attached to) once any of it is confirmed.
        let scoreConfirmed = heroTrackers.contains { $0.key.source == .scoreboard && $0.value.state.label != nil }
        let roster: SlotSource? = scoreConfirmed ? .scoreboard
            : (heroTrackers.keys.contains { $0.source == .draft } ? .draft
               : (heroTrackers.isEmpty ? nil : .scoreboard))
        let source = roster ?? .scoreboard

        // My slot: manual override > OCR name votes for the active roster.
        var mySlot: Int?
        var mySource: String?
        if let m = mySlotOverride, (0..<5).contains(m) {
            mySlot = m
            mySource = "manual"
        } else if let best = mySlotVotes.filter({ $0.key.source == source && $0.key.side == .ally }).max(by: { $0.value < $1.value }),
                  best.value >= 2 {
            mySlot = best.key.index
            mySource = "name"
        }

        var heroes: [TeamSide: [DetectedHero]] = [:]
        for side in TeamSide.allCases {
            heroes[side] = (0..<5).map { (i: Int) -> DetectedHero in
                guard let t = heroTrackers[HeroSlotID(source: source, side: side, index: i)] else { return .notSeen(side: side, index: i) }
                let s = t.state
                return DetectedHero(side: side, index: i, label: s.label, hero: s.label.flatMap { db?.hero(named: $0) },
                                    confidence: s.label == nil ? s.bestGuessConfidence : s.confidence,
                                    lastSeen: s.lastSeen, observed: s.everObserved,
                                    bestGuess: s.bestGuess, bestGuessConfidence: s.bestGuessConfidence)
            }
        }
        heroes = Self.resolveDuplicates(heroes)

        func players(_ side: TeamSide) -> [PlayerSnapshot] {
            (0..<5).map { (i: Int) -> PlayerSnapshot in
                var items: [DetectedItem] = []
                var observed = false
                var last: Date?
                for k in 0..<6 {
                    guard let t = itemTrackers[ItemSlotID(side: side, player: i, index: k)] else { continue }
                    observed = observed || t.state.everObserved
                    if let lo = t.state.lastObservation, lo > (last ?? .distantPast) { last = lo }
                    if let label = t.state.label {
                        items.append(DetectedItem(slot: k, label: label, item: db?.item(named: label),
                                                  confidence: t.state.confidence, firstSeen: t.state.firstSeen, lastSeen: t.state.lastSeen))
                    }
                }
                let hero = heroes[side]?[i] ?? .notSeen(side: side, index: i)
                return PlayerSnapshot(hero: hero, items: items, itemsObserved: observed, itemsLastSeen: last,
                                      isMe: side == .ally && mySlot == i)
            }
        }

        return MatchSnapshot(screen: screen.current, screenConfidence: screen.confidence, screenSince: screen.since,
                             allies: players(.ally), enemies: players(.enemy),
                             mySlot: mySlot, mySlotSource: mySource, rosterSource: roster,
                             gameClockSeconds: estimatedClock(now: now), lastUpdate: lastUpdate)
    }

    /// The same hero cannot be picked twice in a draft: keep the more confident slot, mark the other unknown.
    static func resolveDuplicates(_ heroes: [TeamSide: [DetectedHero]]) -> [TeamSide: [DetectedHero]] {
        var best: [String: (TeamSide, Int, Double)] = [:]
        for (side, list) in heroes {
            for h in list {
                guard let l = h.label else { continue }
                if let cur = best[l], cur.2 >= h.confidence { continue }
                best[l] = (side, h.index, h.confidence)
            }
        }
        var out = heroes
        for (side, list) in heroes {
            out[side] = list.map { (h: DetectedHero) -> DetectedHero in
                guard let l = h.label, let keep = best[l], !(keep.0 == side && keep.1 == h.index) else { return h }
                return DetectedHero(side: h.side, index: h.index, label: nil, hero: nil, confidence: 0, lastSeen: h.lastSeen,
                                    observed: true, bestGuess: l, bestGuessConfidence: h.confidence)
            }
        }
        return out
    }
}
