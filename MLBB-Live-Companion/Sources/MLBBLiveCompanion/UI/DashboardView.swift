import MLBBCore
import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var model: AppModel
    let goTo: (AppSection) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                ConnectionStatusBar(goTo: goTo)
                SetupHints(goTo: goTo)
                HStack(alignment: .top, spacing: 16) {
                    VStack(spacing: 16) {
                        MyHeroCard()
                        AllyTeamCard()
                    }
                    .frame(width: 340)
                    VStack(spacing: 16) {
                        BuyNowCard()
                        RecommendedBuildCard()
                    }
                    .frame(maxWidth: .infinity)
                    VStack(spacing: 16) {
                        EnemyTeamCard()
                        ThreatCard()
                        CompositionCard()
                    }
                    .frame(width: 380)
                }
            }
            .padding(20)
        }
        .animation(.easeInOut(duration: 0.25), value: model.snapshot)
        .animation(.easeInOut(duration: 0.25), value: model.recommendation)
    }
}

// MARK: - Status

struct ConnectionStatusBar: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var devices: IOSDeviceMonitor
    let goTo: (AppSection) -> Void

    var body: some View {
        HStack(spacing: 10) {
            StatusPill(title: "iPad (USB)",
                       detail: devices.isConnected ? devices.deviceNames.joined(separator: ", ") : "לא זוהה",
                       color: devices.isConnected ? Theme.good : Theme.warn, live: devices.isConnected)
            StatusPill(title: "Screen Capture", detail: captureDetail, color: captureColor, live: model.captureState.isRunning)
                .onTapGesture { goTo(.capture) }
            StatusPill(title: "Detection", detail: detectionDetail,
                       color: model.detectionActive ? Theme.good : Theme.warn, live: model.detectionActive)
                .onTapGesture { goTo(.calibration) }
            StatusPill(title: "Game State",
                       detail: "\(model.snapshot.screen.displayName)" + (model.snapshot.screen == .unknown ? "" : " · \(Int(model.snapshot.screenConfidence * 100))%"),
                       color: model.snapshot.screen == .unknown ? Theme.textFaint : Theme.accent, live: false)
            VStack(alignment: .leading, spacing: 2) {
                Text("LAST UPDATE").font(.system(size: 9, weight: .bold)).foregroundStyle(Theme.textFaint)
                TimeAgo(date: model.snapshot.lastUpdate).font(.system(size: 13, weight: .semibold))
            }
            .padding(.horizontal, 12)
            Spacer()
            if let clock = model.snapshot.gameClockSeconds {
                Label(String(format: "%d:%02d", clock / 60, clock % 60), systemImage: "clock")
                    .font(.system(size: 14, weight: .semibold, design: .monospaced))
            }
            Button { model.newMatch() } label: { Label("New Match", systemImage: "arrow.counterclockwise") }
                .help("איפוס הזיהוי למשחק חדש (⇧⌘N)")
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.panel))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.stroke))
    }

    var captureDetail: String {
        switch model.captureState {
        case .running:
            return String(format: "%.0f fps · %.0f ms", model.stats.previewFPS, model.stats.analysisMs)
        case .starting: return "מתחבר…"
        case .failed: return "שגיאה"
        case .idle:
            if case .still(let name) = model.source { return "תמונה: \(name)" }
            return "כבויה"
        }
    }

    var captureColor: Color {
        switch model.captureState {
        case .running: return Theme.good
        case .starting: return Theme.warn
        case .failed: return Theme.bad
        case .idle:
            if case .still = model.source { return Theme.accent }
            return Theme.textFaint
        }
    }

    var detectionDetail: String {
        if !model.layout.isCalibrated { return "דרוש כיול" }
        if model.library.count(.hero) == 0 { return "אין אייקונים בספרייה" }
        return model.isAnalysisFresh ? "פעיל" : "ממתין לתמונה"
    }
}

struct StatusPill: View {
    let title: String
    let detail: String
    let color: Color
    let live: Bool

