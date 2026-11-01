import Foundation

/// Rectangle in 0...1 coordinates, origin top-left, relative to the game picture (not the whole window).
public struct NormalizedRect: Codable, Sendable, Hashable {
    public var x: Double
    public var y: Double
    public var width: Double
    public var height: Double

    public init(x: Double, y: Double, width: Double, height: Double) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    }

    public static let full = NormalizedRect(x: 0, y: 0, width: 1, height: 1)

    public var midX: Double { x + width / 2 }
    public var midY: Double { y + height / 2 }

    public func contains(x px: Double, y py: Double) -> Bool {
        px >= x && px <= x + width && py >= y && py <= y + height
    }

    /// Rect expressed inside a parent rect (both normalised): maps child-local coordinates to parent space.
    public func mapped(into parent: NormalizedRect) -> NormalizedRect {
        NormalizedRect(x: parent.x + x * parent.width, y: parent.y + y * parent.height,
                       width: width * parent.width, height: height * parent.height)
    }

    /// Builds a rect from two corner points, clamped to 0...1.
    public static func from(_ ax: Double, _ ay: Double, _ bx: Double, _ by: Double) -> NormalizedRect {
        let x0 = min(max(min(ax, bx), 0), 1), x1 = min(max(max(ax, bx), 0), 1)
        let y0 = min(max(min(ay, by), 0), 1), y1 = min(max(max(ay, by), 0), 1)
        return NormalizedRect(x: x0, y: y0, width: x1 - x0, height: y1 - y0)
    }
}

/// Calibrated screen areas. The user draws them once on a captured frame (Calibration screen).
public enum RegionKind: String, Codable, Sendable, CaseIterable, Identifiable {
    case draftAllyPicks
    case draftEnemyPicks
    case scoreAllyHeroes
    case scoreEnemyHeroes
    case scoreAllyItems
    case scoreEnemyItems
    case gameTimer

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .draftAllyPicks: return "Draft — Ally picks (5)"
        case .draftEnemyPicks: return "Draft — Enemy picks (5)"
        case .scoreAllyHeroes: return "Scoreboard — Ally heroes (5)"
        case .scoreEnemyHeroes: return "Scoreboard — Enemy heroes (5)"
        case .scoreAllyItems: return "Scoreboard — Ally items (5×6)"
        case .scoreEnemyItems: return "Scoreboard — Enemy items (5×6)"
        case .gameTimer: return "Game timer (OCR)"
        }
    }

    public var screen: GameScreen {
        switch self {
        case .draftAllyPicks, .draftEnemyPicks: return .draft
        case .scoreAllyHeroes, .scoreEnemyHeroes, .scoreAllyItems, .scoreEnemyItems: return .scoreboard
        case .gameTimer: return .inGame
        }
    }

    public var side: TeamSide? {
        switch self {
        case .draftAllyPicks, .scoreAllyHeroes, .scoreAllyItems: return .ally
        case .draftEnemyPicks, .scoreEnemyHeroes, .scoreEnemyItems: return .enemy
        case .gameTimer: return nil
        }
    }

    public var source: SlotSource { screen == .draft ? .draft : .scoreboard }
    public var isHeroGrid: Bool { [.draftAllyPicks, .draftEnemyPicks, .scoreAllyHeroes, .scoreEnemyHeroes].contains(self) }
    public var isItemGrid: Bool { self == .scoreAllyItems || self == .scoreEnemyItems }

    public var defaultRows: Int {
        switch self {
        case .gameTimer: return 1
        default: return 5
        }
    }

    public var defaultCols: Int { isItemGrid ? 6 : 1 }
}

public struct GridCell: Sendable, Hashable {
    public let row: Int
    public let col: Int
    /// Player slot 0...4.
    public let player: Int
    /// Item slot 0...5 (item grids), 0 otherwise.
    public let itemIndex: Int
    public let rect: NormalizedRect
}

public struct LayoutRegion: Codable, Sendable, Hashable, Identifiable {
    public var id: UUID
    public var kind: RegionKind
    public var rect: NormalizedRect
    public var rows: Int
    public var cols: Int
    /// Item grids: true when each row is one player (rows = players, cols = item slots).
    public var playersAlongRows: Bool

