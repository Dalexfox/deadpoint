import ExpoModulesCore
import AVFoundation
import UIKit

// Composites a (transparent) overlay image onto a video and exports a new clip.
// Used to "burn" the Deadpoint card (grade / gym / mark) onto a climb's video so
// the shared clip carries the brand. iOS-only.
public class BrandedVideoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BrandedVideo")

    // compose(videoUri, overlayUri) -> output video file URI
    // Both inputs are LOCAL files (the JS layer downloads the remote clip first
    // and captures the overlay PNG). Returns a file:// URI to the rendered mp4.
    AsyncFunction("compose") { (videoUri: String, overlayUri: String, promise: Promise) in
      self.compose(videoUri: videoUri, overlayUri: overlayUri, promise: promise)
    }
  }

  private func fileURL(from uri: String) -> URL? {
    if uri.hasPrefix("file://") { return URL(string: uri) }
    if uri.hasPrefix("http") { return URL(string: uri) } // AVURLAsset can stream, but we expect local
    return URL(fileURLWithPath: uri)
  }

  private func compose(videoUri: String, overlayUri: String, promise: Promise) {
    guard let videoURL = fileURL(from: videoUri) else {
      promise.reject("ERR_VIDEO_URI", "Invalid video URI"); return
    }
    guard let overlayURL = fileURL(from: overlayUri),
          let overlayData = try? Data(contentsOf: overlayURL),
          let overlayImage = UIImage(data: overlayData)?.cgImage else {
      promise.reject("ERR_OVERLAY", "Could not load the overlay image"); return
    }

    let asset = AVURLAsset(url: videoURL)
    guard let videoTrack = asset.tracks(withMediaType: .video).first else {
      promise.reject("ERR_NO_VIDEO_TRACK", "No video track in the asset"); return
    }

    let composition = AVMutableComposition()
    guard let compVideoTrack = composition.addMutableTrack(
      withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else {
      promise.reject("ERR_COMPOSITION", "Could not create the video track"); return
    }

    let timeRange = CMTimeRange(start: .zero, duration: asset.duration)
    do {
      try compVideoTrack.insertTimeRange(timeRange, of: videoTrack, at: .zero)
      // Carry audio across if present.
      if let audioTrack = asset.tracks(withMediaType: .audio).first,
         let compAudioTrack = composition.addMutableTrack(
            withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) {
        try compAudioTrack.insertTimeRange(timeRange, of: audioTrack, at: .zero)
      }
    } catch {
      promise.reject("ERR_INSERT_TRACK", error.localizedDescription); return
    }

    // Respect the source orientation: render size is the natural size AFTER the
    // track's preferredTransform (portrait clips are stored landscape + a rotation).
    let naturalSize = videoTrack.naturalSize
    let transform = videoTrack.preferredTransform
    let transformedRect = CGRect(origin: .zero, size: naturalSize).applying(transform)
    let renderSize = CGSize(width: abs(transformedRect.width), height: abs(transformedRect.height))

    let videoComposition = AVMutableVideoComposition()
    videoComposition.renderSize = renderSize
    videoComposition.frameDuration = CMTime(value: 1, timescale: 30)

    let instruction = AVMutableVideoCompositionInstruction()
    instruction.timeRange = timeRange
    let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: compVideoTrack)
    layerInstruction.setTransform(transform, at: .zero)
    instruction.layerInstructions = [layerInstruction]
    videoComposition.instructions = [instruction]

    // Core Animation overlay: the video renders into videoLayer, overlayLayer
    // (the branded PNG) sits on top, both sized to the render frame.
    let videoLayer = CALayer()
    videoLayer.frame = CGRect(origin: .zero, size: renderSize)
    let overlayLayer = CALayer()
    overlayLayer.frame = CGRect(origin: .zero, size: renderSize)
    overlayLayer.contents = overlayImage
    overlayLayer.contentsGravity = .resize
    overlayLayer.isGeometryFlipped = true // CA render space is y-up; keep the PNG upright

    let parentLayer = CALayer()
    parentLayer.frame = CGRect(origin: .zero, size: renderSize)
    parentLayer.addSublayer(videoLayer)
    parentLayer.addSublayer(overlayLayer)

    videoComposition.animationTool =
      AVVideoCompositionCoreAnimationTool(postProcessingAsVideoLayer: videoLayer, in: parentLayer)

    guard let export = AVAssetExportSession(
      asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
      promise.reject("ERR_EXPORT_SESSION", "Could not create the export session"); return
    }
    let outName = "deadpoint-branded-\(Int(Date().timeIntervalSince1970)).mp4"
    let outputURL = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(outName)
    try? FileManager.default.removeItem(at: outputURL)

    export.outputURL = outputURL
    export.outputFileType = .mp4
    export.videoComposition = videoComposition
    export.shouldOptimizeForNetworkUse = true

    export.exportAsynchronously {
      DispatchQueue.main.async {
        switch export.status {
        case .completed:
          promise.resolve(outputURL.absoluteString)
        case .failed:
          promise.reject("ERR_EXPORT_FAILED", export.error?.localizedDescription ?? "Export failed")
        case .cancelled:
          promise.reject("ERR_EXPORT_CANCELLED", "Export was cancelled")
        default:
          promise.reject("ERR_EXPORT_STATE", "Unexpected export status")
        }
      }
    }
  }
}