    var body: some View {
        HStack(spacing: 8) {
            PulsingDot(color: color, active: live)
            VStack(alignment: .leading, spacing: 1) {
                Text(title.uppercased()).font(.system(size: 9, weight: .bold)).foregroundStyle(Theme.textFaint)
                Text(detail).font(.system(size: 12, weight: .semibold)).lineLimit(1)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(RoundedRectangle(cornerRadius: 10).fill(Theme.panelRaised))
    }
}

struct SetupHints: View {
    @EnvironmentObject var model: AppModel
    let goTo: (AppSection) -> Void

    var body: some View {
        let hints = currentHints
        if !hints.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(hints) { hint in
                    HStack {
                        Image(systemName: "info.circle.fill").foregroundStyle(Theme.warn)
                        Text(hint.text).font(.callout)
                        Spacer()
                        Button(hint.section.title) { goTo(hint.section) }
                    }
                }
            }
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 12).fill(Theme.warn.opacity(0.08)))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.warn.opacity(0.3)))
        }
    }

    struct Hint: Identifiable {
        let text: String
        let section: AppSection
        var id: String { text }
    }

    var currentHints: [Hint] {
        var h: [Hint] = []
        if let e = model.databaseError { h.append(Hint(text: "מאגר הנתונים לא נטען: \(e)", section: .database)) }
        if !model.hasScreenPermission { h.append(Hint(text: "נדרשת הרשאת Screen Recording כדי ללכוד את חלון QuickTime.", section: .capture)) }
        else if model.source == .off { h.append(Hint(text: "בחרו את חלון QuickTime Player והתחילו לכידה (או טענו צילום מסך לבדיקה).", section: .capture)) }
        if !model.layout.isCalibrated { h.append(Hint(text: "סמנו פעם אחת את אזורי הגיבורים והחפצים על פריים מהמשחק.", section: .calibration)) }
        if model.library.count(.hero) == 0 { h.append(Hint(text: "ספריית האייקונים ריקה — תייגו אייקונים מתוך פריים או ייבאו תיקייה.", section: .calibration)) }
        if model.playerName.isEmpty && model.mySlotOverride == nil {
            h.append(Hint(text: "הזינו את שם השחקן שלכם (פעם אחת) כדי שהאפליקציה תזהה איזה גיבור הוא שלכם.", section: .capture))
        }
        return h
    }
}

// MARK: - My hero

struct MyHeroCard: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        Card(title: "My Hero", systemImage: "person.crop.circle") {
            if let me = model.snapshot.me, let hero = me.hero.hero {
                HStack(alignment: .top, spacing: 14) {
                    HeroAvatar(name: hero.name, size: 84, ring: Theme.gold)
                    VStack(alignment: .leading, spacing: 6) {
                        Text(hero.name).font(.system(size: 24, weight: .bold))
                        HStack(spacing: 4) {
                            ForEach(hero.roles, id: \.self) { Tag(text: $0, color: Theme.roleColor($0)) }
                            DamageBadge(type: hero.damageType)
                        }
                        HStack(spacing: 6) {
                            ConfidenceBadge(confidence: me.hero.confidence)
                            Text(model.snapshot.mySlotSource == "manual" ? "נבחר ידנית" : "זוהה לפי שם השחקן")
                                .font(.caption).foregroundStyle(Theme.textDim)
                        }
                        if let rec = model.recommendation {
                            Text("\(rec.archetype.displayName) · \(rec.lane?.displayName ?? "—") · \(rec.phase.hebrew)")
                                .font(.caption).foregroundStyle(Theme.textDim)
                        }
                    }
                }
                if let rec = model.recommendation, !rec.emblem.isEmpty {
                    VStack(alignment: .leading, spacing: 3) {
                        Label(rec.emblem, systemImage: "seal").font(.caption)
                        Label(rec.spell, systemImage: "wand.and.stars").font(.caption)
                    }
                    .foregroundStyle(Theme.textDim)
                }
                Divider().overlay(Theme.stroke)
                Text("CURRENT ITEMS").font(.system(size: 10, weight: .bold)).foregroundStyle(Theme.textFaint)
                if me.items.isEmpty {
                    Text(me.itemsObserved ? "אין חפצים בסלוטים" : "החפצים יופיעו כשתפתחו את לוח התוצאות במשחק")
                        .font(.caption).foregroundStyle(Theme.textDim)
                } else {
                    HStack(spacing: 6) {
                        ForEach(me.items) { di in ItemIcon(item: di.item, size: 38, owned: true) }
                    }
                    TimeAgo(date: me.itemsLastSeen, prefix: "נצפו ").font(.caption2).foregroundStyle(Theme.textFaint)
                }
            } else {
                WhoAmIPicker()
            }
        }
    }
}

