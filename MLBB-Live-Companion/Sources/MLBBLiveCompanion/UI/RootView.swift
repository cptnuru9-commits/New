import SwiftUI

enum AppSection: String, CaseIterable, Identifiable, Hashable {
    case dashboard, capture, calibration, library, database

    var id: String { rawValue }

    var title: String {
        switch self {
        case .dashboard: return "Live Dashboard"
        case .capture: return "Capture & Settings"
        case .calibration: return "Calibration & Labeling"
        case .library: return "Icon Library"
        case .database: return "Game Database"
        }
    }

    var icon: String {
        switch self {
        case .dashboard: return "gauge.with.dots.needle.67percent"
        case .capture: return "rectangle.on.rectangle"
        case .calibration: return "viewfinder"
        case .library: return "square.grid.3x3.fill"
        case .database: return "books.vertical.fill"
        }
    }
}

struct RootView: View {
    @EnvironmentObject var model: AppModel
    @State private var section: AppSection? = .dashboard

    var body: some View {
        NavigationSplitView {
            List(selection: $section) {
                Section("MLBB Live Companion") {
                    ForEach(AppSection.allCases) { s in
                        NavigationLink(value: s) { Label(s.title, systemImage: s.icon) }
                    }
                }
            }
            .navigationSplitViewColumnWidth(min: 200, ideal: 220)
            .safeAreaInset(edge: .bottom) { SidebarStatus().padding(12) }
        } detail: {
            ZStack {
                Theme.background.ignoresSafeArea()
                switch section ?? .dashboard {
                case .dashboard: DashboardView(goTo: { section = $0 })
                case .capture: CaptureView()
                case .calibration: CalibrationView()
                case .library: LibraryView()
                case .database: DatabaseView()
                }
            }
        }
    }
}

private struct SidebarStatus: View {
    @EnvironmentObject var model: AppModel
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                PulsingDot(color: model.captureState.isRunning ? Theme.good : Theme.textFaint, active: model.captureState.isRunning)
                Text(model.captureState.isRunning ? "Live" : "Not capturing").font(.caption.bold())
            }
            Text("Screen: \(model.snapshot.screen.displayName)").font(.caption).foregroundStyle(Theme.textDim)
            Text("עיבוד מקומי בלבד — שום תמונה לא נשלחת").font(.caption2).foregroundStyle(Theme.textFaint)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
