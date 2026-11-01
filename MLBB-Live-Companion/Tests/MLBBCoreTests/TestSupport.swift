import Foundation
@testable import MLBBCore

enum TestData {
    static let dataDirectory: URL = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()   // MLBBCoreTests
        .deletingLastPathComponent()   // Tests
        .deletingLastPathComponent()   // package root
        .appendingPathComponent("Resources/Data", isDirectory: true)

    static let database: GameDatabase = {
        do { return try GameDatabase.load(from: dataDirectory) } catch { fatalError("Cannot load database: \(error)") }
    }()

    static func player(_ name: String?, side: TeamSide, index: Int, items: [String] = []) -> PlayerSnapshot {
        let hero = name.flatMap { database.hero(named: $0) }
        let dh = DetectedHero(side: side, index: index, label: hero?.name, hero: hero, confidence: hero == nil ? 0 : 0.9,
                              lastSeen: Date(), observed: true, bestGuess: nil, bestGuessConfidence: 0)
        let di = items.enumerated().compactMap { (i, n) -> DetectedItem? in
            guard let it = database.item(named: n) else { return nil }
            return DetectedItem(slot: i, label: it.name, item: it, confidence: 0.9, firstSeen: Date(), lastSeen: Date())
        }
        return PlayerSnapshot(hero: dh, items: di, itemsObserved: !items.isEmpty, itemsLastSeen: nil, isMe: false)
    }

    static func enemies(_ names: [String?]) -> [PlayerSnapshot] {
        names.enumerated().map { player($0.element, side: .enemy, index: $0.offset) }
    }

    /// Synthetic icon: solid quadrants of the given colours (RGBA8).
    static func icon(_ colors: [(UInt8, UInt8, UInt8)], side: Int = IconDescriptor.side) -> [UInt8] {
        var px = [UInt8](repeating: 255, count: side * side * 4)
        for y in 0..<side {
            for x in 0..<side {
                let q = (y < side / 2 ? 0 : 2) + (x < side / 2 ? 0 : 1)
                let c = colors[q % colors.count]
                let o = (y * side + x) * 4
                px[o] = c.0
                px[o + 1] = c.1
                px[o + 2] = c.2
            }
        }
        return px
    }
}
