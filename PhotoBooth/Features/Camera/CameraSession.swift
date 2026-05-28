import Foundation
import ARKit
import SceneKit
import AVFoundation
import UIKit
import Combine

/// 카메라 + ARKit + 영상 녹화 한 묶음.
/// - SwiftUI 뷰는 `sceneView` 를 그대로 표시하고 `state` 를 구독해 카운트다운/상태 UI 그림
/// - 카운트다운 숫자/UI 는 `sceneView` **바깥** ZStack 으로 두면 영상에 안 들어감 (snapshot 이 sceneView 만 캡처)
@MainActor
final class CameraSession: NSObject, ObservableObject {

    // MARK: - Public State

    enum State: Equatable {
        case idle
        case countdown(Int)     // 3, 2, 1
        case capturing          // 셔터 직후 ~0.3s
        case finishing          // 영상 finalize 중
    }

    struct CaptureResult {
        let photo: Data         // JPEG (마지막 "1" 시점 프레임)
        let videoURL: URL?      // 임시 .mp4 (recordVideoEnabled = false 면 nil)
    }

    @Published private(set) var state: State = .idle
    @Published private(set) var faceTracking: Bool = false  // 카메라 위에 "얼굴 인식 중" 작게 띄울 때 사용

    let sceneView: ARSCNView = {
        let v = ARSCNView()
        v.automaticallyUpdatesLighting = true
        v.rendersContinuously = true
        v.scene = SCNScene()
        v.backgroundColor = .black
        return v
    }()

    // MARK: - Config

    /// 🐛 디버깅 토글 — false 면 영상 녹화 OFF (사진만 업로드).
    /// 디버거 attached 시 영상 인코딩이 너무 무거워 메인 스레드 블록 → 콘솔 확인 불가.
    /// 진단 끝나면 true 로 복원.
    private let recordVideoEnabled: Bool = true

    private let videoFPS: Int = 15
    private let videoSize = CGSize(width: 960, height: 720)   // 4:3 가로형
    private let photoSize = CGSize(width: 1440, height: 1080) // 4:3 가로형, 영상보다 큼
    private let videoBitrate: Int = 2_000_000
    private let postShutterTail: TimeInterval = 0.3   // "찰칵" 후 추가 녹화

    // MARK: - Internals

    private let captureQueue = DispatchQueue(label: "photobooth.camera.capture")
    private var writer: AVAssetWriter?
    private var writerInput: AVAssetWriterInput?
    private var pixelBufferAdaptor: AVAssetWriterInputPixelBufferAdaptor?
    private var displayLink: CADisplayLink?
    private var recordingStart: CFTimeInterval = 0
    private var lastFramePresentationTime: CMTime = .zero
    private var currentResultContinuation: CheckedContinuation<CaptureResult, Error>?
    private var capturedPhoto: Data?

    // MARK: - Lifecycle

    override init() {
        super.init()
        sceneView.session.delegate = self
        sceneView.delegate = self
    }

    /// SwiftUI `onAppear` 에서 호출.
    func startSession() {
        guard ARFaceTrackingConfiguration.isSupported else {
            // 시뮬레이터 또는 미지원 기기 — 카메라 뷰만 비어있게 둠
            return
        }
        let config = ARFaceTrackingConfiguration()
        config.isLightEstimationEnabled = true
        sceneView.session.run(config, options: [.resetTracking, .removeExistingAnchors])
    }

    func stopSession() {
        sceneView.session.pause()
    }

    // MARK: - Capture

    /// 셔터. 카운트다운 시작 + 즉시 녹화 시작.
    /// 총 ~3.3초 후 (photo, videoURL) 반환.
    func startCapture() async throws -> CaptureResult {
        guard state == .idle else {
            throw CaptureError.busy
        }

        // 영상 OFF 모드면 writer/displayLink 셋업 skip
        if recordVideoEnabled {
            try setupWriter()
            startDisplayLink()
        }

        return try await withCheckedThrowingContinuation { cont in
            self.currentResultContinuation = cont
            Task { await self.runCountdownAndFinish() }
        }
    }

    private func runCountdownAndFinish() async {
        for n in [3, 2, 1] {
            state = .countdown(n)
            try? await Task.sleep(nanoseconds: 1_000_000_000)
        }
        // 마지막 "1" 끝나는 순간 = 사진 캡처 시점
        state = .capturing
        capturedPhoto = snapshotJPEG()

        if recordVideoEnabled {
            // 0.3 초 더 녹화 후 finalize
            try? await Task.sleep(nanoseconds: UInt64(postShutterTail * 1_000_000_000))
            state = .finishing
            await finishWriting()
        } else {
            // 영상 없이 즉시 결과 반환
            defer {
                self.capturedPhoto = nil
                reset()
            }
            if let photo = capturedPhoto {
                let result = CaptureResult(photo: photo, videoURL: nil)
                currentResultContinuation?.resume(returning: result)
            } else {
                currentResultContinuation?.resume(throwing: CaptureError.writerSetupFailed)
            }
            currentResultContinuation = nil
        }
    }

    // MARK: - Writer setup

