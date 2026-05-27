import SwiftUI
import ARKit

struct CameraView: View {

    let queue: UploadQueue   // 앱 진입점에서 주입 (SupabaseService.shared.upload 와 묶임)

    @StateObject private var camera = CameraSession()
    @State private var stage: UploadStage? = nil
    @State private var queueCount: Int = 0
    @State private var showFailureBanner: Bool = false

    var body: some View {
        ZStack {
            // ── sceneView (영상에 들어가는 영역) ──────────────────────
            ARSceneViewRepresentable(view: camera.sceneView)
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
                shutterButton
                    .padding(.bottom, 40)
            }
            .padding()

            countdownOverlay
            stageBanner
            failureBanner
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

    private var shutterButton: some View {
        Button(action: { Task { await capture() } }) {
            ZStack {
                Circle().stroke(.white, lineWidth: 5).frame(width: 92, height: 92)
                Circle().fill(.white).frame(width: 76, height: 76)
            }
        }
        .disabled(camera.state != .idle || stage != nil)
        .opacity(camera.state == .idle && stage == nil ? 1 : 0.5)
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
                        withAnimation { self.stage = nil }
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
