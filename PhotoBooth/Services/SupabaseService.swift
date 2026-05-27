import Foundation
import Supabase

/// PhotoBooth 백엔드 한 진입점.
/// - 키는 xcconfig → Info.plist → Bundle 경로로 주입 (코드/리포에 키 없음)
/// - `upload(job:photoURL:videoURL:)` 를 `UploadQueue` 의 uploader 로 주입해서 사용
final class SupabaseService {

    static let shared: SupabaseService = {
        do { return try SupabaseService() }
        catch { fatalError("SupabaseService init 실패: \(error)") }
    }()

    private let client: SupabaseClient
    private let bucket = "photobooth_images"

    private init() throws {
        guard
            let rawHost = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
            !rawHost.isEmpty,
            let rawKey = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String,
            !rawKey.isEmpty
        else {
            print("[SupabaseService] ❌ missing config — xcconfig 가 Info.plist 로 안 흘러왔거나 키 이름 오타")
            throw ServiceError.missingConfig
        }

        let cleanHost = Self.sanitizeHost(rawHost)
        let cleanKey = rawKey.trimmingCharacters(in: .whitespacesAndNewlines)

        guard let url = URL(string: "https://\(cleanHost)") else {
            print("[SupabaseService] ❌ invalid URL after sanitize: '\(cleanHost)'")
            throw ServiceError.missingConfig
        }

        print("[SupabaseService] ✅ config loaded:")
        print("    raw host  : '\(rawHost)'")
        print("    clean host: '\(cleanHost)'")
        print("    final URL : \(url.absoluteString)")
        print("    key prefix: \(cleanKey.prefix(10))..., key length: \(cleanKey.count)")
        self.client = SupabaseClient(supabaseURL: url, supabaseKey: cleanKey)
    }

    /// SUPABASE_URL 에 사용자가 어떻게 복붙했든 호스트만 추출:
    /// "https://xxx.supabase.co/rest/v1/   " → "xxx.supabase.co"
    private static func sanitizeHost(_ raw: String) -> String {
        var s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("https://") { s = String(s.dropFirst(8)) }
        if s.hasPrefix("http://")  { s = String(s.dropFirst(7)) }
        if let slashIdx = s.firstIndex(of: "/") { s = String(s[..<slashIdx]) }
        return s.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: - Public

    /// UploadQueue 의 uploader 로 그대로 전달 가능.
    func upload(job: UploadJob, photoURL: URL, videoURL: URL?) async throws {
        let folder = Self.dateFolder()
        let photoStoragePath = "images/\(folder)/\(job.id.uuidString).jpg"

        print("[SupabaseService] 🚀 upload start — job \(job.id), photo=\(photoURL.lastPathComponent), video=\(videoURL?.lastPathComponent ?? "nil")")

        // 1) 이미지 업로드 — supabase-swift 2.x 새 시그니처 (path, data:)
        let photoData = try Data(contentsOf: photoURL)
        print("[SupabaseService] 1/3 ⬆ uploading image (\(photoData.count) bytes) → \(photoStoragePath)")
        _ = try await client.storage
            .from(bucket)
            .upload(
                photoStoragePath,
                data: photoData,
                options: FileOptions(contentType: "image/jpeg", upsert: true)
            )
        let imagePublicURL = try client.storage
            .from(bucket)
            .getPublicURL(path: photoStoragePath)
        print("[SupabaseService] 1/3 ✅ image OK → \(imagePublicURL.absoluteString)")

        // 2) 영상 업로드 (있을 때만)
        var videoStoragePath: String? = nil
        var videoPublicURLString: String? = nil
        if let videoURL {
            let videoData = try Data(contentsOf: videoURL)
            let path = "videos/\(folder)/\(job.id.uuidString).mp4"
            print("[SupabaseService] 2/3 ⬆ uploading video (\(videoData.count) bytes) → \(path)")
            _ = try await client.storage
                .from(bucket)
                .upload(
                    path,
                    data: videoData,
                    options: FileOptions(contentType: "video/mp4", upsert: true)
                )
            videoStoragePath = path
            videoPublicURLString = try client.storage
                .from(bucket)
                .getPublicURL(path: path)
                .absoluteString
            print("[SupabaseService] 2/3 ✅ video OK")
        } else {
            print("[SupabaseService] 2/3 ⏭ no video (skipping)")
        }

        // 3) photos 테이블 insert
        let row = PhotoRow(
            id: job.id.uuidString,
            storage_path: photoStoragePath,
            image_url: imagePublicURL.absoluteString,
            video_path: videoStoragePath,
            video_url: videoPublicURLString
        )
        print("[SupabaseService] 3/3 ⬆ inserting photos row")
        try await client
            .from("photos")
            .insert(row)
            .execute()
        print("[SupabaseService] 3/3 ✅ photos row inserted — DONE")
    }

    // MARK: - Internals

    private static func dateFolder(now: Date = .init()) -> String {
        let fmt = DateFormatter()
        fmt.calendar = Calendar(identifier: .gregorian)
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = .current
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: now)
    }

    private struct PhotoRow: Encodable {
        let id: String
        let storage_path: String
        let image_url: String
        let video_path: String?
        let video_url: String?
    }

    enum ServiceError: Error {
        case missingConfig
    }
}
