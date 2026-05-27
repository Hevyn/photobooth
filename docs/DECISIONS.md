# 결정 사항 (Architecture Decision Records)

> 가벼운 ADR(Architecture Decision Record). 각 항목은 _Context / Decision / Consequences_ 3분 구성.
> 요약본은 `PROGRESS.md` "합의된 핵심 결정사항" 참고.

---

## ADR-001. 영상 정책 (해상도/길이/오버레이)

**Context**: 사진뿐 아니라 짧은 영상도 함께 캡처하고 싶지만, Supabase Storage 비용·업로드 시간·휴대폰 저장 부담을 고려해야 한다.

**Decision**: 720×720 / 15fps / H.264 / ~2Mbps / 약 3.3초 (셔터→3-2-1→찰칵+0.3s). 카운트다운 숫자는 `sceneView` **바깥** 오버레이로 렌더링하여 녹화 프레임에 포함되지 않도록 한다. ARKit 얼굴 스티커는 영상에 포함된다.

**Consequences**:
- ✅ 파일 크기 ~0.5–1MB → 업로드/다운로드 빠름
- ✅ 카운트다운 숫자가 결과물에 안 남음
- ⚠ 720p 라 SNS 게시 시 화질 한계, 디자인 확정 후 상향 검토

---

## ADR-002. 업로드 재시도 정책

**Context**: 플리마켓 현장은 와이파이 불안정 가능. 업로드 실패 시 그냥 버리면 사용자 경험 손상.

**Decision**: 전경에서 3회 재시도 (지연 7s / 2s / 2s). 사용자 메시지는 시도 단계와 1:1 매핑 ("업로드 중..." → "재시도 중 (1/3)" 등). 그래도 실패하면 백그라운드에서 1회 추가 시도.

**Consequences**:
- ✅ 최악의 경우 ~15초 안에 결과 확정
- ✅ 사용자가 진행 상태 인지 가능
- ⚠ 메시지가 시도 단계와 1:1 이라 메시지 변경이 시도 정책 변경과 묶임

---

## ADR-003. 업로드 큐 영속화

**Context**: 앱이 백그라운드로 가거나 죽어도 업로드 중이던 항목을 잃지 말아야 한다.

**Decision**: `FileManager` + JSON manifest 사용. 위치는 `Application Support/upload_queue/`. iCloud 백업은 제외 플래그.

**Consequences**:
- ✅ 앱 재시작 후에도 큐 복원
- ✅ iCloud 용량 차지 안 함
- ⚠ Core Data 같은 트랜잭션 보장 없음 (manifest 단순 덮어쓰기) — MVP 범위에선 수용

---

## ADR-004. `/display` 자동 전환 X

**Context**: 새 사진이 들어올 때마다 자동으로 화면이 바뀌면 방문객이 자신의 QR을 스캔하기 전에 다음 사진으로 넘어가 버린다.

**Decision**: Realtime 으로 INSERT 받으면 큐에 **append 만** 하고, 화면 표시 인덱스는 운영자/방문객이 "이전/다음" 버튼으로 직접 이동.

**Consequences**:
- ✅ 방문객이 자기 사진 QR 을 충분히 스캔할 시간 확보
- ✅ 운영자가 현장 회전율 통제 가능
- ⚠ 운영자 개입 필요 (완전 무인 운영 불가)

---

## ADR-005. 꾸미기 결과 서버 저장 X

**Context**: 꾸민 사진을 서버에 다시 올릴 수도 있지만, Storage 비용 증가 + 인증 로직 필요.

**Decision**: 꾸미기 결과는 **휴대폰 로컬 저장만**. 길게 눌러 OS 기본 저장 동작.

**Consequences**:
- ✅ 서버 비용/복잡도 최소
- ✅ 개인정보 노출 표면 축소 (꾸민 결과는 서버에 없음)
- ⚠ 방문객이 저장 안 하면 그 결과는 영구 소실

---

## ADR-006. 확장성 무시 (MVP 범위)

**Context**: 여러 iPad, 부스 토글, 행사별 분리 등 확장 시나리오를 다 고려하면 시간 부족.

**Decision**: MVP 는 단일 iPad + 단일 `/display` 가정. 확장은 MVP 이후 진짜 개발자와 재설계 시점에 처리.

**Consequences**:
- ✅ 구현 시간 대폭 절감
- ⚠ MVP 이후 재설계 비용 발생 (수용)

---

## ADR-007. 인증 단순화 (익명 키 + open RLS)

**Context**: 현장 부스라 방문객 회원가입/로그인 강요 불가. 사용자별 인증 흐름 구현 시간 부족.

**Decision**: Supabase 익명 anon key + open RLS(누구나 read/insert) 로 운영. 토큰/매핑 테이블 없음.

**Consequences**:
- ✅ 구현/운영 단순
- ✅ 24h 자동 파기와 결합되어 개인정보 보관 위험 제한
- ⚠ 같은 anon key 를 알면 외부에서도 row 조작 가능 — 현장 한정·단기 운영 가정으로 수용

---

## ADR-008. QR URL = `/edit/<uuid>` 직접

**Context**: QR 에 들어가는 URL 형식 선택. 짧은 토큰 매핑을 만들 수도 있다.

**Decision**: `/edit/<photoId>` 의 photoId = Supabase row 의 uuid 그대로. 매핑 테이블 없음.

**Consequences**:
- ✅ 매핑 비용 0
- ✅ uuid 36자 → 추측 비용 충분히 큼
- ⚠ URL 길이 길어짐 (QR 모듈 늘어남) — 240px 출력에선 무리 없음

---

## ADR-009. UI 카피는 긍정형 우선

**Context**: 사용자(가은) 의 일관된 선호: 부정/금지형보다 긍정/유도형.

**Decision**: "X 하지 마세요" 대신 "X 해주세요" 톤. (예: "흔들리지 마세요" → "잠깐 멈춰 주세요")

**Consequences**:
- ✅ 톤 일관성
- ✅ 사용자 정서 부담 감소

---

## ADR-010. `/edit` 꾸미기는 사진에만, 영상은 ARKit 합성 그대로

**Context**: 영상에도 꾸미기를 반영하려면 비디오 합성 파이프라인 필요 → MVP 범위 초과.

**Decision**: 사진은 Fabric.js 로 자유 꾸미기. 영상은 촬영 시점 ARKit 합성 그대로 표시·다운로드, 추가 편집 X.

**Consequences**:
- ✅ 구현 단순
- ⚠ 사진/영상 결과물 통일감 부족 — 명시적 안내로 보완

---

## ADR-011. 사진/영상 종횡비 = 정사각 (1080×1080 / 720×720)

**Context**: 디자인 확정 전 잠정 결정 필요. 사용자 선호는 향후 4:3.

**Decision**: 현재 정사각 유지. 디자인 확정 시 `CameraSession.swift` 의 `videoSize` + `snapshotJPEG()` 의 `target` 두 줄만 수정.

**Consequences**:
- ✅ 디자인 확정 전까지 정사각으로 통일성 유지
- ✅ 변경 지점이 2줄로 한정 → 전환 비용 낮음
