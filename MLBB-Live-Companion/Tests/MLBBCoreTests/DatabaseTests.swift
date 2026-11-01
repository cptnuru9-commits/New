import XCTest
@testable import MLBBCore

final class DatabaseTests: XCTestCase {
    func testDatabaseLoadsAndIsConsistent() {
        let db = TestData.database
        XCTAssertGreaterThan(db.heroes.count, 100)
        XCTAssertGreaterThan(db.items.count, 40)
        XCTAssertGreaterThan(db.templates.count, 15)
        XCTAssertEqual(db.validate(), [])
    }

    func testLookupIsTolerant() {
        let db = TestData.database
        XCTAssertEqual(db.hero(named: "chang'e")?.name, "Chang'e")
        XCTAssertEqual(db.hero(named: "X BORG")?.name, "X.Borg")
        XCTAssertEqual(db.hero(named: "Selenna")?.name, "Selena")   // OCR-style typo
        XCTAssertNil(db.hero(named: "Definitely Not A Hero"))
        XCTAssertEqual(db.item(named: "athenas shield")?.id, "athenas_shield")
    }

    func testEveryHeroHasATemplate() {
        let db = TestData.database
        for h in db.heroes {
            XCTAssertNotNil(db.template(for: h, lane: nil), "No template for \(h.name)")
        }
    }

    func testClockParser() {
        XCTAssertEqual(GameClockParser.parse("12:34"), 754)
        XCTAssertEqual(GameClockParser.parse(" 0O:45 "), 45)
        XCTAssertNil(GameClockParser.parse("KDA 5/2/7"))
    }

    func testNameMatching() {
        XCTAssertTrue(NameMatcher.textMatchesName("Lv.15 ShadowFox", name: "ShadowFox"))
        XCTAssertTrue(NameMatcher.textMatchesName("ShadowF0x", name: "ShadowFox"))
        XCTAssertFalse(NameMatcher.textMatchesName("Moonlight", name: "ShadowFox"))
    }
}
