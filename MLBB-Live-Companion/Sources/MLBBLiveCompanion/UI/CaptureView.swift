import AppKit
import MLBBCore
import SwiftUI
import UniformTypeIdentifiers

struct CaptureView: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            ScrollView {
                VStack(spacing: 16) {
                    PermissionCard()
                    WindowPickerCard()
                    SettingsCard()
                }
            }
            .frame(width: 420)
            VStack(spacing: 16) {
                PreviewCard()
                OCRCard()
            }
        }
        .padding(20)
    }
}

private struct PermissionCard: View {
    @EnvironmentObject var model: AppModel
    var body: some View {
        Card(title: "Screen Recording Permission", systemImage: "lock.shield") {
            if model.hasScreenPermission {
                Label("ההרשאה ניתנה", systemImage: "checkmark.seal.fill").foregroundStyle(Theme.good)
            } else {
                Text("macOS דורש הרשאת Screen Recording כדי ללכוד את חלון QuickTime. אחרי האישור ב-System Settings צריך לסגור ולפתוח את האפליקציה מחדש.")
                    .font(.caption).foregroundStyle(Theme.textDim)
                HStack {
                    Button("בקשת הרשאה") { model.requestPermission() }
                    Button("פתיחת System Settings") { CaptureService.openPrivacySettings() }
                }
            }
        }
    }
}

private struct WindowPickerCard: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var devices: IOSDeviceMonitor

    var body: some View {
        Card(title: "Capture Source", systemImage: "rectangle.on.rectangle") {
            HStack {
                Image(systemName: devices.isConnected ? "ipad.landscape" : "ipad.landscape.badge.play")
                    .foregroundStyle(devices.isConnected ? Theme.good : Theme.warn)
                Text(devices.isConnected ? "מחובר ב-USB: \(devices.deviceNames.joined(separator: ", "))"
                                         : "לא זוהה iPad ב-USB (בדקו כבל ו-Trust This Computer)")
                    .font(.caption)
            }
            HStack {
                Text("חלונות זמינים").font(.caption.bold()).foregroundStyle(Theme.textDim)
                Spacer()
                Button { Task { await model.refreshWindows() } } label: { Label("רענון", systemImage: "arrow.clockwise") }
            }
            if model.windows.isEmpty {
                Text("לא נמצאו חלונות. פתחו QuickTime Player ← File ← New Movie Recording ← בחרו את ה-iPad כמצלמה.")
                    .font(.caption).foregroundStyle(Theme.textDim)
            } else {
                VStack(spacing: 4) {
                    ForEach(model.windows) { w in
                        Button { model.selectedWindowID = w.id } label: {
                            HStack {
                                Image(systemName: w.isQuickTime ? "play.rectangle.fill" : "macwindow")
                                    .foregroundStyle(w.isQuickTime ? Theme.accent : Theme.textDim)
                                VStack(alignment: .leading) {
                                    Text(w.displayTitle).lineLimit(1)
                                    Text("\(w.width)×\(w.height)").font(.caption2).foregroundStyle(Theme.textFaint)
                                }
                                Spacer()
                                if model.selectedWindowID == w.id { Image(systemName: "checkmark").foregroundStyle(Theme.good) }
                            }
                            .padding(6)
                            .background(RoundedRectangle(cornerRadius: 8).fill(model.selectedWindowID == w.id ? Theme.accent.opacity(0.15) : Theme.panelRaised))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            HStack {
                if model.captureState.isRunning {
                    Button(role: .destructive) { Task { await model.stopCapture() } } label: { Label("עצירת לכידה", systemImage: "stop.fill") }
                } else {
                    Button { Task { await model.startCapture() } } label: { Label("התחלת לכידה", systemImage: "record.circle") }
                        .buttonStyle(.borderedProminent)
                        .disabled(model.selectedWindowID == nil)
                }
                Spacer()
                Button { openScreenshot() } label: { Label("טעינת צילום מסך…", systemImage: "photo") }
                    .help("בדיקת הזיהוי על צילום מסך שמור, בלי iPad")
            }
            if case .failed(let msg) = model.captureState {
                Label(msg, systemImage: "xmark.octagon.fill").font(.caption).foregroundStyle(Theme.bad)
            }
        }
    }

    private func openScreenshot() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.png, .jpeg, .heic, .image]
        panel.allowsMultipleSelection = false
        if panel.runModal() == .OK, let url = panel.url {
            Task { await model.loadStillImage(url) }
        }
    }
}

private struct SettingsCard: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        Card(title: "Player & Analysis", systemImage: "slider.horizontal.3") {
            VStack(alignment: .leading, spacing: 4) {
                Text("שם השחקן במשחק (IGN)").font(.caption.bold())
                TextField("לדוגמה: ShadowFox", text: $model.playerName).textFieldStyle(.roundedBorder)
                Text("משמש לזיהוי אוטומטי של הגיבור שלכם לפי השם שמופיע ליד הגיבור ב-Draft / בלוח התוצאות.")
                    .font(.caption2).foregroundStyle(Theme.textFaint)
            }
            Picker("הגיבור שלי", selection: $model.mySlotOverride) {
                Text("אוטומטי (לפי שם)").tag(Int?.none)
                ForEach(0..<5, id: \.self) { i in Text("Ally slot \(i + 1)").tag(Int?.some(i)) }
            }
            Picker("Lane", selection: $model.laneOverride) {
                Text("לפי המאגר").tag(Lane?.none)
                ForEach(Lane.allCases) { l in Text(l.displayName).tag(Lane?.some(l)) }
            }
            VStack(alignment: .leading) {
                Text("ניתוח כל \(String(format: "%.1f", model.analysisInterval)) שניות").font(.caption)
                Slider(value: $model.analysisInterval, in: 0.25...2.0, step: 0.25)
            }
            Stepper("קצב לכידה: \(model.captureFPS) fps", value: $model.captureFPS, in: 2...30)
                .font(.caption)
            Picker("כפיית מצב מסך", selection: Binding(get: { model.snapshot.screen }, set: { model.overrideScreen($0) })) {
                ForEach(GameScreen.allCases, id: \.self) { s in Text(s.displayName).tag(s) }
            }
            .help("לבדיקה בלבד — הזיהוי האוטומטי ימשיך לעדכן")
        }
    }
}

