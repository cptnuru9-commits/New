import AppKit
import Combine
import Foundation
import MLBBCore
import ScreenCaptureKit

struct PipelineStats {
    var previewFrames = 0
    var analysedFrames = 0
    var duplicateFrames = 0
    var lastFrameAt: Date?
    var lastAnalysisAt: Date?
    var analysisMs: Double = 0
    var previewFPS: Double = 0
    var contentAspect: Double?
    var regions: [RegionDiagnostics] = []
}

enum CaptureState: Equatable {
    case idle
    case starting
    case running
    case failed(String)

    var isRunning: Bool { self == .running }
}

enum FrameSource: Equatable {
    case off
    case live(String)
    case still(String)
}

/// Central state of the app (main actor). Owns capture, the analysis pipeline, the tracker and the engine.
@MainActor
final class AppModel: ObservableObject {
    // Data
    @Published private(set) var database: GameDatabase?
    @Published private(set) var databaseError: String?
    @Published private(set) var databaseProblems: [String] = []

    // Capture
    @Published private(set) var windows: [CaptureWindowInfo] = []
    @Published var selectedWindowID: CGWindowID?
    @Published private(set) var captureState: CaptureState = .idle
    @Published private(set) var hasScreenPermission = CaptureService.hasPermission
    @Published private(set) var source: FrameSource = .off
    @Published private(set) var previewImage: CGImage?
    @Published private(set) var contentImage: CGImage?
    @Published var freezeContentImage = false
    @Published private(set) var stats = PipelineStats()
    @Published private(set) var lastOCRTexts: [String] = []

    // Game
    @Published private(set) var snapshot = MatchSnapshot.empty
    @Published private(set) var recommendation: BuildRecommendation?
    @Published private(set) var composition: CompositionReport?
    @Published private(set) var layout: LayoutProfile

    // Settings (persisted)
    @Published var playerName: String { didSet { defaults.set(playerName, forKey: "playerName"); pushConfig() } }
    @Published var laneOverride: Lane? { didSet { defaults.set(laneOverride?.rawValue, forKey: "lane"); recompute() } }
    @Published var mySlotOverride: Int? { didSet { if let v = mySlotOverride { defaults.set(v, forKey: "mySlot") } else { defaults.removeObject(forKey: "mySlot") }; recompute() } }
    @Published var analysisInterval: Double { didSet { defaults.set(analysisInterval, forKey: "interval"); pushConfig() } }
    @Published var captureFPS: Int { didSet { defaults.set(captureFPS, forKey: "fps") } }

    let library: TemplateLibrary
    let deviceMonitor = IOSDeviceMonitor()

    private let defaults = UserDefaults.standard
    private let capture = CaptureService()
    private let pipeline = FramePipeline()
    private var tracker = MatchTracker()
    private var scWindows: [CGWindowID: SCWindow] = [:]
    private var lastObservation: FrameObservation?
    private var stillTimer: Timer?
    private var previewTimes: [Date] = []
    private var libraryObserver: AnyCancellable?

    init() {
        library = TemplateLibrary(root: AppPaths.templates)
        layout = AppPaths.loadLayout()
        playerName = UserDefaults.standard.string(forKey: "playerName") ?? ""
        laneOverride = UserDefaults.standard.string(forKey: "lane").flatMap(Lane.init(rawValue:))
        mySlotOverride = UserDefaults.standard.object(forKey: "mySlot") as? Int
        let interval = UserDefaults.standard.double(forKey: "interval")
        analysisInterval = interval > 0 ? interval : 0.5
        let fps = UserDefaults.standard.integer(forKey: "fps")
        captureFPS = fps > 0 ? fps : 10

        pipeline.onPreview = { [weak self] image in self?.handlePreview(image) }
        pipeline.onResult = { [weak self] result in self?.handle(result) }
        capture.onStop = { [weak self] message in
            self?.captureState = .failed("הלכידה נעצרה: \(message)")
            self?.source = .off
        }
        libraryObserver = library.$revision.dropFirst().sink { [weak self] _ in
            Task { @MainActor in
                self?.pushConfig()
                self?.pipeline.invalidate()
            }
        }

        reloadDatabase()
        pushConfig()
        deviceMonitor.start()
        if hasScreenPermission { Task { await refreshWindows() } }
    }

