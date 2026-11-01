import Foundation

public struct CompositionReport: Sendable, Equatable {
    public var strengths: [String]
    public var weaknesses: [String]
    public var matchupNotes: [String]
    public var allyPhysicalShare: Double
    public var enemyPhysicalShare: Double
}

/// Team-composition analysis from the curated hero profiles (qualitative, no statistics).
public enum CompositionAnalyzer {
    static func physicalShare(_ heroes: [Hero]) -> Double {
        var p = 0.0, m = 0.0
        for h in heroes {
            let v = ThreatAnalyzer.vector(for: h)
            p += v[.physical] ?? 0
            m += v[.magic] ?? 0
        }
        return p + m > 0.0001 ? p / (p + m) : 0.5
    }

    public static func analyze(allies: [Hero], enemies: [Hero], me: Hero?) -> CompositionReport {
        var strengths: [String] = []
        var weaknesses: [String] = []
        var notes: [String] = []
        let allyPhys = physicalShare(allies)
        let enemyPhys = physicalShare(enemies)

        if allies.count >= 3 {
            if allyPhys >= 0.8 {
                weaknesses.append("הנזק של הקבוצה שלכם כמעט כולו פיזי — היריב יכול לבנות הגנה פיזית בלבד.")
            } else if allyPhys <= 0.2 {
                weaknesses.append("הנזק של הקבוצה שלכם כמעט כולו קסם — היריב יכול לבנות הגנת קסם בלבד.")
            } else {
                strengths.append("שילוב מאוזן של נזק פיזי וקסם — קשה ליריב להתגונן.")
            }
            let frontline = allies.filter { $0.tankiness >= 2 }.count
            if frontline == 0 { weaknesses.append("אין קו קדמי עמיד — הימנעו מקרבות ארוכים פנים מול פנים.") }
            if frontline >= 2 { strengths.append("קו קדמי חזק (\(frontline) גיבורים עמידים).") }
            let allyCC = allies.reduce(0) { $0 + $1.cc }
            let enemyCC = enemies.reduce(0) { $0 + $1.cc }
            if allyCC >= 9 { strengths.append("הרבה שליטה (CC) — טוב לפתיחת קרבות ותפיסת יעדים.") }
            if !enemies.isEmpty && allyCC + 3 <= enemyCC { weaknesses.append("ליריב יותר שליטה (CC) — שקלו Tough Boots והישארו מפוזרים.") }
            if allies.reduce(0, { $0 + $1.healing }) >= 3 { strengths.append("ריפוי בקבוצה — יתרון בקרבות ארוכים.") }
        }

        if !enemies.isEmpty {
            if enemies.reduce(0, { $0 + $1.healing }) >= 3 { weaknesses.append("ליריב ריפוי משמעותי — לפחות שחקן אחד צריך Anti-Heal.") }
            let divers = enemies.filter { ($0.primaryRole == "Assassin" || $0.primaryRole == "Fighter") && $0.mobility >= 3 }
            let carries = allies.filter { $0.basicAttacker || $0.primaryRole == "Mage" }
            if !divers.isEmpty && !carries.isEmpty {
                weaknesses.append("ליריב מתנקשים ניידים (\(divers.map(\.name).joined(separator: ", "))) — שמרו על \(carries.map(\.name).joined(separator: ", ")).")
            }
            if enemies.filter({ $0.tankiness >= 2 }).count >= 2 {
                notes.append("ליריב שני גיבורים עמידים או יותר — חדירה (Penetration) חשובה לנזק שלכם.")
            }
        }

        if let me {
            for e in enemies {
                if me.weakAgainst.contains(e.name) { notes.append("\(e.name) מסומן במאגר כקאונטר ל-\(me.name) — שחקו בזהירות מולו.") }
                if me.strongAgainst.contains(e.name) { notes.append("\(me.name) מסומן במאגר כחזק מול \(e.name).") }
            }
            let syn = allies.filter { $0.name != me.name && me.synergy.contains($0.name) }
            if !syn.isEmpty { strengths.append("סינרגיה של \(me.name) עם \(syn.map(\.name).joined(separator: ", ")) (לפי המאגר).") }
        }

        return CompositionReport(strengths: strengths, weaknesses: weaknesses, matchupNotes: notes,
                                 allyPhysicalShare: allyPhys, enemyPhysicalShare: enemyPhys)
    }
}
