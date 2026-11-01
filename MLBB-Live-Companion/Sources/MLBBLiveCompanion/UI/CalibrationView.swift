import MLBBCore
import SwiftUI

struct PendingCrop: Identifiable {
    enum Mode { case template, anchor }
    let id = UUID()
    let image: CGImage
    let rect: NormalizedRect
    let kind: TemplateKind
    let mode: Mode
}

enum CalibrationTool: String, CaseIterable, Identifiable {
    case region, labelCell, freeCrop, anchor
    var id: String { rawValue }
    var title: String {
        switch self {
        case .region: return "1. Draw region"
        case .labelCell: return "2. Label cell"
        case .freeCrop: return "Free crop"
        case .anchor: return "State anchor"
        }
    }
    var help: String {
        switch self {
        case .region: return "גררו מלבן סביב כל העמודה/הטבלה של האזור שנבחר (למשל 5 הגיבורים של הקבוצה שלכם ב-Draft). התאימו שורות ועמודות."
        case .labelCell: return "לחצו על תא באזור מכויל כדי לשמור את האייקון שבו כדוגמה (גיבור או חפץ). מספיקה דוגמה אחת לכל אייקון; 2–3 משפרות את הדיוק."
        case .freeCrop: return "גררו מלבן סביב אייקון כלשהו ותייגו אותו."
        case .anchor: return "גררו מלבן סביב רכיב שמופיע רק במסך מסוים (למשל כותרת ה-Draft) כדי לזהות את מצב המשחק."
        }
    }
}

