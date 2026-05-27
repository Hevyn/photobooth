import Foundation
import Network

// MARK: - Models

/// 업로드 대기 중인 한 건. id는 photos 테이블의 primary key가 됨.
struct UploadJob: Codable, Identifiable, Equatable {
    let id: UUID
    let photoPath: String       // Application Support 기준 상대 경로
    let videoPath: String?
    var attempts: Int
    let createdAt: Date
}

/// UI에 표시할 현재 시도 단계. 시간 X, 실제 시도 단계 변화에 연동.
enum UploadStage {
    case uploading              // "✨ 전송 중..."
    case reconnecting           // "📡 재연결 중..."
    case checkNetwork           // "📡 데이터/와이파이 확인해주세요"
    case succeeded              // 종료
    case failed(Error)          // 종료
}

enum UploadError: Error {
    case timeout
    case fileMissing
    case maxRetryReached
}

// MARK: - UploadQueue

/// 영속 업로드 큐.
/// - 전경: `uploadForeground(_:)` — 3번 시도 (7s / 2s / 2s), AsyncStream으로 단계 emit
/// - 백그라운드: 네트워크 복귀 감지 시 큐 전체 1회 시도
/// - 24h 지난 job은 enqueue/background 진입 시 자동 drop
actor UploadQueue {

    typealias Uploader = (UploadJob, URL, URL?) async throws -> Void
    // (job, 사진 절대 URL, 영상 절대 URL?) — SupabaseClient가 주입됨

    // MARK: Config

    private let foregroundTimeouts: [TimeInterval] = [7, 2, 2]
    private let foregroundStages: [UploadStage] = [.uploading, .reconnecting, .checkNetwork]
    private let retentionInterval: TimeInterval = 24 * 60 * 60

    // MARK: Dependencies

    private let uploader: Uploader
    private let fileManager = FileManager.default

    // MARK: State

    private var jobs: [UploadJob] = []
    private let monitor = NetworkMonitor()
    private var backgroundStarted = false

    // MARK: Paths

    private let root: URL
    private let imagesDir: URL
    private let videosDir: URL
    private let manifestURL: URL

    init(uploader: @escaping Uploader) throws {
        self.uploader = uploader

        let support = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        self.root = support.appendingPathComponent("upload_queue", isDirectory: true)
        self.imagesDir = root.appendingPathComponent("images", isDirectory: true)
        self.videosDir = root.appendingPathComponent("videos", isDirectory: true)
        self.manifestURL = root.appendingPathComponent("manifest.json")

        try fileManager.createDirectory(at: imagesDir, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: videosDir, withIntermediateDirectories: true)

        // root는 iCloud 백업 대상 제외 (임시 큐)
        var rootCopy = root
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? rootCopy.setResourceValues(values)
    }

    // MARK: - Public API

    var pendingCount: Int {
        jobs.count
    }

    /// 새 사진(+영상)을 큐에 적재하고 job 반환. 파일은 큐 폴더로 이동(복사) 저장.
    func enqueue(photo: Data, video: URL?) async throws -> UploadJob {
        await loadIfNeeded()
        dropExpired()

        let id = UUID()
        let photoRel = "images/\(id.uuidString).jpg"
        let photoAbs = root.appendingPathComponent(photoRel)
        try photo.write(to: photoAbs, options: .atomic)

        var videoRel: String? = nil
        if let video {
            let rel = "videos/\(id.uuidString).mp4"
            let abs = root.appendingPathComponent(rel)
            // 원본은 보통 임시 디렉토리에 있으니 move
            if fileManager.fileExists(atPath: abs.path) {
                try? fileManager.removeItem(at: abs)
            }
            try fileManager.moveItem(at: video, to: abs)
            videoRel = rel
        }

        let job = UploadJob(
            id: id,
            photoPath: photoRel,
            videoPath: videoRel,
            attempts: 0,
            createdAt: Date()
        )
        jobs.append(job)
        try saveManifest()
        return job
    }

    /// 전경 업로드. 호출자는 AsyncStream을 await for 하면서 UI 메시지를 갱신.
    /// 성공/실패가 결정되면 stream이 finish.
    nonisolated func uploadForeground(_ job: UploadJob) -> AsyncStream<UploadStage> {
        AsyncStream { continuation in
            let task = Task {
                await self.runForeground(job, continuation: continuation)
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    private func runForeground(
        _ job: UploadJob,
        continuation: AsyncStream<UploadStage>.Continuation
    ) async {
        let photoAbs = root.appendingPathComponent(job.photoPath)
        let videoAbs = job.videoPath.map { root.appendingPathComponent($0) }

        guard fileManager.fileExists(atPath: photoAbs.path) else {
            continuation.yield(.failed(UploadError.fileMissing))
            continuation.finish()
            return
        }

        for (index, timeout) in foregroundTimeouts.enumerated() {
            continuation.yield(foregroundStages[index])
            do {
                try await withTimeout(timeout) {
                    try await self.uploader(job, photoAbs, videoAbs)
                }
                print("[UploadQueue] ✅ job \(job.id) upload succeeded (attempt \(index + 1))")
                // 성공 → 큐에서 제거하고 파일 정리
                await removeJob(job.id)
                continuation.yield(.succeeded)
                continuation.finish()
                return
            } catch {
                print("[UploadQueue] ❌ job \(job.id) attempt \(index + 1)/\(foregroundTimeouts.count) failed:")
                print("    error type: \(type(of: error))")
                print("    error: \(error)")
                if let localized = (error as NSError?)?.localizedDescription {
                    print("    localized: \(localized)")
                }
                await bumpAttempts(job.id)
                if Task.isCancelled { break }
                continue
            }
        }

        continuation.yield(.failed(UploadError.maxRetryReached))
        continuation.finish()
    }

    /// 네트워크 복귀 감지 시 백그라운드에서 큐 1회 시도. 단일 호출로 시작.
    func startBackgroundWorker() {
        guard !backgroundStarted else { return }
        backgroundStarted = true
        monitor.start { [weak self] in
            Task { await self?.runBackgroundOnce() }
        }
    }

    private func runBackgroundOnce() async {
        await loadIfNeeded()
        dropExpired()
        let snapshot = jobs
        for job in snapshot {
            let photoAbs = root.appendingPathComponent(job.photoPath)
            let videoAbs = job.videoPath.map { root.appendingPathComponent($0) }
            guard fileManager.fileExists(atPath: photoAbs.path) else {
                await removeJob(job.id)
                continue
            }
            do {
                try await withTimeout(15) {
                    try await self.uploader(job, photoAbs, videoAbs)
                }
                await removeJob(job.id)
            } catch {
                await bumpAttempts(job.id)
                // 백그라운드는 조용히 실패만 기록, 다음 네트워크 복귀 때 다시 시도
            }
        }
    }

    /// 운영자 버튼 — 큐 전체 재전송 1라운드
    func retryAll() async {
        await runBackgroundOnce()
    }

    /// 운영자 버튼 — 큐 전체 비우기
    func removeAll() async {
        for job in jobs {
            removeFiles(for: job)
        }
        jobs.removeAll()
        try? saveManifest()
    }

    // MARK: - Internals

    private var loaded = false
    private func loadIfNeeded() async {
        guard !loaded else { return }
        loaded = true
        guard fileManager.fileExists(atPath: manifestURL.path),
              let data = try? Data(contentsOf: manifestURL),
              let decoded = try? JSONDecoder.iso8601.decode([UploadJob].self, from: data)
        else { return }
        jobs = decoded
    }

    private func saveManifest() throws {
        let data = try JSONEncoder.iso8601.encode(jobs)
        try data.write(to: manifestURL, options: .atomic)
    }

    private func dropExpired() {
        let cutoff = Date().addingTimeInterval(-retentionInterval)
        let (keep, drop) = jobs.partitioned { $0.createdAt >= cutoff }
        for job in drop { removeFiles(for: job) }
        if !drop.isEmpty {
            jobs = keep
            try? saveManifest()
        }
    }

    private func removeJob(_ id: UUID) async {
        guard let idx = jobs.firstIndex(where: { $0.id == id }) else { return }
        let job = jobs.remove(at: idx)
        removeFiles(for: job)
        try? saveManifest()
    }

    private func bumpAttempts(_ id: UUID) async {
        guard let idx = jobs.firstIndex(where: { $0.id == id }) else { return }
        jobs[idx].attempts += 1
        try? saveManifest()
    }

    private func removeFiles(for job: UploadJob) {
        let photoAbs = root.appendingPathComponent(job.photoPath)
        try? fileManager.removeItem(at: photoAbs)
        if let videoRel = job.videoPath {
            let videoAbs = root.appendingPathComponent(videoRel)
            try? fileManager.removeItem(at: videoAbs)
        }
    }
}

// MARK: - Timeout helper

private func withTimeout<T: Sendable>(
    _ seconds: TimeInterval,
    operation: @escaping @Sendable () async throws -> T
) async throws -> T {
    try await withThrowingTaskGroup(of: T.self) { group in
        group.addTask { try await operation() }
        group.addTask {
            try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            throw UploadError.timeout
        }
        let result = try await group.next()!
        group.cancelAll()
        return result
    }
}

// MARK: - NetworkMonitor (얇은 래퍼)

private final class NetworkMonitor {
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "photobooth.network-monitor")
    private var wasAvailable = false
    private var onBecameAvailable: (() -> Void)?

    func start(onBecameAvailable: @escaping () -> Void) {
        self.onBecameAvailable = onBecameAvailable
        monitor.pathUpdateHandler = { [weak self] path in
            guard let self else { return }
            let available = path.status == .satisfied
            // 끊겼다 → 연결 전환 시점에만 트리거 (계속 연결돼있는 동안 반복 호출 방지)
            if available && !self.wasAvailable {
                self.onBecameAvailable?()
            }
            self.wasAvailable = available
        }
        monitor.start(queue: queue)
    }
}

// MARK: - 작은 유틸

private extension Array {
    func partitioned(_ belongsInFirst: (Element) -> Bool) -> ([Element], [Element]) {
        var a: [Element] = [], b: [Element] = []
        for e in self {
            if belongsInFirst(e) { a.append(e) } else { b.append(e) }
        }
        return (a, b)
    }
}

private extension JSONEncoder {
    static let iso8601: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }()
}

private extension JSONDecoder {
    static let iso8601: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()
}