/// Shown until the player's own hero is known.
struct WhoAmIPicker: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                HeroAvatar(name: nil, size: 64, unknown: true)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Unknown").font(.title2.bold())
                    Text(explanation).font(.caption).foregroundStyle(Theme.textDim)
                }
            }
            let known = model.snapshot.allies.filter { $0.hero.hero != nil }
            if !known.isEmpty {
                Text("או לחצו על הגיבור שלכם:").font(.caption).foregroundStyle(Theme.textDim)
                HStack(spacing: 6) {
                    ForEach(known) { p in
                        Button { model.mySlotOverride = p.hero.index } label: {
                            HeroAvatar(name: p.hero.label, size: 40)
                        }
                        .buttonStyle(.plain)
                        .help(p.hero.label ?? "")
                    }
                }
            }
        }
    }

    var explanation: String {
        if model.snapshot.allies.allSatisfy({ $0.hero.status == .notSeen }) { return "הגיבורים של הקבוצה שלכם עוד לא הופיעו על המסך." }
        if model.playerName.isEmpty { return "הזינו את שם השחקן בהגדרות כדי לזהות אוטומטית מי אתם." }
        return "שם השחקן עוד לא נקרא על המסך ליד אחד הגיבורים."
    }
}

struct AllyTeamCard: View {
    @EnvironmentObject var model: AppModel
    var body: some View {
        Card(title: "My Team", systemImage: "person.3.fill") {
            ForEach(model.snapshot.allies) { p in PlayerRow(player: p, showThreat: false) }
        }
    }
}

// MARK: - Recommendations

struct BuyNowCard: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        Card(title: "AI Recommendation — Buy Now", systemImage: "sparkles", trailing: phaseTag) {
            if let rec = model.recommendation, let step = rec.buyNow {
                HStack(alignment: .top, spacing: 16) {
                    ItemIcon(item: step.item, size: 76, highlight: true)
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(step.item.name).font(.system(size: 22, weight: .bold))
                            Tag(text: step.kind.label, color: step.kind == .counter ? Theme.gold : Theme.accent)
                        }
                        Text(step.reason).font(.system(size: 13)).fixedSize(horizontal: false, vertical: true)
                        if !step.effectiveAgainst.isEmpty {
                            HStack(spacing: 6) {
                                Text("יעיל נגד:").font(.caption.bold()).foregroundStyle(Theme.textDim)
                                ForEach(step.effectiveAgainst, id: \.self) { n in
                                    HStack(spacing: 4) {
                                        HeroAvatar(name: n, size: 22, ring: Theme.enemy.opacity(0.6))
                                        Text(n).font(.caption)
                                    }
                                }
                            }
                        }
                        Text("מחיר: \(step.tradeoff)").font(.caption).foregroundStyle(Theme.textDim)
                        HStack(spacing: 18) {
                            if let next = step.nextItemName {
                                Label("אחריו: \(next)", systemImage: "arrow.forward.circle").font(.caption)
                            }
                            if let alt = step.alternative {
                                Label("חלופה: \(alt.item.name) — \(alt.condition)", systemImage: "arrow.triangle.branch").font(.caption)
                            }
                        }
                        .foregroundStyle(Theme.textDim)
                    }
                }
                .id(step.item.id)
                .transition(.opacity.combined(with: .move(edge: .top)))
                ForEach(rec.warnings, id: \.self) { w in
                    Label(w, systemImage: "exclamationmark.triangle").font(.caption).foregroundStyle(Theme.warn)
                }
            } else if model.recommendation != nil {
                Text("כל החפצים בבילד כבר נקנו.").foregroundStyle(Theme.textDim)
            } else {
                Text("ההמלצה תופיע אחרי שהגיבור שלכם יזוהה.").foregroundStyle(Theme.textDim)
            }
        }
    }

    var phaseTag: AnyView? {
        guard let rec = model.recommendation else { return nil }
        return AnyView(Tag(text: rec.phase.hebrew, color: Theme.accent))
    }
}

struct RecommendedBuildCard: View {
    @EnvironmentObject var model: AppModel
    @State private var expanded: String?