struct CalibrationView: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var library: TemplateLibrary
    @State private var tool: CalibrationTool = .region
    @State private var kind: RegionKind = .draftAllyPicks
    @State private var rows = 5
    @State private var cols = 1
    @State private var playersAlongRows = true
    @State private var dragStart: CGPoint?
    @State private var dragCurrent: CGPoint?
    @State private var pending: PendingCrop?

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            controls.frame(width: 320)
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Toggle("הקפאת הפריים", isOn: $model.freezeContentImage).toggleStyle(.switch)
                    Spacer()
                    if let img = model.contentImage { Text("\(img.width)×\(img.height)").font(.caption).foregroundStyle(Theme.textFaint) }
                }
                canvas
            }
        }
        .padding(20)
        .sheet(item: $pending) { crop in
            LabelSheet(crop: crop) { pending = nil }
        }
        .onChange(of: kind) { _, newKind in loadGrid(for: newKind) }
        .onAppear { loadGrid(for: kind) }
    }

    // MARK: Controls

    private var controls: some View {
        ScrollView {
            VStack(spacing: 16) {
                Card(title: "Tool", systemImage: "hand.point.up.left") {
                    Picker("", selection: $tool) {
                        ForEach(CalibrationTool.allCases) { Text($0.title).tag($0) }
                    }
                    .pickerStyle(.radioGroup)
                    .labelsHidden()
                    Text(tool.help).font(.caption).foregroundStyle(Theme.textDim)
                }
                Card(title: "Region", systemImage: "square.grid.3x3") {
                    Picker("Region", selection: $kind) {
                        ForEach(RegionKind.allCases) { k in
                            Text((model.layout.region(k) != nil ? "✓ " : "") + k.title).tag(k)
                        }
                    }
                    Stepper("שורות: \(rows)", value: $rows, in: 1...10)
                    Stepper("עמודות: \(cols)", value: $cols, in: 1...10)
                    if kind.isItemGrid {
                        Toggle("כל שורה = שחקן", isOn: $playersAlongRows)
                    }
                    HStack {
                        Button("עדכון שורות/עמודות") {
                            if var r = model.layout.region(kind) {
                                r.rows = rows
                                r.cols = cols
                                r.playersAlongRows = playersAlongRows
                                model.setRegion(r)
                            }
                        }
                        .disabled(model.layout.region(kind) == nil)
                        Button("מחיקה", role: .destructive) { model.removeRegion(kind) }
                            .disabled(model.layout.region(kind) == nil)
                    }
                }
                Card(title: "Calibration Status", systemImage: "checklist") {
                    ForEach(RegionKind.allCases) { k in
                        HStack {
                            Image(systemName: model.layout.region(k) != nil ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(model.layout.region(k) != nil ? Theme.good : Theme.textFaint)
                            Text(k.title).font(.caption)
                        }
                    }
                    Text("אייקונים בספרייה: \(library.labels(.hero).count) גיבורים, \(library.labels(.item).count) חפצים")
                        .font(.caption).foregroundStyle(Theme.textDim)
                    if !model.layout.anchors.isEmpty {
                        Text("עוגני מצב:").font(.caption.bold())
                        ForEach(model.layout.anchors) { a in
                            HStack {
                                Text(a.screen.displayName).font(.caption)
                                Spacer()
                                Button { model.removeAnchor(a) } label: { Image(systemName: "trash") }.buttonStyle(.borderless)
                            }
                        }
                    }
                    Button("איפוס כל הכיול", role: .destructive) { model.resetLayout() }
                }
            }
        }
    }

    private func loadGrid(for k: RegionKind) {
        if let r = model.layout.region(k) {
            rows = r.rows
            cols = r.cols
            playersAlongRows = r.playersAlongRows
        } else {
            rows = k.defaultRows
            cols = k.defaultCols
            playersAlongRows = true
        }
    }

    // MARK: Canvas

    private var canvas: some View {
        GeometryReader { geo in
            if let image = model.contentImage {
                let fit = fitRect(CGSize(width: image.width, height: image.height), in: geo.size)
                ZStack(alignment: .topLeading) {
                    Color.black
                    Image(decorative: image, scale: 1).resizable()
                        .frame(width: fit.width, height: fit.height)
                        .offset(x: fit.minX, y: fit.minY)
                    ForEach(model.layout.regions) { region in
                        Path { p in
                            for cell in region.cells() { p.addRect(viewRect(cell.rect, fit)) }
                        }
                        .stroke(region.kind == kind ? Theme.gold : color(for: region.kind), lineWidth: region.kind == kind ? 2 : 1)
                        Text(region.kind.title)
                            .font(.system(size: 10, weight: .bold))
                            .padding(3)
                            .background(Color.black.opacity(0.7))
                            .foregroundStyle(color(for: region.kind))
                            .offset(x: viewRect(region.rect, fit).minX, y: max(0, viewRect(region.rect, fit).minY - 18))
                    }
                    ForEach(model.layout.anchors) { a in
                        Path { p in p.addRect(viewRect(a.rect, fit)) }
                            .stroke(Theme.good, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    }
                    if let s = dragStart, let c = dragCurrent {
                        Path { p in p.addRect(CGRect(x: min(s.x, c.x), y: min(s.y, c.y), width: abs(c.x - s.x), height: abs(c.y - s.y))) }
                            .stroke(Theme.accent, lineWidth: 2)
                    }
                }
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { v in
                            if dragStart == nil { dragStart = v.startLocation }
                            dragCurrent = v.location
                        }
                        .onEnded { v in
                            finish(start: v.startLocation, end: v.location, fit: fit, image: image)
                            dragStart = nil
                            dragCurrent = nil
                        }
                )
            } else {
                ZStack {
                    RoundedRectangle(cornerRadius: 12).fill(Theme.panel)
                    VStack(spacing: 8) {
                        Image(systemName: "viewfinder").font(.largeTitle).foregroundStyle(Theme.textFaint)
                        Text("התחילו לכידה או טענו צילום מסך (Capture & Settings) — הפריים יופיע כאן.")
                            .foregroundStyle(Theme.textDim)
                    }
                }
            }
        }
    }

    private func color(for k: RegionKind) -> Color {
        if k == .gameTimer { return Theme.textDim }
        return k.side == .ally ? Theme.ally : Theme.enemy
    }

    private func fitRect(_ size: CGSize, in container: CGSize) -> CGRect {
        guard size.width > 0, size.height > 0, container.width > 0, container.height > 0 else { return .zero }
        let s = min(container.width / size.width, container.height / size.height)
        let w = size.width * s, h = size.height * s
        return CGRect(x: (container.width - w) / 2, y: (container.height - h) / 2, width: w, height: h)
    }

    private func viewRect(_ r: NormalizedRect, _ fit: CGRect) -> CGRect {
        CGRect(x: fit.minX + r.x * fit.width, y: fit.minY + r.y * fit.height, width: r.width * fit.width, height: r.height * fit.height)
    }

    private func normalized(_ p: CGPoint, _ fit: CGRect) -> (Double, Double) {
        (Double((p.x - fit.minX) / max(1, fit.width)), Double((p.y - fit.minY) / max(1, fit.height)))
    }

    private func finish(start: CGPoint, end: CGPoint, fit: CGRect, image: CGImage) {
        let a = normalized(start, fit), b = normalized(end, fit)
        let rect = NormalizedRect.from(a.0, a.1, b.0, b.1)
        let isTap = hypot(end.x - start.x, end.y - start.y) < 4

        switch tool {
        case .region:
            guard !isTap, rect.width > 0.005, rect.height > 0.005 else { return }
            model.setRegion(LayoutRegion(kind: kind, rect: rect, rows: rows, cols: cols, playersAlongRows: playersAlongRows))
        case .labelCell:
            for region in model.layout.regions where region.kind != .gameTimer {
                if let cell = region.cells().first(where: { $0.rect.contains(x: b.0, y: b.1) }),
                   let crop = ImageTools.crop(image, cell.rect) {
                    pending = PendingCrop(image: crop, rect: cell.rect, kind: region.kind.isItemGrid ? .item : .hero, mode: .template)
                    return
                }
            }
        case .freeCrop:
            guard !isTap, let crop = ImageTools.crop(image, rect) else { return }
            pending = PendingCrop(image: crop, rect: rect, kind: .hero, mode: .template)
        case .anchor:
            guard !isTap, let crop = ImageTools.crop(image, rect) else { return }
            pending = PendingCrop(image: crop, rect: rect, kind: .hero, mode: .anchor)
        }
    }
}

