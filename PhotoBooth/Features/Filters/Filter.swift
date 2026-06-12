import Foundation
import CoreGraphics

/// 촬영 필터. 두 카테고리:
/// - face: ARFaceAnchor 에 부착되어 얼굴을 따라다님 (안경/모자/볼터치)
/// - overlay: 카메라 시야에 고정. 사진/영상에 그대로 합성됨 (외곽 데코, 배경 데코)
enum FilterKind: String, Codable, Hashable {
    case none      // 필터 없음
    case face
    case overlay
}

struct Filter: Identifiable, Hashable {
    let id: String          // 자산 파일명 (확장자 제외)
    let displayName: String // UI 한국어
    let kind: FilterKind
    let assetName: String?  // bundle 안의 PNG 파일명 (확장자 제외). nil 이면 빈 필터
    /// face 일 때 얼굴 anchor 좌표 기준 부착 위치 (단위 m). +Y 위, +Z 얼굴 앞쪽.
    let facePosition: SCNVec?
    /// face 일 때 SCNPlane 크기 (단위 m). nil 이면 기본값.
    let faceSize: CGSize?
}

/// SceneKit import 없이 모델에서 사용하는 가벼운 vec.
struct SCNVec: Hashable {
    let x: Float
    let y: Float
    let z: Float
}

extension Filter {
    static let all: [Filter] = [
        Filter(id: "none", displayName: "필터 없음", kind: .none,
               assetName: nil, facePosition: nil, faceSize: nil),

        // 얼굴 추적 — 안경. 눈 위치(코보다 약간 위) + 가로 16cm × 세로 8cm (1024:512 비율)
        Filter(id: "eye_glasses", displayName: "하트 안경", kind: .face,
               assetName: "eye_glasses",
               facePosition: SCNVec(x: 0, y: 0.025, z: 0.08),
               faceSize: CGSize(width: 0.16, height: 0.08)),
        Filter(id: "eye_glasses2", displayName: "새우 안경", kind: .face,
               assetName: "eye_glasses2",
               facePosition: SCNVec(x: 0, y: 0.025, z: 0.08),
               faceSize: CGSize(width: 0.16, height: 0.08)),
        // 얼굴 가운데 감싸기 (새우링) — 자산 구멍이 자산 아래쪽이라 y 양수로 위로 올림
        Filter(id: "face_shrimp", displayName: "새우링", kind: .face,
               assetName: "face_shrimp",
               facePosition: SCNVec(x: 0, y: 0.08, z: 0.04),
               faceSize: CGSize(width: 0.42, height: 0.42)),
        // 입 왼쪽 옆 (얼굴 주인의 왼쪽 = ARKit -x)
        Filter(id: "lip_fork1", displayName: "튀김 한입", kind: .face,
               assetName: "lip_fork1",
               facePosition: SCNVec(x: -0.06, y: -0.07, z: 0.07),
               faceSize: CGSize(width: 0.14, height: 0.14)),
        Filter(id: "lip_fork2", displayName: "구이 한입", kind: .face,
               assetName: "lip_fork2",
               facePosition: SCNVec(x: -0.06, y: -0.07, z: 0.07),
               faceSize: CGSize(width: 0.14, height: 0.14)),
        // 입 오른쪽 옆 (얼굴 주인의 오른쪽 = ARKit +x) — 한입 시리즈 3~5. 살짝 위로
        Filter(id: "lip_fork3", displayName: "새우 초밥 한입", kind: .face,
               assetName: "lip_fork3",
               facePosition: SCNVec(x: 0.06, y: -0.05, z: 0.07),
               faceSize: CGSize(width: 0.14, height: 0.14)),
        Filter(id: "lip_fork4", displayName: "새우 우니 초밥 한입", kind: .face,
               assetName: "lip_fork4",
               facePosition: SCNVec(x: 0.06, y: -0.05, z: 0.07),
               faceSize: CGSize(width: 0.14, height: 0.14)),
        Filter(id: "lip_fork5", displayName: "새우 튀김 한입", kind: .face,
               assetName: "lip_fork5",
               facePosition: SCNVec(x: 0.06, y: -0.05, z: 0.07),
               faceSize: CGSize(width: 0.14, height: 0.14)),

        // 정적 오버레이 — 카메라 시야 가득. 위치/사이즈는 코드에서 카메라 FOV 기반 계산
        Filter(id: "overlay_bike", displayName: "자전거", kind: .overlay,
               assetName: "overlay_bike", facePosition: nil, faceSize: nil),
        Filter(id: "overlay_burger", displayName: "버거 1", kind: .overlay,
               assetName: "overlay_burger 2", facePosition: nil, faceSize: nil),
        Filter(id: "overlay_burger2", displayName: "버거 2", kind: .overlay,
               assetName: "overlay_burger2 2", facePosition: nil, faceSize: nil),
        Filter(id: "overlay_burger3", displayName: "버거 3", kind: .overlay,
               assetName: "overlay_burger3 2", facePosition: nil, faceSize: nil),
        Filter(id: "overlay_burger4", displayName: "버거 4", kind: .overlay,
               assetName: "overlay_burger4 2", facePosition: nil, faceSize: nil),
        Filter(id: "overlay_fork1", displayName: "포크 1", kind: .overlay,
               assetName: "overlay_fork1", facePosition: nil, faceSize: nil),
        Filter(id: "overlay_lunch", displayName: "도시락", kind: .overlay,
               assetName: "overlay_lunch", facePosition: nil, faceSize: nil),
        Filter(id: "overlay_ramen", displayName: "라멘", kind: .overlay,
               assetName: "overlay_ramen", facePosition: nil, faceSize: nil),
        Filter(id: "overlay_flush", displayName: "인형뽑기", kind: .overlay,
               assetName: "overlay_flush", facePosition: nil, faceSize: nil),
        Filter(id: "overlay_friend", displayName: "친구", kind: .overlay,
               assetName: "overlay_friend", facePosition: nil, faceSize: nil),
        Filter(id: "overlay_chopsticks", displayName: "젓가락", kind: .overlay,
               assetName: "overlay_chopsticks", facePosition: nil, faceSize: nil),
    ]
}
