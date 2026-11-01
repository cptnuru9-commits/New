import XCTest
@testable import MLBBCore

final class RecognitionTests: XCTestCase {
    let side = IconDescriptor.side

    func descriptor(_ colors: [(UInt8, UInt8, UInt8)]) -> IconDescriptor {
        IconDescriptor.make(rgba: TestData.icon(colors), width: side, height: side)
    }

    func testMatcherRecognisesKnownIconAndRejectsUnknown() {
        let a = descriptor([(255, 0, 0), (0, 0, 255), (0, 255, 0), (255, 255, 0)])
        let b = descriptor([(0, 0, 0), (255, 255, 255), (255, 255, 255), (0, 0, 0)])
        let matcher = IconMatcher(entries: [.init(label: "A", descriptor: a), .init(label: "B", descriptor: b)])

        // Same icon, darker (brightness change) -> still A.
        let darker = descriptor([(200, 0, 0), (0, 0, 200), (0, 200, 0), (200, 200, 0)])
        guard case let .match(label, conf) = matcher.recognize(darker, allowEmpty: false) else {
            return XCTFail("expected a match")
        }
        XCTAssertEqual(label, "A")
        XCTAssertGreaterThan(conf, 0.5)

        // Something unrelated -> uncertain, never a made-up label.
        let other = descriptor([(0, 255, 255), (128, 0, 128), (0, 128, 128), (255, 128, 0)])
        if case .match = matcher.recognize(other, allowEmpty: false) { XCTFail("unrelated icon must not match") }
    }

    func testEmptySlotDetection() {
        let flat = descriptor([(30, 30, 30)])
        let matcher = IconMatcher(entries: [])
        XCTAssertEqual(matcher.recognize(flat, allowEmpty: true), .empty)
        if case .empty = matcher.recognize(flat, allowEmpty: false) { XCTFail("heroes are never empty") }
    }

    func testFingerprintDifference() {
        let a = FrameFingerprint(gray: [UInt8](repeating: 100, count: 64), width: 8, height: 8)
        let b = FrameFingerprint(gray: [UInt8](repeating: 104, count: 64), width: 8, height: 8)
        XCTAssertEqual(a.difference(to: b), 4, accuracy: 0.001)
        XCTAssertEqual(a.difference(to: a), 0)
    }

    func testContentRectTrimsBlackBars() {
        let w = 40, h = 20
        var g = [UInt8](repeating: 0, count: w * h)
        for y in 0..<h { for x in 5..<35 { g[y * w + x] = 120 } }
        let r = ContentRectDetector.detect(gray: g, width: w, height: h)
        XCTAssertEqual(r.x, 5.0 / 40, accuracy: 0.001)
        XCTAssertEqual(r.width, 30.0 / 40, accuracy: 0.001)
        XCTAssertEqual(r.height, 1, accuracy: 0.001)
    }

    func testRegionCellsMapPlayersAndItems() {
        let grid = LayoutRegion(kind: .scoreEnemyItems, rect: NormalizedRect(x: 0.5, y: 0.2, width: 0.3, height: 0.5))
        let cells = grid.cells()
        XCTAssertEqual(cells.count, 30)
        let c = cells.first { $0.player == 2 && $0.itemIndex == 3 }!
        XCTAssertEqual(c.rect.x, 0.5 + 3 * 0.05, accuracy: 1e-9)
        XCTAssertEqual(c.rect.y, 0.2 + 2 * 0.1, accuracy: 1e-9)

        let picks = LayoutRegion(kind: .draftAllyPicks, rect: NormalizedRect(x: 0.0, y: 0.1, width: 0.1, height: 0.8))
        XCTAssertEqual(picks.playerBand(containing: 0.2, 0.1 + 0.16 * 3 + 0.01), 3)
        XCTAssertNil(picks.playerBand(containing: 0.9, 0.5))
    }
}

