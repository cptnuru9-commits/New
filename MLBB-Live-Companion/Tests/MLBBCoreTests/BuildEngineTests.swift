import XCTest
@testable import MLBBCore

final class BuildEngineTests: XCTestCase {
    let db = TestData.database
    var engine: BuildEngine { BuildEngine(database: db) }

    func hero(_ n: String) -> Hero { db.hero(named: n)! }

    func testBaseBuildWithoutEnemies() {
        let r = engine.recommend(BuildContext(myHero: hero("Selena"), enemies: TestData.enemies([nil, nil, nil, nil, nil])))
        XCTAssertEqual(r.steps.count, 6)
        XCTAssertEqual(Set(r.steps.map(\.item.id)).count, 6, "no duplicate items")
        XCTAssertTrue(r.warnings.contains { $0.contains("לא זוהו") })
        XCTAssertNotNil(r.buyNow)
    }

    func testSelenaVsMagicAndCCGetsDefensiveAnswers() {
        // Heavy magic damage + lots of CC (example from the spec).
        let enemies = TestData.enemies(["Aurora", "Kagura", "Valir", "Atlas", "Eudora"])
        let r = engine.recommend(BuildContext(myHero: hero("Selena"), enemies: enemies, gameClockSeconds: 10 * 60))
        let ids = r.steps.map(\.item.id)
        XCTAssertTrue(ids.contains("tough_boots"), "CC + magic should switch boots to Tough Boots: \(ids)")
        XCTAssertTrue(ids.contains { ["athenas_shield", "radiant_armor", "winter_crown", "oracle"].contains($0) },
                      "expected a magic-defence answer: \(ids)")
        let boots = r.steps.first { $0.kind == .boots }!
        XCTAssertTrue(boots.reason.contains("Tough Boots במקום"), boots.reason)
        XCTAssertFalse(boots.effectiveAgainst.isEmpty)
        XCTAssertLessThanOrEqual(r.steps.filter { $0.item.isDefensive }.count, Archetype.assassinMagic.maxDefensiveItems)
    }

    func testHealersTriggerAntiHeal() {
        let enemies = TestData.enemies(["Estes", "Uranus", "Alice", "Ruby", "Miya"])
        let mage = engine.recommend(BuildContext(myHero: hero("Eudora"), enemies: enemies))
        XCTAssertTrue(mage.steps.contains { $0.item.has(tag: "antiHeal") }, mage.steps.map(\.item.id).description)
        let mm = engine.recommend(BuildContext(myHero: hero("Bruno"), enemies: enemies))
        XCTAssertTrue(mm.steps.contains { $0.item.has(tag: "antiHeal") && $0.item.category == .physical },
                      mm.steps.map(\.item.id).description)
    }

    func testPhysicalAssassinsPushPhysicalDefenceForMarksman() {
        let enemies = TestData.enemies(["Ling", "Lancelot", "Hayabusa", "Natalia", "Claude"])
        let r = engine.recommend(BuildContext(myHero: hero("Layla"), enemies: enemies, gameClockSeconds: 15 * 60))
        let ids = r.steps.map(\.item.id)
        XCTAssertTrue(ids.contains { ["wind_of_nature", "blade_armor", "antique_cuirass", "twilight_armor", "warrior_boots", "immortality"].contains($0) }, ids.description)
    }

    func testOwnedItemsAreKeptAndBuyNowSkipsThem() {
        let enemies = TestData.enemies(["Aurora", "Kagura", "Valir", "Atlas", "Eudora"])
        let owned = ["Arcane Boots", "Glowing Wand"].compactMap { db.item(named: $0) }
        let r = engine.recommend(BuildContext(myHero: hero("Selena"), enemies: enemies, ownedItems: owned))
        XCTAssertTrue(r.steps.contains { $0.item.id == "arcane_boots" && $0.owned })
        XCTAssertTrue(r.steps.contains { $0.item.id == "glowing_wand" && $0.owned })
        XCTAssertFalse(r.buyNow?.owned ?? true)
        XCTAssertEqual(r.steps.count, 6)
    }

    func testEnemyItemsChangeTheThreat() {
        let plain = ThreatAnalyzer.analyze(enemies: [TestData.player("Miya", side: .enemy, index: 0)])
        let built = ThreatAnalyzer.analyze(enemies: [TestData.player("Miya", side: .enemy, index: 0,
                                                                     items: ["Haas's Claws", "Berserker's Fury"])])
        XCTAssertGreaterThan(built[.healing], plain[.healing])
        XCTAssertGreaterThan(built[.basicAttack], plain[.basicAttack])
    }

    func testCompositionReport() {
        let allies = ["Layla", "Ling", "Lancelot", "Claude", "Yi Sun-shin"].map(hero)
        let enemies = ["Estes", "Tigreal", "Atlas", "Valir", "Aurora"].map(hero)
        let r = CompositionAnalyzer.analyze(allies: allies, enemies: enemies, me: allies[0])
        XCTAssertTrue(r.weaknesses.contains { $0.contains("פיזי") })
        XCTAssertTrue(r.weaknesses.contains { $0.contains("קו קדמי") })
    }
}
