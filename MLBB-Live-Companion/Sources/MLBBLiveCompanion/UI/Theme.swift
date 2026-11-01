import MLBBCore
import SwiftUI

enum Theme {
    static let background = Color(red: 0.047, green: 0.055, blue: 0.082)
    static let panel = Color(red: 0.082, green: 0.094, blue: 0.137)
    static let panelRaised = Color(red: 0.118, green: 0.133, blue: 0.188)
    static let stroke = Color.white.opacity(0.07)
    static let text = Color.white.opacity(0.92)
    static let textDim = Color.white.opacity(0.55)
    static let textFaint = Color.white.opacity(0.32)
    static let accent = Color(red: 0.36, green: 0.56, blue: 1.0)
    static let gold = Color(red: 0.97, green: 0.77, blue: 0.30)
    static let good = Color(red: 0.27, green: 0.84, blue: 0.56)
    static let warn = Color(red: 1.0, green: 0.74, blue: 0.27)
    static let bad = Color(red: 1.0, green: 0.38, blue: 0.42)
    static let physical = Color(red: 0.99, green: 0.56, blue: 0.27)
    static let magic = Color(red: 0.64, green: 0.48, blue: 1.0)
    static let ally = Color(red: 0.33, green: 0.62, blue: 1.0)
    static let enemy = Color(red: 1.0, green: 0.40, blue: 0.40)

    static func damageColor(_ t: DamageType) -> Color {
        switch t {
        case .physical: return physical
        case .magic: return magic
        case .mixed: return Color(red: 0.95, green: 0.55, blue: 0.75)
        case .trueDamage: return .white
        }
    }

    static func roleColor(_ role: String) -> Color {
        switch role {
        case "Tank": return Color(red: 0.45, green: 0.70, blue: 0.95)
        case "Fighter": return Color(red: 0.95, green: 0.60, blue: 0.30)
        case "Assassin": return Color(red: 0.90, green: 0.35, blue: 0.45)
        case "Mage": return magic
        case "Marksman": return gold
        case "Support": return good
        default: return textDim
        }
    }

    static func confidenceColor(_ c: Double) -> Color { c >= 0.75 ? good : (c >= 0.5 ? warn : bad) }
}

struct Card<Content: View>: View {
    let title: String
    var systemImage: String?
    var trailing: AnyView?
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                if let systemImage { Image(systemName: systemImage).foregroundStyle(Theme.accent) }
                Text(title.uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .kerning(1.2)
                    .foregroundStyle(Theme.textDim)
                Spacer()
                if let trailing { trailing }
            }
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.panel))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.stroke))
    }
}

struct Tag: View {
    let text: String
    var color: Color = Theme.accent
    var body: some View {
        Text(text)
            .font(.system(size: 10, weight: .semibold))
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(Capsule().fill(color.opacity(0.16)))
            .foregroundStyle(color)
    }
}

struct ConfidenceBadge: View {
    let confidence: Double
    var body: some View {
        Text("\(Int((confidence * 100).rounded()))%")
            .font(.system(size: 10, weight: .bold, design: .monospaced))
            .padding(.horizontal, 5)
            .padding(.vertical, 2)
            .background(Capsule().fill(Theme.confidenceColor(confidence).opacity(0.18)))
            .foregroundStyle(Theme.confidenceColor(confidence))
            .help("רמת הביטחון בזיהוי")
    }
}

/// Relative time that refreshes itself every second.
struct TimeAgo: View {
    let date: Date?
    var prefix: String = ""
    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            Text(prefix + Self.format(date, now: ctx.date))
                .monospacedDigit()
        }
    }

    static func format(_ date: Date?, now: Date) -> String {
        guard let date else { return "—" }
        let s = max(0, Int(now.timeIntervalSince(date)))
        if s < 2 { return "עכשיו" }
        if s < 60 { return "לפני \(s) ש׳" }
        if s < 3600 { return "לפני \(s / 60) ד׳" }
        return "לפני \(s / 3600) שע׳"
    }
}

struct PulsingDot: View {
    let color: Color
    var active: Bool = true
    @State private var pulse = false
    var body: some View {
        ZStack {
            if active {
                Circle().fill(color.opacity(0.35)).frame(width: 14, height: 14)
                    .scaleEffect(pulse ? 1.3 : 0.6).opacity(pulse ? 0 : 1)
            }
            Circle().fill(color).frame(width: 8, height: 8)
        }
        .frame(width: 14, height: 14)
        .onAppear {
            guard active else { return }
            withAnimation(.easeOut(duration: 1.4).repeatForever(autoreverses: false)) { pulse = true }
        }
    }
}

struct HeroAvatar: View {
    @EnvironmentObject var library: TemplateLibrary
    let name: String?
    var size: CGFloat = 48
    var ring: Color = Theme.stroke
    var unknown: Bool = false

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.22).fill(Theme.panelRaised)
            if let img = library.thumbnail(name, kind: .hero) {
                Image(nsImage: img).resizable().scaledToFill()
            } else if let name {
                Text(initials(name)).font(.system(size: size * 0.32, weight: .bold)).foregroundStyle(Theme.textDim)
            } else {
                Image(systemName: unknown ? "questionmark" : "person.fill")
                    .font(.system(size: size * 0.36, weight: .semibold))
                    .foregroundStyle(Theme.textFaint)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size * 0.22))
        .overlay(RoundedRectangle(cornerRadius: size * 0.22).stroke(ring, lineWidth: 2))
    }

    private func initials(_ s: String) -> String {
        let parts = s.split(whereSeparator: { $0 == " " || $0 == "-" || $0 == "." })
        return parts.prefix(2).compactMap(\.first).map(String.init).joined().uppercased()
    }
}

struct ItemIcon: View {
    @EnvironmentObject var library: TemplateLibrary
    let item: Item?
    var size: CGFloat = 40
    var owned: Bool = false
    var highlight: Bool = false

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8).fill(Theme.panelRaised)
            if let item, let img = library.thumbnail(item.name, kind: .item) {
                Image(nsImage: img).resizable().scaledToFill()
            } else if let item {
                Image(systemName: symbol(item.category))
                    .font(.system(size: size * 0.42))
                    .foregroundStyle(color(item.category))
            } else {
                Image(systemName: "square.dashed").foregroundStyle(Theme.textFaint)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(highlight ? Theme.gold : (owned ? Theme.good : Theme.stroke), lineWidth: highlight || owned ? 2 : 1))
        .overlay(alignment: .bottomTrailing) {
            if owned {
                Image(systemName: "checkmark.circle.fill").font(.system(size: 12)).foregroundStyle(Theme.good)
                    .background(Circle().fill(Theme.panel)).offset(x: 4, y: 4)
            }
        }
        .help(item?.name ?? "")
    }

    private func symbol(_ c: ItemCategory) -> String {
        switch c {
        case .boots: return "shoeprints.fill"
        case .physical: return "bolt.fill"
        case .magic: return "sparkles"
        case .defense: return "shield.fill"
        case .support: return "heart.fill"
        }
    }

    private func color(_ c: ItemCategory) -> Color {
        switch c {
        case .boots: return Theme.textDim
        case .physical: return Theme.physical
        case .magic: return Theme.magic
        case .defense: return Theme.ally
        case .support: return Theme.good
        }
    }
}

struct DamageBadge: View {
    let type: DamageType
    var body: some View { Tag(text: type.displayName, color: Theme.damageColor(type)) }
}