    var body: some View {
        Card(title: "Recommended Build", systemImage: "list.number",
             trailing: model.recommendation.map { AnyView(Text($0.templateLabel).font(.caption).foregroundStyle(Theme.textDim)) }) {
            if let rec = model.recommendation {
                HStack(spacing: 10) {
                    ForEach(rec.steps) { s in
                        VStack(spacing: 4) {
                            ItemIcon(item: s.item, size: 52, owned: s.owned, highlight: s.id == rec.buyNow?.id)
                            Text("\(s.position)").font(.system(size: 10, weight: .bold, design: .monospaced)).foregroundStyle(Theme.textFaint)
                        }
                        if s.id != rec.steps.last?.id {
                            Image(systemName: "chevron.right").font(.system(size: 10)).foregroundStyle(Theme.textFaint)
                        }
                    }
                }
                VStack(spacing: 6) {
                    ForEach(rec.steps) { s in BuildStepRow(step: s, expanded: expanded == s.id) { expanded = expanded == s.id ? nil : s.id } }
                }
            } else {
                Text("—").foregroundStyle(Theme.textDim)
            }
        }
    }
}

struct BuildStepRow: View {
    let step: BuildStep
    let expanded: Bool
    let toggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                Text("\(step.position)").font(.system(size: 12, weight: .bold, design: .monospaced)).foregroundStyle(Theme.textFaint).frame(width: 18)
                ItemIcon(item: step.item, size: 30, owned: step.owned)
                Text(step.item.name).font(.system(size: 13, weight: .semibold))
                Tag(text: step.kind.label, color: step.kind == .counter ? Theme.gold : (step.kind == .core ? Theme.accent : Theme.textDim))
                if step.owned { Tag(text: "Owned", color: Theme.good) }
                Spacer()
                Image(systemName: expanded ? "chevron.up" : "chevron.down").foregroundStyle(Theme.textFaint)
            }
            if expanded {
                VStack(alignment: .leading, spacing: 4) {
                    Text(step.reason).font(.caption)
                    if !step.effectiveAgainst.isEmpty {
                        Text("יעיל נגד: \(step.effectiveAgainst.joined(separator: ", "))").font(.caption).foregroundStyle(Theme.textDim)
                    }
                    Text("מחיר: \(step.tradeoff)").font(.caption).foregroundStyle(Theme.textDim)
                    if let alt = step.alternative {
                        Text("חלופה: \(alt.item.name) — \(alt.condition)").font(.caption).foregroundStyle(Theme.textDim)
                    }
                    if let next = step.nextItemName { Text("אחריו: \(next)").font(.caption).foregroundStyle(Theme.textDim) }
                }
                .padding(.leading, 28)
                .transition(.opacity)
            }
        }
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 10).fill(Theme.panelRaised.opacity(expanded ? 1 : 0.5)))
        .contentShape(Rectangle())
        .onTapGesture { withAnimation(.easeInOut(duration: 0.2)) { toggle() } }
    }
}

// MARK: - Enemy team

struct EnemyTeamCard: View {
    @EnvironmentObject var model: AppModel
    var body: some View {
        Card(title: "Enemy Team", systemImage: "flame.fill") {
            ForEach(model.snapshot.enemies) { p in PlayerRow(player: p, showThreat: true) }
        }
    }
}

struct PlayerRow: View {
    let player: PlayerSnapshot
    let showThreat: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            HeroAvatar(name: player.hero.label, size: 44,
                       ring: player.isMe ? Theme.gold : (player.hero.side == .enemy ? Theme.enemy.opacity(0.5) : Theme.ally.opacity(0.5)),
                       unknown: player.hero.status == .unknown)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(title).font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(player.hero.status == .confirmed ? Theme.text : Theme.textDim)
                    if player.hero.status == .confirmed {
                        ConfidenceBadge(confidence: player.hero.confidence)
                        if let h = player.hero.hero { DamageBadge(type: h.damageType) }
                    }
                    if player.isMe { Tag(text: "YOU", color: Theme.gold) }
                }
                if showThreat, let h = player.hero.hero {
                    Text(ThreatAnalyzer.mainThreat(of: h)).font(.caption).foregroundStyle(Theme.textDim)
                }
                if player.hero.status == .unknown, let g = player.hero.bestGuess {
                    Text("השערה לא ודאית: \(g) (\(Int(player.hero.bestGuessConfidence * 100))%)").font(.caption2).foregroundStyle(Theme.textFaint)
                }
                if !player.items.isEmpty {
                    HStack(spacing: 3) { ForEach(player.items) { ItemIcon(item: $0.item, size: 22) } }
                } else if player.hero.status == .confirmed {
                    Text(player.itemsObserved ? "אין חפצים" : "חפצים: עוד לא נצפו").font(.caption2).foregroundStyle(Theme.textFaint)
                }
            }
            Spacer()
            TimeAgo(date: player.hero.lastSeen).font(.caption2).foregroundStyle(Theme.textFaint)
        }
    }

    var title: String {
        switch player.hero.status {
        case .confirmed: return player.hero.label ?? "?"
        case .unknown: return "Unknown"
        case .notSeen: return "Slot \(player.hero.index + 1) — עוד לא נראה"
        }
    }
}