    public init(id: UUID = UUID(), kind: RegionKind, rect: NormalizedRect, rows: Int? = nil, cols: Int? = nil, playersAlongRows: Bool = true) {
        self.id = id
        self.kind = kind
        self.rect = rect
        self.rows = max(1, rows ?? kind.defaultRows)
        self.cols = max(1, cols ?? kind.defaultCols)
        self.playersAlongRows = playersAlongRows
    }

    public func cells() -> [GridCell] {
        var out: [GridCell] = []
        let cw = rect.width / Double(cols), ch = rect.height / Double(rows)
        for r in 0..<rows {
            for c in 0..<cols {
                let cellRect = NormalizedRect(x: rect.x + Double(c) * cw, y: rect.y + Double(r) * ch, width: cw, height: ch)
                let player: Int
                let item: Int
                if kind.isItemGrid {
                    player = playersAlongRows ? r : c
                    item = playersAlongRows ? c : r
                } else {
                    player = r * cols + c
                    item = 0
                }
                out.append(GridCell(row: r, col: c, player: player, itemIndex: item, rect: cellRect))
            }
        }
        return out
    }

    /// Player slot whose row/column band contains the given point (used to place the player's name).
    public func playerBand(containing px: Double, _ py: Double, horizontalSlack: Double = 0.25) -> Int? {
        guard !kind.isItemGrid, kind != .gameTimer else { return nil }
        let vertical = rows >= cols
        if vertical {
            guard py >= rect.y, py <= rect.y + rect.height,
                  px >= rect.x - horizontalSlack, px <= rect.x + rect.width + horizontalSlack else { return nil }
            return min(rows - 1, Int((py - rect.y) / (rect.height / Double(rows))))
        } else {
            guard px >= rect.x, px <= rect.x + rect.width,
                  py >= rect.y - horizontalSlack, py <= rect.y + rect.height + horizontalSlack else { return nil }
            return min(cols - 1, Int((px - rect.x) / (rect.width / Double(cols))))
        }
    }
}

/// A user-captured reference crop that identifies a screen (e.g. a distinctive draft-screen element).
public struct StateAnchor: Codable, Sendable, Hashable, Identifiable {
    public var id: UUID
    public var screen: GameScreen
    public var rect: NormalizedRect
    public init(id: UUID = UUID(), screen: GameScreen, rect: NormalizedRect) {
        self.id = id
        self.screen = screen
        self.rect = rect
    }
}

public struct LayoutProfile: Codable, Sendable, Hashable {
    public var name: String
    /// width / height of the game picture when the profile was calibrated.
    public var referenceAspect: Double?
    public var regions: [LayoutRegion]
    public var anchors: [StateAnchor]
    /// GameScreen rawValue -> words that indicate the screen when found by OCR. Editable in layout.json.
    public var stateKeywords: [String: [String]]

    public init(name: String, referenceAspect: Double? = nil, regions: [LayoutRegion] = [], anchors: [StateAnchor] = [],
                stateKeywords: [String: [String]] = LayoutProfile.defaultKeywords) {
        self.name = name
        self.referenceAspect = referenceAspect
        self.regions = regions
        self.anchors = anchors
        self.stateKeywords = stateKeywords
    }

    /// Starting guesses only — verify against your client language and adjust in layout.json.
    public static let defaultKeywords: [String: [String]] = [
        GameScreen.draft.rawValue: ["BAN", "PICK", "LOCK IN", "CONFIRM"],
        GameScreen.scoreboard.rawValue: ["KDA"],
        GameScreen.results.rawValue: ["VICTORY", "DEFEAT", "MVP"],
    ]

    public static let empty = LayoutProfile(name: "Default")

    public func region(_ kind: RegionKind) -> LayoutRegion? { regions.first { $0.kind == kind } }

    public mutating func upsert(_ region: LayoutRegion) {
        regions.removeAll { $0.kind == region.kind }
        regions.append(region)
    }

    public var isCalibrated: Bool { regions.contains { $0.kind.isHeroGrid } }

    /// True when the current picture's aspect ratio differs from the calibrated one by more than 3 %.
    public func aspectMismatch(_ aspect: Double) -> Bool {
        guard let ref = referenceAspect, ref > 0 else { return false }
        return abs(aspect - ref) / ref > 0.03
    }
}
