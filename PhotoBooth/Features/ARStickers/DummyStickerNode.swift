import SceneKit
import ARKit
import UIKit

/// 더미 스티커 — 실 PNG/3D 에셋 들어오기 전까지 합성 파이프라인 검증용.
/// ARFaceAnchor 좌표계: 얼굴 중심 origin, +Z 가 얼굴 앞쪽.
enum DummyStickerNode {

    /// 코 끝에 작은 빨간 동그라미. 객체 추적형 합성 검증용.
    static func makeNoseDot() -> SCNNode {
        let sphere = SCNSphere(radius: 0.012)        // ~1.2cm
        let material = SCNMaterial()
        material.diffuse.contents = UIColor.systemRed
        material.lightingModel = .constant            // 조명 영향 없게 (단색 유지)
        sphere.materials = [material]

        let node = SCNNode(geometry: sphere)
        // 얼굴 anchor 좌표 기준: 코 끝 부근 → 살짝 앞으로 (+Z), 살짝 아래 (-Y)
        node.position = SCNVector3(0, -0.015, 0.075)
        return node
    }
}