struct ThreatCard: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        Card(title: "Enemy Threats", systemImage: "exclamationmark.shield") {
            let threat = model.recommendation?.threat ?? ThreatAnalyzer.analyze(enemies: model.snapshot.enemies)
            if threat.knownEnemies == 0 {
                Text("אין עדיין גיבורי אויב מזוהים.").font(.caption).foregroundStyle(Theme.textDim)
            } else {
                DamageSplitBar(physicalShare: threat.physicalShare)
                ForEach([ThreatDimension.burst, .sustained, .cc, .healing, .shields, .dive, .tanky], id: \.self) { d in
                    ThreatBar(label: d.hebrew, value: threat[d])
                }
                if threat.unknownEnemies > 0 {
                    Text("מבוסס על \(threat.knownEnemies)/5 גיבורים מזוהים").font(.caption2).foregroundStyle(Theme.textFaint)
                }
            }
        }
    }
}

struct DamageSplitBar: View {
    let physicalShare: Double
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Physical \(Int(physicalShare * 100))%").foregroundStyle(Theme.physical)
                Spacer()
                Text("Magic \(Int((1 - physicalShare) * 100))%").foregroundStyle(Theme.magic)
            }
            .font(.caption.bold())
            GeometryReader { g in
                HStack(spacing: 2) {
                    RoundedRectangle(cornerRadius: 3).fill(Theme.physical).frame(width: max(2, g.size.width * physicalShare))
                    RoundedRectangle(cornerRadius: 3).fill(Theme.magic)
                }
            }
            .frame(height: 8)
        }
    }
}

struct ThreatBar: View {
    let label: String
    let value: Double
    var body: some View {
        HStack(spacing: 8) {
            Text(label).font(.caption).frame(width: 120, alignment: .leading)
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3).fill(Theme.panelRaised)
                    RoundedRectangle(cornerRadius: 3).fill(color).frame(width: g.size.width * min(1, value))
                }
            }
            .frame(height: 6)
        }
    }
    var color: Color { value >= 0.5 ? Theme.bad : (value >= 0.25 ? Theme.warn : Theme.good) }
}

struct CompositionCard: View {
    @EnvironmentObject var model: AppModel
    var body: some View {
        Card(title: "Composition Analysis", systemImage: "chart.bar.xaxis") {
            if let c = model.composition {
                ForEach(c.strengths, id: \.self) { Label($0, systemImage: "plus.circle.fill").font(.caption).foregroundStyle(Theme.good) }
                ForEach(c.weaknesses, id: \.self) { Label($0, systemImage: "minus.circle.fill").font(.caption).foregroundStyle(Theme.bad) }
                ForEach(c.matchupNotes, id: \.self) { Label($0, systemImage: "info.circle").font(.caption).foregroundStyle(Theme.textDim) }
                if c.strengths.isEmpty && c.weaknesses.isEmpty && c.matchupNotes.isEmpty {
                    Text("צריך לפחות 3 גיבורים מזוהים לניתוח.").font(.caption).foregroundStyle(Theme.textDim)
                }
                Text("מבוסס על פרופילי גיבורים מהמאגר המקומי — לא סטטיסטיקה חיה.").font(.caption2).foregroundStyle(Theme.textFaint)
            } else {
                Text("יופיע כשהגיבורים יזוהו.").font(.caption).foregroundStyle(Theme.textDim)
            }
        }
    }
}