    // MARK: Database

    func reloadDatabase() {
        guard let dir = AppPaths.activeDatabase else {
            databaseError = "לא נמצא מאגר נתונים (Resources/Data)."
            return
        }
        do {
            let db = try GameDatabase.load(from: dir)
            database = db
            databaseProblems = db.validate()
            databaseError = nil
            recompute()
        } catch {
            databaseError = error.localizedDescription
        }
    }

    func openEditableDatabase() {
        do {
            let url = try AppPaths.makeEditableDatabaseCopy()
            NSWorkspace.shared.activateFileViewerSelecting([url])
            reloadDatabase()
        } catch {
            databaseError = "לא ניתן ליצור עותק לעריכה: \(error.localizedDescription)"
        }
    }

    // MARK: Capture

    func requestPermission() {
        CaptureService.requestPermission()
        hasScreenPermission = CaptureService.hasPermission
        if !hasScreenPermission { CaptureService.openPrivacySettings() }
    }

    func refreshWindows() async {
        hasScreenPermission = CaptureService.hasPermission
        do {
            let list = try await CaptureService.availableWindows()
            scWindows = Dictionary(list.map { ($0.0.id, $0.1) }, uniquingKeysWith: { a, _ in a })
            windows = list.map(\.0)
            if selectedWindowID == nil || !windows.contains(where: { $0.id == selectedWindowID }) {
                selectedWindowID = windows.first(where: \.isQuickTime)?.id
            }
            hasScreenPermission = true
        } catch {
            hasScreenPermission = CaptureService.hasPermission
            captureState = .failed("אין גישה לרשימת החלונות: \(error.localizedDescription)")
        }
    }

    func startCapture() async {
        stopStill()
        guard let id = selectedWindowID, let window = scWindows[id], let info = windows.first(where: { $0.id == id }) else {
            captureState = .failed("בחרו חלון ללכידה (QuickTime Player).")
            return
        }
        captureState = .starting
        let pipeline = self.pipeline
        capture.onFrame = { image, time in pipeline.submit(image, at: time) }
        do {
            try await capture.start(window: window, framesPerSecond: captureFPS)
            captureState = .running
            source = .live(info.displayTitle)
        } catch {
            captureState = .failed("הלכידה נכשלה: \(error.localizedDescription)")
            source = .off
        }
    }

    func stopCapture() async {
        await capture.stop()
        stopStill()
        captureState = .idle
        source = .off
    }

    /// Feeds a saved screenshot through the same pipeline — for testing recognition without an iPad.
    func loadStillImage(_ url: URL) async {
        guard let image = ImageTools.load(url) else {
            captureState = .failed("לא ניתן לפתוח את התמונה \(url.lastPathComponent).")
            return
        }
        await capture.stop()
        stopStill()
        captureState = .idle
        source = .still(url.lastPathComponent)
        pipeline.invalidate()
        let pipeline = self.pipeline
        pipeline.submit(image, at: Date())
        stillTimer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { _ in
            pipeline.submit(image, at: Date())
        }
    }

    private func stopStill() {
        stillTimer?.invalidate()
        stillTimer = nil
    }

    // MARK: Pipeline results

    private func handlePreview(_ image: CGImage) {
        previewImage = image
        let now = Date()
        stats.previewFrames += 1
        stats.lastFrameAt = now
        previewTimes.append(now)
        previewTimes.removeAll { now.timeIntervalSince($0) > 2 }
        stats.previewFPS = Double(previewTimes.count) / 2
    }

    private func handle(_ result: FramePipeline.Result) {
        switch result {
        case .analysed(let a):
            stats.analysedFrames += 1
            stats.analysisMs = a.durationMs
            stats.lastAnalysisAt = a.observation.time
            stats.regions = a.regions
            stats.contentAspect = Double(a.contentImage.width) / Double(max(1, a.contentImage.height))
            if !freezeContentImage { contentImage = a.contentImage }
            if let t = a.ocrTexts { lastOCRTexts = t }
            lastObservation = a.observation
            ingest(a.observation)
        case .duplicate(let time):
            stats.duplicateFrames += 1
            stats.lastAnalysisAt = time
            if var o = lastObservation {
                o.time = time
                ingest(o)
            }
        }
    }

