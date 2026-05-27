# 요구사항 명세 (Requirements Specification)

> PhotoBooth MVP 의 현재 시점 요구사항을 한 페이지로 정리한 문서.
> 상세 진행 상황은 `PROGRESS.md`, 설계 결정은 `docs/DECISIONS.md` 참고.

---

## 1. 프로젝트 개요

플리마켓 현장에서 운영하는 Y2K 프리쿠라(プリクラ) 감성 포토부스 MVP.
방문객이 부스에서 사진/영상을 찍고, QR 코드로 자신의 휴대폰에서 사진을 꾸민 뒤 로컬 저장한다.

## 2. 이해관계자 (Stakeholders)

| 역할 | 설명 |
|---|---|
| 부스 운영자 | 가은 본인. iPad 촬영 보조 + `/display` 화면에서 큐 관리 |
| 방문객 | 플리마켓 손님. iPad 앞에서 촬영 → QR 스캔 → 휴대폰에서 꾸미기 |
| 운영 기기 | iPad (촬영 전용) 1대, 노트북/태블릿 (`/display`) 1대 |

## 3. 사용 시나리오 (User Story)

1. 방문객이 iPad 앞에서 셔터 누름 → 3-2-1 카운트다운 → 사진 + 영상 동시 촬영 (ARKit 얼굴 스티커 합성됨)
2. 결과물이 Supabase 에 업로드 → 운영자의 `/display` 화면 큐에 자동 추가됨 (Realtime)
3. 운영자가 "이전/다음" 버튼으로 방문객 차례 사진을 화면에 띄움
4. 방문객이 QR 스캔 → 자신의 휴대폰에서 `/edit/<photoId>` 진입
5. 사진은 Fabric.js 캔버스로 꾸미기 (네온 펜, 이모지 스티커), 영상은 그대로 표시
6. 사진/영상을 길게 눌러 휴대폰 로컬 저장
7. 모든 데이터는 24시간 후 자동 파기 (pg_cron)

## 4. 기능 요구사항 (Functional Requirements)

| ID | 요구사항 | 상태 |
|---|---|---|
| FR-01 | iPad 카메라 프리뷰 + ARKit 얼굴 스티커 실시간 합성 | ✅ |
| FR-02 | 셔터 누르면 3-2-1 카운트다운 후 사진 + 영상 동시 캡처 | ✅ |
| FR-03 | 영상은 720×720 / 15fps / H.264 / 약 3.3초 / 0.5–1MB | ✅ |
| FR-04 | 카운트다운 숫자는 영상에 포함되지 않음 (sceneView 바깥 오버레이) | ✅ |
| FR-05 | 촬영 결과 Supabase Storage 업로드 + photos 테이블 row insert | ✅ |
| FR-06 | 업로드 실패 시 전경 3회 재시도 (7s/2s/2s) + 백그라운드 1회 | ✅ |
| FR-07 | 업로드 큐는 앱 종료 후에도 영속 (FileManager + JSON manifest) | ✅ |
| FR-08 | `/display` 페이지: 24h 내 사진을 시간순으로 큐에 적재 | ✅ |
| FR-09 | `/display` 페이지: Realtime INSERT 구독 → 큐에 append (자동 전환 X) | ✅ |
| FR-10 | `/display` 페이지: 이전/다음 버튼으로 큐 탐색 + QR 코드 표시 | ✅ |
| FR-11 | `/edit/<photoId>`: photoId 로 사진 + 영상 fetch (404 처리) | ⏳ |
| FR-12 | `/edit/<photoId>`: Fabric.js 캔버스로 사진 꾸미기 (네온 펜, 이모지 스티커) | ⏳ |
| FR-13 | `/edit/<photoId>`: 영상은 `<video>` 로 표시 (편집 X) | ⏳ |
| FR-14 | 길게 눌러 휴대폰 로컬 저장 (서버 재업로드 X) | ⏳ |
| FR-15 | photos 테이블 + Storage 객체는 created_at 기준 24h 후 자동 삭제 (pg_cron) | ✅ |

## 5. 비기능 요구사항 (Non-Functional Requirements)

| 분류 | 항목 | 기준 |
|---|---|---|
| 성능 | 촬영→Storage 업로드 완료 | 일반적으로 3초 이내, 최악 재시도 시 ~15초 |
| 성능 | `/display` 큐 갱신 지연 | Realtime 구독 기반, 보통 1초 이내 |
| 보안 | API 키 git 추적 차단 | `.gitignore` 로 `Debug.xcconfig` / `.env.local` 제외, `.sample` 만 커밋 |
| 보안 | 인증 모델 | 익명 키 + open RLS (현장 부스 특성, 짧은 운영 시간) |
| 운영 | 데이터 보관 기간 | 24시간 (개인정보 최소화, pg_cron 자동 파기) |
| 사용성 | UI 카피 톤 | 긍정형 ("다시 찍어주세요" 같은 유도형, 부정/금지형 지양) |
| 사용성 | 디자인 톤 | Y2K 키치 (핑크/노랑 그라데이션, 네온 펜, 이모지 스티커) |
| 사용성 | 화면 자동 전환 | `/display` 자동 전환 X (운영자/방문객이 직접 버튼) — 회전율 통제 |

## 6. 범위 외 (Out of Scope, MVP 후)

- 다중 iPad / 다중 `/display` 동기화
- 사진–QR 매핑 토큰 (uuid 직접 노출로 단순화)
- 회원/세션 관리
- 꾸미기 결과 서버 저장 (현재는 폰 로컬만)
- 영상 꾸미기 (현재 영상은 ARKit 합성 그대로)
- 정사각 외의 종횡비 (디자인 확정 후 4:3 로 전환 예정)
