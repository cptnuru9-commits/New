import Foundation

/// Name normalisation and fuzzy matching (for OCR text and imported file names).
public enum NameMatcher {
    /// Lowercase, ASCII letters and digits only: "Chang'e" -> "change", "X.Borg" -> "xborg".
    public static func normalize(_ s: String) -> String {
        let folded = s.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "en_US"))
        return String(folded.lowercased().unicodeScalars.filter { CharacterSet.alphanumerics.contains($0) && $0.isASCII }.map(Character.init))
    }

    public static func levenshtein(_ a: String, _ b: String) -> Int {
        let a = Array(a), b = Array(b)
        if a.isEmpty { return b.count }
        if b.isEmpty { return a.count }
        var prev = Array(0...b.count)
        var cur = [Int](repeating: 0, count: b.count + 1)
        for i in 1...a.count {
            cur[0] = i
            for j in 1...b.count {
                let cost = a[i - 1] == b[j - 1] ? 0 : 1
                cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
            }
            swap(&prev, &cur)
        }
        return prev[b.count]
    }

    /// Best candidate within `maxDistance` edits (both sides expected to be normalised already).
    public static func bestMatch(_ query: String, in candidates: [String], maxDistance: Int) -> String? {
        var best: (String, Int)?
        for c in candidates {
            let d = levenshtein(query, c)
            if d <= maxDistance, d < (best?.1 ?? Int.max) { best = (c, d) }
        }
        return best?.0
    }

    /// True when OCR text plausibly contains the player's in-game name.
    public static func textMatchesName(_ text: String, name: String) -> Bool {
        let t = normalize(text), n = normalize(name)
        guard n.count >= 2, !t.isEmpty else { return false }
        if t.contains(n) { return true }
        let allowed = max(1, n.count / 4)
        return abs(t.count - n.count) <= allowed && levenshtein(t, n) <= allowed
    }
}

/// Parses an in-game clock such as "12:34" from OCR text.
public enum GameClockParser {
    public static func parse(_ text: String) -> Int? {
        let cleaned = text.replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "O", with: "0").replacingOccurrences(of: "o", with: "0")
        guard let range = cleaned.range(of: #"\d{1,2}[:.]\d{2}"#, options: .regularExpression) else { return nil }
        let parts = cleaned[range].split(whereSeparator: { $0 == ":" || $0 == "." })
        guard parts.count == 2, let m = Int(parts[0]), let s = Int(parts[1]), s < 60, m < 90 else { return nil }
        return m * 60 + s
    }
}