    private func ingest(_ o: FrameObservation) {
        tracker.ingest(o)
        recompute()
    }

    func recompute() {
        guard let db = database else { return }
        let snap = tracker.snapshot(database: db, mySlotOverride: mySlotOverride)
        snapshot = snap
        if let me = snap.me?.hero.hero {
            let ctx = BuildContext(myHero: me, lane: laneOverride, enemies: snap.enemies,
                                   ownedItems: snap.me?.items.compactMap(\.item) ?? [],
                                   gameClockSeconds: snap.gameClockSeconds)
            recommendation = BuildEngine(database: db).recommend(ctx)
        } else {
            recommendation = nil
        }
        let allies = snap.allies.compactMap(\.hero.hero)
        let enemies = snap.enemies.compactMap(\.hero.hero)
        composition = allies.isEmpty && enemies.isEmpty ? nil
            : CompositionAnalyzer.analyze(allies: allies, enemies: enemies, me: snap.me?.hero.hero)
    }

    func newMatch() {
        tracker.resetMatch()
        mySlotOverride = nil
        lastObservation = nil
        pipeline.invalidate()
        recompute()
    }

    func overrideScreen(_ screen: GameScreen) {
        tracker.overrideScreen(screen, at: Date())
        recompute()
    }

    // MARK: Layout / calibration

    func setRegion(_ region: LayoutRegion) {
        layout.upsert(region)
        if let aspect = stats.contentAspect { layout.referenceAspect = aspect }
        saveLayout()
    }

    func removeRegion(_ kind: RegionKind) {
        layout.regions.removeAll { $0.kind == kind }
        saveLayout()
    }

    func addAnchor(image: CGImage, rect: NormalizedRect, screen: GameScreen) {
        let anchor = StateAnchor(screen: screen, rect: rect)
        do {
            try ImageTools.savePNG(image, to: AppPaths.anchorImageURL(anchor.id))
            layout.anchors.append(anchor)
            saveLayout()
        } catch {
            captureState = .failed("שמירת העוגן נכשלה: \(error.localizedDescription)")
        }
    }

    func removeAnchor(_ anchor: StateAnchor) {
        try? FileManager.default.removeItem(at: AppPaths.anchorImageURL(anchor.id))
        layout.anchors.removeAll { $0.id == anchor.id }
        saveLayout()
    }

    func resetLayout() {
        for a in layout.anchors { try? FileManager.default.removeItem(at: AppPaths.anchorImageURL(a.id)) }
        layout = .empty
        saveLayout()
    }

    private func saveLayout() {
        AppPaths.saveLayout(layout)
        pipeline.invalidate()
        pushConfig()
    }

    /// Recognition suggestion for a crop (shown in the labelling sheet).
    func suggestion(for crop: CGImage, kind: TemplateKind) -> (String, Double)? {
        let m = library.matchers()
        let matcher = kind == .hero ? m.hero : m.item
        guard let best = matcher.rank(ImageTools.descriptor(crop), top: 1).first else { return nil }
        return (best.label, best.score)
    }

    private func pushConfig() {
        let m = library.matchers()
        var c = AnalysisConfig()
        c.layout = layout
        c.heroMatcher = m.hero
        c.itemMatcher = m.item
        c.anchors = layout.anchors.compactMap { a in
            guard let img = ImageTools.load(AppPaths.anchorImageURL(a.id)) else { return nil }
            return AnchorDescriptor(anchor: a, descriptor: ImageTools.descriptor(img, inset: 0))
        }
        c.playerName = playerName
        c.interval = analysisInterval
        pipeline.update(c)
    }

    // MARK: Status

    var isAnalysisFresh: Bool {
        guard let t = stats.lastAnalysisAt else { return false }
        return Date().timeIntervalSince(t) < max(3, analysisInterval * 6)
    }

    var detectionActive: Bool {
        layout.isCalibrated && library.count(.hero) > 0 && isAnalysisFresh
    }
}
