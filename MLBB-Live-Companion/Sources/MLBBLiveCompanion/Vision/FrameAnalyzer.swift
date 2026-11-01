import CoreGraphics
import Foundation
import MLBBCore

struct AnchorDescriptor {
    let anchor: StateAnchor
    let descriptor: IconDescriptor
}

/// Everything the analysis queue needs, copied from the main actor.
struct AnalysisConfig {
    var layout: LayoutProfile = .empty
    var heroMatcher = IconMatcher()
    var itemMatcher = IconMatcher()
    var anchors: [AnchorDescriptor] = []
    var playerName: String = ""
    /// Seconds between analysed frames.
    var interval: Double = 0.5
    /// Run OCR on every n-th analysed frame (OCR is the most expensive step).
    var ocrEvery: Int = 4
    /// Mean grey-level difference below which a frame counts as unchanged.
    var duplicateThreshold: Double = 1.5
}

struct RegionDiagnostics: Identifiable {
    var id: RegionKind { kind }
    let kind: RegionKind
    let matchedCells: Int
    let totalCells: Int
    let accepted: Bool
}

struct FrameAnalysis {
    let observation: FrameObservation
    let contentRect: NormalizedRect
    let contentImage: CGImage
    let durationMs: Double
    let ocrTexts: [String]?
    let regions: [RegionDiagnostics]
}

/// Turns one captured frame into a FrameObservation (screen evidence + recognised slots).
/// Pure function of its inputs; runs on the analysis queue.
enum FrameAnalyzer {
    /// A hero grid is trusted only when at least this share of its cells matched confidently.
    /// This is what stops item/hero detection from firing on unrelated screens.
    static let regionAcceptRatio = 0.4

    static func analyze(_ frame: CGImage, at time: Date, config: AnalysisConfig, runOCR: Bool) -> FrameAnalysis {
        let start = Date()
        // 1. Locate the game picture inside the window (trim letterbox bars).
        let thumbW = 160
        let thumbH = max(8, Int(Double(frame.height) * Double(thumbW) / Double(max(1, frame.width))))
        let contentRect = ContentRectDetector.detect(gray: ImageTools.gray(frame, width: thumbW, height: thumbH),
                                                     width: thumbW, height: thumbH)
        let content = ImageTools.crop(frame, contentRect) ?? frame

        var obs = FrameObservation(time: time)
        var evidence: [GameScreen: Double] = [:]
        var diagnostics: [RegionDiagnostics] = []
        var ratios: [RegionKind: Double] = [:]

        // 2. Hero grids.
        for region in config.layout.regions where region.kind.isHeroGrid {
            guard let side = region.kind.side else { continue }
            var results: [(Int, Recognition)] = []
            var matched = 0
            for cell in region.cells() {
                guard let crop = ImageTools.crop(content, cell.rect) else { continue }
                let r = config.heroMatcher.recognize(ImageTools.descriptor(crop), allowEmpty: false)
                if case .match = r { matched += 1 }
                results.append((cell.player, r))
            }
            let ratio = results.isEmpty ? 0 : Double(matched) / Double(results.count)
            ratios[region.kind] = ratio
            evidence[region.kind.screen] = max(evidence[region.kind.screen] ?? 0, ratio >= regionAcceptRatio ? min(1, ratio + 0.3) : 0)
            let accepted = ratio >= regionAcceptRatio
            diagnostics.append(RegionDiagnostics(kind: region.kind, matchedCells: matched, totalCells: results.count, accepted: accepted))
            if accepted {
                for (player, r) in results where player < 5 {
                    obs.heroes[HeroSlotID(source: region.kind.source, side: side, index: player)] = r
                }
            }
        }

        // 3. Item grids — only while the scoreboard heroes are visible.
        let scoreboardVisible = max(ratios[.scoreAllyHeroes] ?? 0, ratios[.scoreEnemyHeroes] ?? 0) >= regionAcceptRatio
        for region in config.layout.regions where region.kind.isItemGrid {
            guard let side = region.kind.side else { continue }
            var matched = 0
            var total = 0
            if scoreboardVisible {
                for cell in region.cells() where cell.player < 5 && cell.itemIndex < 6 {
                    guard let crop = ImageTools.crop(content, cell.rect) else { continue }
                    let r = config.itemMatcher.recognize(ImageTools.descriptor(crop), allowEmpty: true)
                    total += 1
                    switch r {
                    case .match, .empty: matched += 1
                    case .uncertain: break
                    }
                    obs.items[ItemSlotID(side: side, player: cell.player, index: cell.itemIndex)] = r
                }
            }
            diagnostics.append(RegionDiagnostics(kind: region.kind, matchedCells: matched, totalCells: total, accepted: scoreboardVisible))
        }

        // 4. State anchors (user-captured reference crops).
        for a in config.anchors {
            guard let crop = ImageTools.crop(content, a.anchor.rect) else { continue }
            let sim = ImageTools.descriptor(crop, inset: 0).similarity(to: a.descriptor)
            if sim >= 0.8 { evidence[a.anchor.screen] = max(evidence[a.anchor.screen] ?? 0, min(1, (sim - 0.7) / 0.25)) }
        }

        // 5. OCR: screen keywords, player name -> my slot, game clock.
        var texts: [String]?
        if runOCR {
            let lines = TextReader.read(ImageTools.scaled(content, maxWidth: 1600))
            texts = lines.map(\.text)
            let all = NameMatcher.normalize(lines.map(\.text).joined(separator: " "))
            for (screenRaw, words) in config.layout.stateKeywords {
                guard let screen = GameScreen(rawValue: screenRaw) else { continue }
                let hits = words.filter { w in
                    let n = NameMatcher.normalize(w)
                    return !n.isEmpty && all.contains(n)
                }.count
                if hits > 0 { evidence[screen] = max(evidence[screen] ?? 0, min(1, 0.45 * Double(hits))) }
            }
            if !config.playerName.trimmingCharacters(in: .whitespaces).isEmpty {
                outer: for line in lines where NameMatcher.textMatchesName(line.text, name: config.playerName) {
                    for region in config.layout.regions where region.kind.isHeroGrid && region.kind.side == .ally {
                        if let slot = region.playerBand(containing: line.box.midX, line.box.midY), slot < 5 {
                            obs.mySlotHint = HeroSlotID(source: region.kind.source, side: .ally, index: slot)
                            break outer
                        }
                    }
                }
            }
            if let timer = config.layout.region(.gameTimer), let crop = ImageTools.crop(content, timer.rect) {
                let timerLines = TextReader.read(ImageTools.scaled(crop, maxWidth: 400), accurate: true, minimumTextHeight: 0.1)
                obs.gameClockSeconds = timerLines.lazy.compactMap { GameClockParser.parse($0.text) }.first
            }
        }
        if obs.gameClockSeconds != nil && (evidence[.scoreboard] ?? 0) < 0.4 {
            evidence[.inGame] = max(evidence[.inGame] ?? 0, 0.7)
        }
        obs.screenEvidence = evidence

        return FrameAnalysis(observation: obs, contentRect: contentRect, contentImage: content,
                             durationMs: Date().timeIntervalSince(start) * 1000, ocrTexts: texts, regions: diagnostics)
    }
}