    private func setupWriter() throws {
        let tmpURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("mp4")

        let writer = try AVAssetWriter(outputURL: tmpURL, fileType: .mp4)

        let settings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: Int(videoSize.width),
            AVVideoHeightKey: Int(videoSize.height),
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: videoBitrate,
                AVVideoExpectedSourceFrameRateKey: videoFPS,
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
            ]
        ]
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
        input.expectsMediaDataInRealTime = true

        let attrs: [String: Any] = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: Int(videoSize.width),
            kCVPixelBufferHeightKey as String: Int(videoSize.height),
            kCVPixelBufferCGImageCompatibilityKey as String: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
        ]
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: input, sourcePixelBufferAttributes: attrs
        )

        guard writer.canAdd(input) else { throw CaptureError.writerSetupFailed }
        writer.add(input)
        writer.startWriting()
        writer.startSession(atSourceTime: .zero)

        self.writer = writer
        self.writerInput = input
        self.pixelBufferAdaptor = adaptor
        self.recordingStart = CACurrentMediaTime()
    }

    private func finishWriting() async {
        displayLink?.invalidate()
        displayLink = nil

        guard let writer, let input = writerInput else {
            currentResultContinuation?.resume(throwing: CaptureError.writerSetupFailed)
            currentResultContinuation = nil
            reset()
            return
        }

        input.markAsFinished()
        await writer.finishWriting()

        defer {
            self.writer = nil
            self.writerInput = nil
            self.pixelBufferAdaptor = nil
            self.capturedPhoto = nil
            reset()
        }

        if writer.status == .completed, let photo = capturedPhoto {
            let result = CaptureResult(photo: photo, videoURL: writer.outputURL)
            currentResultContinuation?.resume(returning: result)
        } else {
            currentResultContinuation?.resume(
                throwing: writer.error ?? CaptureError.writerSetupFailed
            )
        }
        currentResultContinuation = nil
    }

    private func reset() {
        state = .idle
    }

    // MARK: - Frame pump (15fps via CADisplayLink)

    private func startDisplayLink() {
        let link = CADisplayLink(target: self, selector: #selector(tick))
        link.preferredFramesPerSecond = videoFPS
        link.add(to: .main, forMode: .common)
        displayLink = link
        lastFramePresentationTime = .zero
    }

    @objc private func tick() {
        guard let adaptor = pixelBufferAdaptor,
              let input = writerInput,
              input.isReadyForMoreMediaData
        else { return }

        guard let pool = adaptor.pixelBufferPool,
              let buffer = drawSnapshotIntoPixelBuffer(pool: pool)
        else { return }

        let elapsed = CACurrentMediaTime() - recordingStart
        let pts = CMTime(seconds: elapsed, preferredTimescale: 600)
        adaptor.append(buffer, withPresentationTime: pts)
        lastFramePresentationTime = pts
    }

    /// ARSCNView.snapshot() → CGImage → CVPixelBuffer 그리기.
    /// snapshot 은 메인스레드여야 함 → CADisplayLink 가 main 에서 돌므로 OK.
    private func drawSnapshotIntoPixelBuffer(pool: CVPixelBufferPool) -> CVPixelBuffer? {
        let uiImage = sceneView.snapshot()
        guard let cgImage = uiImage.cgImage else { return nil }

        var pb: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pb)
        guard let buffer = pb else { return nil }

        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }

        guard let base = CVPixelBufferGetBaseAddress(buffer) else { return nil }
        let cs = CGColorSpaceCreateDeviceRGB()
        guard let ctx = CGContext(
            data: base,
            width: Int(videoSize.width),
            height: Int(videoSize.height),
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
            space: cs,
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
                      | CGBitmapInfo.byteOrder32Little.rawValue
        ) else { return nil }

        // 가운데 4:3 crop 으로 videoSize 채우기
        let imgSize = CGSize(width: cgImage.width, height: cgImage.height)
        let srcRect = Self.centerCrop(in: imgSize, toAspectOf: videoSize)
        guard let cropped = cgImage.cropping(to: srcRect) else { return nil }
        ctx.draw(cropped, in: CGRect(origin: .zero, size: videoSize))
        return buffer
    }

    private func snapshotJPEG() -> Data? {
        let image = sceneView.snapshot()
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: photoSize, format: format)
        let rendered = renderer.image { _ in
            let crop = Self.centerCrop(in: image.size, toAspectOf: photoSize)
            if let cg = image.cgImage?.cropping(to: crop) {
                UIImage(cgImage: cg).draw(in: CGRect(origin: .zero, size: photoSize))
            }
        }
        return rendered.jpegData(compressionQuality: 0.9)
    }

    /// 원본 size 안에서 target 의 비율과 같은 가운데 영역을 잘라 반환.
    private static func centerCrop(in src: CGSize, toAspectOf target: CGSize) -> CGRect {
        let targetRatio = target.width / target.height
        let srcRatio = src.width / src.height
        let cropW: CGFloat
        let cropH: CGFloat
        if srcRatio > targetRatio {
            cropH = src.height
            cropW = cropH * targetRatio
        } else {
            cropW = src.width
            cropH = cropW / targetRatio
        }
        return CGRect(
            x: (src.width - cropW) / 2,
            y: (src.height - cropH) / 2,
            width: cropW, height: cropH
        )
    }

    enum CaptureError: Error {
        case busy
        case writerSetupFailed
    }
}

// MARK: - ARSessionDelegate

extension CameraSession: ARSessionDelegate {
    nonisolated func session(_ session: ARSession, didUpdate frame: ARFrame) {
        let hasFace = frame.anchors.contains(where: { $0 is ARFaceAnchor })
        Task { @MainActor in
            if self.faceTracking != hasFace { self.faceTracking = hasFace }
        }
    }
}

// MARK: - ARSCNViewDelegate (스티커 노드 attach)

extension CameraSession: ARSCNViewDelegate {
    nonisolated func renderer(_ renderer: SCNSceneRenderer, nodeFor anchor: ARAnchor) -> SCNNode? {
        guard anchor is ARFaceAnchor else { return nil }
        // MVP: 더미 스티커 1개 (실 프레임 시스템 만들 때 여기를 데이터 모델 기반으로 교체)
        return DummyStickerNode.makeNoseDot()
    }
}