// MARK: - Labeling sheet

struct LabelSheet: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var library: TemplateLibrary
    let crop: PendingCrop
    let onDone: () -> Void

    @State private var kind: TemplateKind
    @State private var query = ""
    @State private var selection: String?
    @State private var screen: GameScreen = .draft
    @State private var error: String?

    init(crop: PendingCrop, onDone: @escaping () -> Void) {
        self.crop = crop
        self.onDone = onDone
        _kind = State(initialValue: crop.kind)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 16) {
                Image(decorative: crop.image, scale: 1).resizable().interpolation(.high).aspectRatio(contentMode: .fit)
                    .frame(width: 96, height: 96)
                    .background(Color.black)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                VStack(alignment: .leading, spacing: 6) {
                    Text(crop.mode == .anchor ? "עוגן מצב מסך" : "תיוג אייקון").font(.title3.bold())
                    if crop.mode == .template {
                        Picker("", selection: $kind) {
                            ForEach(TemplateKind.allCases) { Text($0.title).tag($0) }
                        }
                        .pickerStyle(.segmented)
                        .labelsHidden()
                        if let s = model.suggestion(for: crop.image, kind: kind) {
                            Text("הזיהוי הנוכחי: \(display(s.0)) (\(Int(s.1 * 100))% דמיון)").font(.caption).foregroundStyle(Theme.textDim)
                        }
                    } else {
                        Picker("מסך", selection: $screen) {
                            ForEach(GameScreen.allCases.filter { $0 != .unknown }, id: \.self) { Text($0.displayName).tag($0) }
                        }
                    }
                }
            }
            if crop.mode == .template {
                TextField("חיפוש…", text: $query).textFieldStyle(.roundedBorder)
                List(filteredNames, id: \.self, selection: $selection) { name in
                    HStack {
                        Text(display(name))
                        Spacer()
                        let n = (library.samples[kind] ?? []).filter { $0.label == name }.count
                        if n > 0 { Text("\(n) דוגמאות").font(.caption2).foregroundStyle(Theme.textFaint) }
                    }
                }
                .frame(height: 260)
            }
            if let error { Text(error).font(.caption).foregroundStyle(Theme.bad) }
            HStack {
                Button("ביטול") { onDone() }.keyboardShortcut(.cancelAction)
                Spacer()
                Button("שמירה") { save() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(crop.mode == .template && selection == nil)
            }
        }
        .padding(20)
        .frame(width: 440)
    }

    private var allNames: [String] {
        guard let db = model.database else { return [] }
        switch kind {
        case .hero: return db.heroes.map(\.name)
        case .item: return [IconMatcher.emptyLabel] + db.items.map(\.name).sorted()
        }
    }

    private var filteredNames: [String] {
        let q = NameMatcher.normalize(query)
        guard !q.isEmpty else { return allNames }
        return allNames.filter { NameMatcher.normalize(display($0)).contains(q) }
    }

    private func display(_ label: String) -> String { label == IconMatcher.emptyLabel ? "(Empty slot)" : label }

    private func save() {
        do {
            switch crop.mode {
            case .template:
                guard let selection else { return }
                try library.add(crop.image, label: selection, kind: kind)
            case .anchor:
                model.addAnchor(image: crop.image, rect: crop.rect, screen: screen)
            }
            onDone()
        } catch {
            self.error = "השמירה נכשלה: \(error.localizedDescription)"
        }
    }
}
