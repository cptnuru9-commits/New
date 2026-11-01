import AppKit
import MLBBCore
import SwiftUI

struct LibraryView: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var library: TemplateLibrary
    @State private var kind: TemplateKind = .hero
    @State private var message: String?

    private let columns = [GridItem(.adaptive(minimum: 92), spacing: 10)]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Picker("", selection: $kind) {
                    ForEach(TemplateKind.allCases) { Text($0.title).tag($0) }
                }
                .pickerStyle(.segmented)
                .frame(width: 240)
                .labelsHidden()
                Text(coverage).font(.caption).foregroundStyle(Theme.textDim)
                Spacer()
                Button { importFolder() } label: { Label("ייבוא תיקייה…", systemImage: "folder.badge.plus") }
                Button { NSWorkspace.shared.open(library.root) } label: { Label("פתיחה ב-Finder", systemImage: "folder") }
                Button { library.reload() } label: { Label("רענון", systemImage: "arrow.clockwise") }
            }
            if let message { Text(message).font(.caption).foregroundStyle(Theme.textDim) }
            Text("האייקונים נשמרים רק במחשב שלכם (\(library.root.path)). אפשר לתייג אותם ישירות מהמשחק במסך Calibration, או לייבא תיקייה עם קבצים בשם הגיבור/החפץ (למשל Selena.png).")
                .font(.caption2).foregroundStyle(Theme.textFaint)
            ScrollView {
                let groups = Dictionary(grouping: library.samples[kind] ?? [], by: \.label)
                if groups.isEmpty {
                    Text("אין עדיין אייקונים מסוג זה.").foregroundStyle(Theme.textDim).padding(.top, 40)
                }
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(groups.keys.sorted(), id: \.self) { label in
                        let list = groups[label] ?? []
                        VStack(spacing: 4) {
                            if let first = list.first {
                                Image(decorative: first.image, scale: 1).resizable().aspectRatio(contentMode: .fill)
                                    .frame(width: 64, height: 64).clipShape(RoundedRectangle(cornerRadius: 10))
                            }
                            Text(label == IconMatcher.emptyLabel ? "(Empty)" : label).font(.caption).lineLimit(1)
                            Text("\(list.count) דוגמאות").font(.caption2).foregroundStyle(Theme.textFaint)
                        }
                        .padding(8)
                        .background(RoundedRectangle(cornerRadius: 10).fill(Theme.panel))
                        .contextMenu {
                            ForEach(list) { s in
                                Button("מחיקת דוגמה \(s.url.lastPathComponent.prefix(8))") { library.delete(s) }
                            }
                        }
                    }
                }
            }
        }
        .padding(20)
    }

    private var coverage: String {
        guard let db = model.database else { return "" }
        let total = kind == .hero ? db.heroes.count : db.items.count
        let have = library.labels(kind).filter { $0 != IconMatcher.emptyLabel }.count
        return "\(have)/\(total) עם אייקון"
    }

    private func importFolder() {
        guard let db = model.database else { return }
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        guard panel.runModal() == .OK, let url = panel.url else { return }
        let result = library.importFolder(url, kind: kind, database: db)
        message = "יובאו \(result.imported) תמונות." + (result.skipped.isEmpty ? "" : " דולגו (שם לא מזוהה): \(result.skipped.prefix(10).joined(separator: ", "))")
    }
}

struct DatabaseView: View {
    @EnvironmentObject var model: AppModel
    @State private var query = ""
    @State private var showItems = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Card(title: "Local Game Database", systemImage: "books.vertical") {
                if let db = model.database {
                    Text("מקור: \(db.sourceURL?.path ?? "—")").font(.caption).textSelection(.enabled)
                    Text("\(db.heroes.count) גיבורים · \(db.items.count) חפצים · \(db.templates.count) תבניות · נבדק לאחרונה \(db.lastReviewed)")
                        .font(.caption).foregroundStyle(Theme.textDim)
                    ForEach(db.notes, id: \.self) { Text("• " + $0).font(.caption2).foregroundStyle(Theme.textFaint) }
                    Text("⚠️ המאגר אינו מתעדכן לבד. אחרי כל Patch גדול כדאי לבדוק שמות חפצים, יכולות ותבניות בילד. אין בו Win Rate או נתוני Meta.")
                        .font(.caption).foregroundStyle(Theme.warn)
                    if !model.databaseProblems.isEmpty {
                        ForEach(model.databaseProblems, id: \.self) { Text($0).font(.caption).foregroundStyle(Theme.bad) }
                    }
                }
                if let e = model.databaseError { Text(e).foregroundStyle(Theme.bad) }
                HStack {
                    Button("עותק לעריכה ופתיחה ב-Finder") { model.openEditableDatabase() }
                    Button("טעינה מחדש") { model.reloadDatabase() }
                }
            }
            HStack {
                Picker("", selection: $showItems) {
                    Text("Heroes").tag(false)
                    Text("Items").tag(true)
                }
                .pickerStyle(.segmented)
                .frame(width: 200)
                .labelsHidden()
                TextField("חיפוש…", text: $query).textFieldStyle(.roundedBorder).frame(width: 240)
            }
            if let db = model.database {
                let q = NameMatcher.normalize(query)
                if showItems {
                    List(db.items.filter { q.isEmpty || NameMatcher.normalize($0.name).contains(q) }) { it in
                        HStack(alignment: .top, spacing: 10) {
                            ItemIcon(item: it, size: 30)
                            VStack(alignment: .leading, spacing: 2) {
                                HStack {
                                    Text(it.name).bold()
                                    Tag(text: it.category.rawValue)
                                }
                                Text(it.effect).font(.caption)
                                Text("מחיר: \(it.tradeoff)").font(.caption2).foregroundStyle(Theme.textDim)
                            }
                        }
                    }
                } else {
                    List(db.heroes.filter { q.isEmpty || NameMatcher.normalize($0.name).contains(q) }) { h in
                        HStack(spacing: 10) {
                            HeroAvatar(name: h.name, size: 30)
                            Text(h.name).bold().frame(width: 130, alignment: .leading)
                            ForEach(h.roles, id: \.self) { Tag(text: $0, color: Theme.roleColor($0)) }
                            DamageBadge(type: h.damageType)
                            Text("CC \(h.cc) · Heal \(h.healing) · Shield \(h.shields) · Mobility \(h.mobility) · Tank \(h.tankiness)")
                                .font(.caption.monospacedDigit()).foregroundStyle(Theme.textDim)
                            Spacer()
                            Tag(text: h.profileSource, color: h.isCuratedProfile ? Theme.good : Theme.warn)
                        }
                    }
                }
            }
        }
        .padding(20)
    }
}
