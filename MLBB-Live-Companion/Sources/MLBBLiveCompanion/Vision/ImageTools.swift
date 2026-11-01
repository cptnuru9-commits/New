import AppKit
import CoreGraphics
import ImageIO
import MLBBCore
import UniformTypeIdentifiers

enum ImageTools {
    static let colorSpace = CGColorSpaceCreateDeviceRGB()

    /// Resamples an image into an RGBA8 buffer of the given size.
    static func rgba(_ image: CGImage, width: Int, height: Int) -> [UInt8] {
        var data = [UInt8](repeating: 0, count: width * height * 4)
        data.withUnsafeMutableBytes { ptr in
            guard let ctx = CGContext(data: ptr.baseAddress, width: width, height: height, bitsPerComponent: 8,
                                      bytesPerRow: width * 4, space: colorSpace,
                                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return }
            ctx.interpolationQuality = .medium
            ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        }
        return data
    }

    static func gray(_ image: CGImage, width: Int, height: Int) -> [UInt8] {
        let px = rgba(image, width: width, height: height)
        var g = [UInt8](repeating: 0, count: width * height)
        for i in 0..<(width * height) {
            let v = 0.299 * Double(px[i * 4]) + 0.587 * Double(px[i * 4 + 1]) + 0.114 * Double(px[i * 4 + 2])
            g[i] = UInt8(min(255, max(0, v)))
        }
        return g
    }

    static func fingerprint(_ image: CGImage) -> FrameFingerprint {
        FrameFingerprint(gray: gray(image, width: 48, height: 27), width: 48, height: 27)
    }

    /// Crop using a normalised (top-left origin) rect.
    static func crop(_ image: CGImage, _ r: NormalizedRect) -> CGImage? {
        let w = Double(image.width), h = Double(image.height)
        let rect = CGRect(x: r.x * w, y: r.y * h, width: r.width * w, height: r.height * h).integral
            .intersection(CGRect(x: 0, y: 0, width: w, height: h))
        guard rect.width >= 2, rect.height >= 2 else { return nil }
        return image.cropping(to: rect)
    }

    /// Appearance descriptor of an icon crop. A small inset ignores frames/borders around icons.
    static func descriptor(_ image: CGImage, inset: Double = 0.12) -> IconDescriptor {
        let inner = crop(image, NormalizedRect(x: inset, y: inset, width: 1 - 2 * inset, height: 1 - 2 * inset)) ?? image
        let side = IconDescriptor.side
        return IconDescriptor.make(rgba: rgba(inner, width: side, height: side), width: side, height: side)
    }

    static func scaled(_ image: CGImage, maxWidth: Int) -> CGImage {
        guard image.width > maxWidth else { return image }
        let w = maxWidth
        let h = max(1, Int(Double(image.height) * Double(maxWidth) / Double(image.width)))
        guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return image }
        ctx.interpolationQuality = .high
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
        return ctx.makeImage() ?? image
    }

    static func load(_ url: URL) -> CGImage? {
        guard let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        return CGImageSourceCreateImageAtIndex(src, 0, nil)
    }

    static func savePNG(_ image: CGImage, to url: URL) throws {
        guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
            throw CocoaError(.fileWriteUnknown)
        }
        CGImageDestinationAddImage(dest, image, nil)
        guard CGImageDestinationFinalize(dest) else { throw CocoaError(.fileWriteUnknown) }
    }

    static func nsImage(_ cg: CGImage) -> NSImage {
        NSImage(cgImage: cg, size: NSSize(width: cg.width, height: cg.height))
    }
}