final class TrackerTests: XCTestCase {
    func testSlotNeedsSeveralVotesAndResistsNoise() {
        var t = SlotTracker(allowsEmpty: false)
        let now = Date()
        t.observe(.match(label: "Selena", confidence: 0.9), at: now)
        XCTAssertNil(t.state.label, "one frame is not enough")
        t.observe(.match(label: "Selena", confidence: 0.9), at: now)
        t.observe(.match(label: "Selena", confidence: 0.9), at: now)
        XCTAssertEqual(t.state.label, "Selena")
        t.observe(.match(label: "Ling", confidence: 0.95), at: now)          // one noisy frame
        t.observe(.uncertain(bestGuess: "Ling", confidence: 0.3), at: now)
        XCTAssertEqual(t.state.label, "Selena")
    }

    func testItemSlotBecomesEmptyAfterSale() {
        var t = SlotTracker(allowsEmpty: true)
        let now = Date()
        for _ in 0..<3 { t.observe(.match(label: "Blade of Despair", confidence: 0.9), at: now) }
        XCTAssertEqual(t.state.label, "Blade of Despair")
        for _ in 0..<6 { t.observe(.empty, at: now) }
        XCTAssertNil(t.state.label)
        XCTAssertTrue(t.state.isEmpty)
    }

    func testMatchTrackerSnapshotAndUnknowns() {
        var m = MatchTracker()
        let db = TestData.database
        for _ in 0..<3 {
            var o = FrameObservation(time: Date())
            o.screenEvidence[.draft] = 1
            o.heroes[HeroSlotID(source: .draft, side: .ally, index: 0)] = .match(label: "Selena", confidence: 0.9)
            o.heroes[HeroSlotID(source: .draft, side: .enemy, index: 1)] = .uncertain(bestGuess: "Ling", confidence: 0.3)
            o.mySlotHint = HeroSlotID(source: .draft, side: .ally, index: 0)
            m.ingest(o)
        }
        let s = m.snapshot(database: db, mySlotOverride: nil)
        XCTAssertEqual(s.screen, .draft)
        XCTAssertEqual(s.allies[0].hero.hero?.name, "Selena")
        XCTAssertEqual(s.me?.hero.label, "Selena")
        XCTAssertEqual(s.enemies[1].hero.status, .unknown)
        XCTAssertNil(s.enemies[1].hero.hero, "uncertain slots must not invent a hero")
        XCTAssertEqual(s.enemies[2].hero.status, .notSeen)
    }

    func testDuplicateHeroIsResolved() {
        var m = MatchTracker()
        for _ in 0..<3 {
            var o = FrameObservation(time: Date())
            o.heroes[HeroSlotID(source: .draft, side: .ally, index: 0)] = .match(label: "Ling", confidence: 0.95)
            o.heroes[HeroSlotID(source: .draft, side: .enemy, index: 0)] = .match(label: "Ling", confidence: 0.6)
            m.ingest(o)
        }
        let s = m.snapshot(database: TestData.database, mySlotOverride: nil)
        XCTAssertEqual(s.allies[0].hero.label, "Ling")
        XCTAssertNil(s.enemies[0].hero.label)
    }

    func testNewDraftResetsMatch() {
        var m = MatchTracker()
        func feed(_ screen: GameScreen, _ hero: String?) {
            for _ in 0..<4 {
                var o = FrameObservation(time: Date())
                o.screenEvidence[screen] = 1
                if let hero { o.heroes[HeroSlotID(source: .scoreboard, side: .ally, index: 0)] = .match(label: hero, confidence: 0.9) }
                m.ingest(o)
            }
        }
        feed(.scoreboard, "Selena")
        XCTAssertEqual(m.snapshot(database: TestData.database, mySlotOverride: nil).allies[0].hero.label, "Selena")
        feed(.draft, nil)
        XCTAssertEqual(m.matchCount, 1)
        XCTAssertNil(m.snapshot(database: TestData.database, mySlotOverride: nil).allies[0].hero.label)
    }
}
