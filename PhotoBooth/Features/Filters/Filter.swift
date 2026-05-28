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

        // 정적 오버레이 — 카메라 시야 가득. 위치/사이즈는 코드에서 카메라 FOV 기반 계산
        Filter(id: "overlay_bike", displayName: "자전거", kind: .overlay,
               assetName: "overlay_bike", facePosition: nil, faceSize: nil),
        Filter(id: "overlay_burger", displayName: "버거", kind: .overlay,
               assetName: "overlay_burger", facePosition: nil, faceSize: nil),
        Filter(id: "overlay_friend", displayName: "친구", kind: .overlay,
               assetName: "overlay_friend", facePosition: nil, faceSize: nil),
    ]
}
