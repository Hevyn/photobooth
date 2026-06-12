import SwiftUI
import ARKit
import CoreImage
import CoreImage.CIFilterBuiltins

private let kBaseURL = "https://saewoo-v-o3o-v.vercel.app"

struct CameraView: View {

    let queue: UploadQueue   // 앱 진입점에서 주입 (SupabaseService.shared.upload 와 묶임)

    @StateObject private var camera = CameraSession()
    @State private var stage: UploadStage? = nil
    @State private var queueCount: Int = 0
    @State private var showFailureBanner: Bool = false
    @State private var qrPhotoId: String? = nil   // 업로드 성공 후 표시할 QR 의 photoId

    var body: some View {
        ZStack {
            // ── sceneView (영상에 들어가는 영역) ──────────────────────
            ARSceneViewRepresentable(view: camera.sceneView)
                .ignoresSafeArea()

            // 정적 오버레이 미리보기. 합성은 별도(CameraSession.compositeOverlay)로
            // 사진/영상에 들어감 — 여기는 사용자에게 결과 미리 보여주는 용도.
            overlayPreview
                .allowsHitTesting(false)
                .ignoresSafeArea()

            // ── 아래부터는 sceneView **바깥** — 영상에 안 들어감 ─────
            VStack {
                HStack {
                    if camera.faceTracking {
                        Label("얼굴 인식 중", systemImage: "face.smiling")
                            .font(.caption).foregroundStyle(.white)
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background(.black.opacity(0.35), in: Capsule())
                    }
                    Spacer()
                    queueStatusCorner
                }
                Spacer()
                filterStrip
                    .padding(.bottom, 12)
                shutterButton
                    .padding(.bottom, 40)
            }
            .padding()

            countdownOverlay
            stageBanner
            failureBanner
            qrOverlay
        }
        .background(.black)
        .onAppear {
            UIApplication.shared.isIdleTimerDisabled = true   // 현장 운영 중 화면 안 꺼지게
            camera.startSession()
            Task { queueCount = await queue.pendingCount }
            Task { await queue.startBackgroundWorker() }
        }
        .onDisappear {
            UIApplication.shared.isIdleTimerDisabled = false
            camera.stopSession()
        }
    }

    // MARK: - Subviews

    @ViewBuilder
    private var overlayPreview: some View {
        if camera.activeFilter.kind == .overlay,
           let assetName = camera.activeFilter.assetName,
           let url = Bundle.main.url(forResource: assetName, withExtension: "png"),
           let img = UIImage(contentsOfFile: url.path) {
            // PNG 비율 유지로 화면 안에 fit. 사진/영상의 4:3 영역과 동일 위치에 표시됨.
            Image(uiImage: img)
                .resizable()
                .aspectRatio(contentMode: .fit)
        }
    }

