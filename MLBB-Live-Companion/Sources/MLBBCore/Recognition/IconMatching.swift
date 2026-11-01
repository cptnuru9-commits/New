import Foundation

/// Compact appearance descriptor of an icon: an RGB thumbnail with the mean removed and unit L2 norm,
/// so the dot product of two descriptors is their normalised cross-correlation (-1...1).
/// Robust to brightness changes and resolution (everything is resampled to the same size first).
public struct IconDescriptor: Sendable, Equatable {
    public let values: [Float]
    public let luminanceStd: Float
    public let meanLuminance: Float

    public init(values: [Float], luminanceStd: Float, meanLuminance: Float) {
        self.values = values
        self.luminanceStd = luminanceStd
        self.meanLuminance = meanLuminance
    }

    /// Side length that platform code should resample crops to before calling `make`.
    public static let side = 24

    /// Builds a descriptor from an RGBA8 buffer (row-major, 4 bytes per pixel).
    public static func make(rgba: [UInt8], width: Int, height: Int) -> IconDescriptor {
        let n = width * height
        guard n > 0, rgba.count >= n * 4 else { return IconDescriptor(values: [], luminanceStd: 0, meanLuminance: 0) }
        var v = [Float](repeating: 0, count: n * 3)
        var lumSum: Float = 0
        var lumSq: Float = 0
        for i in 0..<n {
            let r = Float(rgba[i * 4]) / 255
            let g = Float(rgba[i * 4 + 1]) / 255
            let b = Float(rgba[i * 4 + 2]) / 255
            v[i * 3] = r
            v[i * 3 + 1] = g
            v[i * 3 + 2] = b
            let l = 0.299 * r + 0.587 * g + 0.114 * b
            lumSum += l
            lumSq += l * l
        }
        let mean = v.reduce(0, +) / Float(v.count)
        var norm: Float = 0
        for i in v.indices {
            v[i] -= mean
            norm += v[i] * v[i]
        }
        norm = norm.squareRoot()
        if norm > 1e-6 {
            for i in v.indices { v[i] /= norm }
        }
        let lm = lumSum / Float(n)
        let variance = max(0, lumSq / Float(n) - lm * lm)
        return IconDescriptor(values: v, luminanceStd: variance.squareRoot(), meanLuminance: lm)
    }

    public func similarity(to other: IconDescriptor) -> Double {
        guard values.count == other.values.count, !values.isEmpty else { return -1 }
        var s: Float = 0
        for i in values.indices { s += values[i] * other.values[i] }
        return Double(s)
    }
}

/// Nearest-neighbour matcher over a labelled template library.
/// Refuses to answer (returns `.uncertain`) when the best match is weak or too close to a different label.
public struct IconMatcher: Sendable {
    public struct Entry: Sendable {
        public let label: String
        public let descriptor: IconDescriptor
        public init(label: String, descriptor: IconDescriptor) {
            self.label = label
            self.descriptor = descriptor
        }
    }

    /// Label used for "empty slot" templates in the item library.
    public static let emptyLabel = "__empty__"

    public var entries: [Entry]
    /// Minimum similarity for a confident match.
    public var acceptThreshold: Double
    /// Minimum gap between the best label and the runner-up label.
    public var minMargin: Double
    /// Crops with less luminance variation than this are treated as empty slots (when allowed).
    public var emptyLuminanceStd: Float

    public init(entries: [Entry] = [], acceptThreshold: Double = 0.80, minMargin: Double = 0.04, emptyLuminanceStd: Float = 0.035) {
        self.entries = entries
        self.acceptThreshold = acceptThreshold
        self.minMargin = minMargin
        self.emptyLuminanceStd = emptyLuminanceStd
    }

    public var labelCount: Int { Set(entries.map(\.label)).count }

    /// Best score per label, highest first.
    public func rank(_ d: IconDescriptor, top: Int = 3) -> [(label: String, score: Double)] {
        var best: [String: Double] = [:]
        for e in entries {
            let s = d.similarity(to: e.descriptor)
            if s > (best[e.label] ?? -2) { best[e.label] = s }
        }
        return best.sorted { $0.value > $1.value }.prefix(top).map { (label: $0.key, score: $0.value) }
    }

    /// Maps a similarity score and margin to a 0...1 confidence.
    public static func confidence(best: Double, margin: Double) -> Double {
        let base = min(1, max(0, (best - 0.55) / 0.40))
        let marginScore = min(1, max(0, margin / 0.12))
        return base * (0.55 + 0.45 * marginScore)
    }

    public func recognize(_ d: IconDescriptor, allowEmpty: Bool) -> Recognition {
        if allowEmpty && d.luminanceStd < emptyLuminanceStd { return .empty }
        let ranked = rank(d, top: 2)
        guard let first = ranked.first else { return .uncertain(bestGuess: nil, confidence: 0) }
        let margin = ranked.count > 1 ? first.score - ranked[1].score : 1
        let conf = IconMatcher.confidence(best: first.score, margin: margin)
        if first.score >= acceptThreshold && margin >= minMargin {
            if first.label == IconMatcher.emptyLabel { return allowEmpty ? .empty : .uncertain(bestGuess: nil, confidence: conf) }
            return .match(label: first.label, confidence: conf)
        }
        return .uncertain(bestGuess: first.label == IconMatcher.emptyLabel ? nil : first.label, confidence: conf)
    }
}

/// Tiny grayscale thumbnail used to skip analysis of frames that did not change.
public struct FrameFingerprint: Sendable, Equatable {
    public let gray: [UInt8]
    public let width: Int
    public let height: Int

    public init(gray: [UInt8], width: Int, height: Int) {
        self.gray = gray
        self.width = width
        self.height = height
    }

    /// Mean absolute difference, 0...255 (infinity when sizes differ).
    public func difference(to other: FrameFingerprint) -> Double {
        guard width == other.width, height == other.height, gray.count == other.gray.count, !gray.isEmpty else { return .infinity }
        var sum = 0
        for i in gray.indices { sum += abs(Int(gray[i]) - Int(other.gray[i])) }
        return Double(sum) / Double(gray.count)
    }
}

/// Finds the mirrored game picture inside a captured window by trimming uniform dark bars (letterboxing).
public enum ContentRectDetector {
    public static func detect(gray: [UInt8], width: Int, height: Int, darkThreshold: UInt8 = 24) -> NormalizedRect {
        guard width > 4, height > 4, gray.count >= width * height else { return .full }
        func rowIsBar(_ y: Int) -> Bool {
            var maxV: UInt8 = 0
            for x in 0..<width { maxV = max(maxV, gray[y * width + x]) }
            return maxV <= darkThreshold
        }
        func colIsBar(_ x: Int, _ y0: Int, _ y1: Int) -> Bool {
            var maxV: UInt8 = 0
            for y in y0..<y1 { maxV = max(maxV, gray[y * width + x]) }
            return maxV <= darkThreshold
        }
        var top = 0
        while top < height - 1 && rowIsBar(top) { top += 1 }
        var bottom = height
        while bottom > top + 1 && rowIsBar(bottom - 1) { bottom -= 1 }
        var left = 0
        while left < width - 1 && colIsBar(left, top, bottom) { left += 1 }
        var right = width
        while right > left + 1 && colIsBar(right - 1, top, bottom) { right -= 1 }
        let w = Double(right - left) / Double(width)
        let h = Double(bottom - top) / Double(height)
        // An almost black frame (e.g. a loading screen) must not collapse the content rect.
        if w * h < 0.3 { return .full }
        return NormalizedRect(x: Double(left) / Double(width), y: Double(top) / Double(height), width: w, height: h)
    }
}
