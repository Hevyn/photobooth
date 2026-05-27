import SwiftUI

@main
struct PhotoBoothApp: App {

    // UploadQueue 와 SupabaseService 는 앱 수명 내내 1개 인스턴스.
    private let queue: UploadQueue = {
        do {
            return try UploadQueue(uploader: SupabaseService.shared.upload)
        } catch {
            fatalError("UploadQueue 초기화 실패: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            CameraView(queue: queue)
                .statusBarHidden()
                .persistentSystemOverlays(.hidden)
                .preferredColorScheme(.dark)
        }
    }
}