    private var filterStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(Filter.all) { filter in
                    FilterThumb(filter: filter, isSelected: filter.id == camera.activeFilter.id)
                        .onTapGesture {
                            camera.activeFilter = filter
                        }
                }
            }
            .padding(.horizontal, 8)
        }
        .frame(height: 88)
    }

    private var shutterButton: some View {
        Button(action: { Task { await capture() } }) {
            ZStack {
                Circle().stroke(.white, lineWidth: 5).frame(width: 92, height: 92)
                Circle().fill(.white).frame(width: 76, height: 76)
            }
        }
        .disabled(camera.state != .idle || stage != nil || qrPhotoId != nil)
        .opacity(camera.state == .idle && stage == nil && qrPhotoId == nil ? 1 : 0.5)
    }

    // MARK: - QR Overlay

    @ViewBuilder
    private var qrOverlay: some View {
        if let photoId = qrPhotoId {
            ZStack {
                Color.black.opacity(0.75).ignoresSafeArea()
                VStack(spacing: 24) {
                    Text("QR을 스캔해주세요♡")
                        .font(.title.bold())
                        .foregroundStyle(.white)
                    if let qr = Self.makeQRCode(from: "\(kBaseURL)/edit/\(photoId)") {
                        Image(uiImage: qr)
                            .interpolation(.none)
                            .resizable()
                            .frame(width: 320, height: 320)
                            .padding(16)
                            .background(.white)
                            .cornerRadius(16)
                    }
                    Text("감사합니다 - 새우 -")
                        .font(.headline)
                        .foregroundStyle(.white.opacity(0.85))
                    Button {
                        withAnimation { qrPhotoId = nil }
                    } label: {
                        Text("확인")
                            .font(.title3.bold())
                            .padding(.horizontal, 40).padding(.vertical, 14)
                            .background(Color.white, in: Capsule())
                            .foregroundStyle(.black)
                    }
                    .padding(.top, 8)
                }
            }
            .transition(.opacity)
        }
    }

    /// QR 코드 PNG 생성 (Core Image 의 CIQRCodeGenerator)
    private static func makeQRCode(from text: String) -> UIImage? {
        let data = Data(text.utf8)
        let filter = CIFilter.qrCodeGenerator()
        filter.message = data
        filter.correctionLevel = "M"
        guard let outputImage = filter.outputImage else { return nil }
        // 픽셀 깨짐 없게 큰 사이즈로 확대 (interpolation none 과 함께)
        let scaled = outputImage.transformed(by: CGAffineTransform(scaleX: 10, y: 10))
        let context = CIContext()
        guard let cg = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cg)
    }

    @ViewBuilder
    private var countdownOverlay: some View {
        if case let .countdown(n) = camera.state {
            Text("\(n)")
                .font(.system(size: 200, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.5), radius: 12, y: 6)
                .transition(.scale.combined(with: .opacity))
                .id(n)   // 숫자 바뀔 때마다 transition 트리거
        }
    }

    @ViewBuilder
    private var stageBanner: some View {
        if let stage {
            VStack {
                Spacer().frame(height: 80)
                Text(stage.message)
                    .font(.headline)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(.black.opacity(0.55), in: Capsule())
                Spacer()
            }
            .transition(.opacity)
        }
    }

    @ViewBuilder
    private var failureBanner: some View {
        if showFailureBanner {
            VStack {
                Spacer().frame(height: 80)
                Text("전송이 늦어져요. 다시 한 번 찍어주세요")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(Color.pink.opacity(0.85), in: Capsule())
                Spacer()
            }
            .transition(.opacity)
        }
    }

    private var queueStatusCorner: some View {
        Group {
            if queueCount > 0 {
                HStack(spacing: 10) {
                    Text("📤 대기 \(queueCount)장")
                        .font(.caption.weight(.semibold))
                    Button("재전송") {
                        Task {
                            await queue.retryAll()
                            queueCount = await queue.pendingCount
                        }
                    }
                    .buttonStyle(.bordered).controlSize(.mini).tint(.white)
                    Button("비우기") {
                        Task {
                            await queue.removeAll()
                            queueCount = await queue.pendingCount
                        }
                    }
                    .buttonStyle(.bordered).controlSize(.mini).tint(.white)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(.black.opacity(0.45), in: Capsule())
            }
        }
    }

    // MARK: - Capture flow

    private func capture() async {
        do {
            let result = try await camera.startCapture()
            let job = try await queue.enqueue(photo: result.photo, video: result.videoURL)
            queueCount = await queue.pendingCount

            // 전경 업로드 단계 스트림 구독 → 메시지 갱신
            for await s in queue.uploadForeground(job) {
                await MainActor.run {
                    withAnimation(.easeInOut(duration: 0.2)) { self.stage = s }
                }
                switch s {
                case .succeeded:
                    await MainActor.run {
                        withAnimation {
                            self.stage = nil
                            self.qrPhotoId = job.id.uuidString
                        }
                    }
                    queueCount = await queue.pendingCount
                case .failed:
                    await MainActor.run {
                        withAnimation {
                            self.stage = nil
                            self.showFailureBanner = true
                        }
                    }
                    queueCount = await queue.pendingCount
                    Task {
                        try? await Task.sleep(nanoseconds: 3_000_000_000)
                        await MainActor.run {
                            withAnimation { self.showFailureBanner = false }
                        }
                    }
                default:
                    continue
                }
            }
        } catch {
            await MainActor.run {
                withAnimation { self.showFailureBanner = true }
            }
            Task {
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                await MainActor.run {
                    withAnimation { self.showFailureBanner = false }
                }
            }
        }
    }
}

// MARK: - Helpers

private extension UploadStage {
    var message: String {
        switch self {
        case .uploading:    return "✨ 전송 중..."
        case .reconnecting: return "📡 재연결 중..."
        case .checkNetwork: return "📡 데이터/와이파이 확인해주세요"
        case .succeeded:    return ""
        case .failed:       return ""
        }
    }
}

struct ARSceneViewRepresentable: UIViewRepresentable {
    let view: ARSCNView
    func makeUIView(context: Context) -> ARSCNView { view }
    func updateUIView(_ uiView: ARSCNView, context: Context) {}
}

private struct FilterThumb: View {
    let filter: Filter
    let isSelected: Bool

    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                Circle()
                    .fill(.white.opacity(0.18))
                    .frame(width: 56, height: 56)
                thumbContent
            }
            .overlay(
                Circle()
                    .stroke(isSelected ? Color.white : .clear, lineWidth: 3)
            )
            Text(filter.displayName)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.5), radius: 2)
                .lineLimit(1)
        }
    }

    @ViewBuilder
    private var thumbContent: some View {
        if filter.kind == .none {
            Image(systemName: "circle.slash")
                .font(.system(size: 22))
                .foregroundStyle(.white)
        } else if let assetName = filter.assetName,
                  let url = Bundle.main.url(forResource: assetName, withExtension: "png"),
                  let img = UIImage(contentsOfFile: url.path) {
            Image(uiImage: img)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 46, height: 46)
        } else {
            Image(systemName: "questionmark")
                .foregroundStyle(.white)
        }
    }
}
