import CoreGraphics
import MLBBCore
import Vision

struct OCRLine: Sendable {
    let text: String
    /// Normalised, top-left origin, relative to the image that was read.
    let box: NormalizedRect
    let confidence: Float
}

/// On-device text recognition with Apple Vision (nothing leaves the Mac).
enum TextReader {
    static func read(_ image: CGImage, accurate: Bool = false, minimumTextHeight: Float = 0.012) -> [OCRLine] {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = accurate ? .accurate : .fast
        request.usesLanguageCorrection = false
        request.minimumTextHeight = minimumTextHeight
        let handler = VNImageRequestHandler(cgImage: image, options: [:])
        do {
            try handler.perform([request])
        } catch {
            return []
        }
        let observations = request.results ?? []
        return observations.compactMap { obs in
            guard let top = obs.topCandidates(1).first else { return nil }
            let b = obs.boundingBox   // normalised, bottom-left origin
            return OCRLine(text: top.string,
                           box: NormalizedRect(x: Double(b.minX), y: Double(1 - b.maxY), width: Double(b.width), height: Double(b.height)),
                           confidence: top.confidence)
        }
    }
}