private struct PreviewCard: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        Card(title: "Live Preview", systemImage: "eye") {
            ZStack {
                RoundedRectangle(cornerRadius: 10).fill(Color.black)
                if let img = model.previewImage {
                    Image(decorative: img, scale: 1).resizable().interpolation(.medium).aspectRatio(contentMode: .fit)
                } else {
                    VStack(spacing: 8) {
                        Image(systemName: "rectangle.dashed").font(.largeTitle).foregroundStyle(Theme.textFaint)
                        Text("אין תמונה עדיין").foregroundStyle(Theme.textDim)
                    }
                }
            }
            .frame(minHeight: 320)
            HStack(spacing: 18) {
                stat("Preview", String(format: "%.0f fps", model.stats.previewFPS))
                stat("Analysed", "\(model.stats.analysedFrames)")
                stat("Unchanged (skipped)", "\(model.stats.duplicateFrames)")
                stat("Analysis", String(format: "%.0f ms", model.stats.analysisMs))
                stat("Aspect", model.stats.contentAspect.map { String(format: "%.3f", $0) } ?? "—")
                VStack(alignment: .leading) {
                    Text("LAST FRAME").font(.system(size: 9, weight: .bold)).foregroundStyle(Theme.textFaint)
                    TimeAgo(date: model.stats.lastFrameAt).font(.caption.bold())
                }
            }
            if let a = model.stats.contentAspect, model.layout.aspectMismatch(a) {
                Label("יחס התמונה שונה מזה שבו בוצע הכיול — כדאי לכייל מחדש.", systemImage: "exclamationmark.triangle")
                    .font(.caption).foregroundStyle(Theme.warn)
            }
        }
    }

    private func stat(_ t: String, _ v: String) -> some View {
        VStack(alignment: .leading) {
            Text(t.uppercased()).font(.system(size: 9, weight: .bold)).foregroundStyle(Theme.textFaint)
            Text(v).font(.caption.bold()).monospacedDigit()
        }
    }
}

private struct OCRCard: View {
    @EnvironmentObject var model: AppModel
    var body: some View {
        Card(title: "Detection Diagnostics", systemImage: "text.viewfinder") {
            if model.stats.regions.isEmpty {
                Text("אין אזורים מכוילים עדיין.").font(.caption).foregroundStyle(Theme.textDim)
            } else {
                ForEach(model.stats.regions) { r in
                    HStack {
                        Image(systemName: r.accepted ? "checkmark.circle.fill" : "circle").foregroundStyle(r.accepted ? Theme.good : Theme.textFaint)
                        Text(r.kind.title).font(.caption)
                        Spacer()
                        Text("\(r.matchedCells)/\(r.totalCells)").font(.caption.monospacedDigit()).foregroundStyle(Theme.textDim)
                    }
                }
            }
            Text("OCR (טקסט שנקרא לאחרונה)").font(.caption.bold()).foregroundStyle(Theme.textDim)
            ScrollView {
                Text(model.lastOCRTexts.isEmpty ? "—" : model.lastOCRTexts.joined(separator: " · "))
                    .font(.caption2.monospaced()).foregroundStyle(Theme.textFaint)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            }
            .frame(maxHeight: 90)
        }
    }
}
