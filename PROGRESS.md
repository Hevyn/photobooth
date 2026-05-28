# PhotoBooth MVP — 진행 상황

> 마지막 업데이트: 2026-05-29
> 새 세션에서 이 파일부터 읽고 이어 진행할 것.

---

## 🎯 프로젝트 개요

플리마켓용 Y2K 프리쿠라 감성 포토부스 MVP.

- **아이패드 1대 (촬영 전용)** — Swift/SwiftUI + ARKit + AVFoundation ✅
- **노트북/태블릿 1대 (`/display`)** — Next.js, Supabase Realtime 으로 새 사진 큐 + 운영자가 이전/다음 버튼 ✅
- **방문객 폰 (`/edit/<photoId>`)** — Next.js + Fabric.js 꾸미기 + HiDPI 저장 + 영상 다운로드 ✅
- **백엔드** — Supabase (Postgres + Storage + Realtime), 24h 자동 파기 (pg_cron) ✅

**핵심 흐름이 end-to-end 작동함.** 디자인 자산 추가 + 사업화 확장이 다음 단계.

---

## 📂 현재 파일 트리 (핵심)

```
~/Documents/PhotoBooth/
├── .gitignore                                (xcconfig + .env + /bundle 워킹 폴더)
├── PROGRESS.md
├── docs/
│   ├── REQUIREMENTS.md                        (FR 15개 + NFR)
│   └── DECISIONS.md                           (ADR 11개)
├── PhotoBooth/                                ← iPad 앱
│   ├── PhotoBooth.xcodeproj
│   ├── Config/Debug.xcconfig                  🔐
│   ├── Config/Debug.xcconfig.sample
│   ├── Features/
│   │   ├── Camera/CameraSession.swift         (필터 부착 + overlay 합성)
│   │   ├── Camera/CameraView.swift            (가로 스크롤 필터 UI)
│   │   └── Filters/Filter.swift               (모델 + 5개 정의)
│   ├── Services/SupabaseService.swift + UploadQueue.swift
│   └── bundle/                                (Xcode folder reference)
│       ├── eye_glasses.png                    (얼굴 추적)
│       ├── overlay_bike.png                   (정적 오버레이)
│       ├── overlay_burger.png
│       └── overlay_friend.png
├── web-app/                                   ← Next 16 + React 19 + TS + Tailwind v4
│   ├── .env.local                             🔐
│   ├── .env.local.sample
│   ├── next.config.ts                         (allowedDevOrigins for LAN)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                           (→ /display)
│   │   ├── display/page.tsx                   (큐 + QR + photoId 디버그)
│   │   └── edit/[photoId]/
│   │       ├── page.tsx                       (useParams + Supabase fetch + 영상 저장 버튼)
│   │       └── FabricEditor.tsx               (캔버스 + 펜/스티커 + ✨ 완성)
│   └── lib/supabase/client.ts
└── supabase/migrations/
    ├── 0001_init_photos.sql
    ├── 0002_cron_cleanup.sql
    └── 0003_realtime.sql
```

---

## ✅ 완료된 작업

### Supabase
- photos 테이블 + Storage 버킷 `photobooth_images` + pg_cron 24h 자동 파기 + Realtime publication

### iPad 앱
- ARKit FaceTracking + 셔터 → 3-2-1 카운트다운 + 사진 + 영상 동시 캡처
- **사진·영상 비율: 4:3 가로형 (사진 1440×1080, 영상 960×720)**
- **촬영 필터 시스템 (이슈 #6)**:
  - 얼굴 추적 (`eye_glasses` — ARFaceAnchor 자식 SCNPlane, PNG 비율 자동 유지)
  - 정적 오버레이 (`overlay_bike/burger/friend` — snapshot 2D 합성, 4:3 가운데 영역)
  - 가로 스크롤 필터 썸네일 UI (인스타/틱톡 톤)
- UploadQueue 영속 큐 + 재시도 (7s/2s/2s + 백그라운드 1회)
- Supabase Storage + photos row insert ✅

### 웹 `/display`
- 24h 내 photos 자동 큐 + Realtime INSERT 자동 append
- QR 코드 (LAN IP 기반) + 이전/다음 버튼 + photoId 디버그 표시
- 핑크/노랑 그라데이션 Y2K 톤

### 웹 `/edit/[photoId]` (이슈 #1, #2, #3)
- Next 16 `useParams` (`use()` Promise 우회로 호환성 ↑)
- Supabase `maybeSingle` + UUID 형식 사전 검증 + 상태 4종
- Fabric.js v7 캔버스 (400×300, 4:3)
  - aspect-fit 사진 배경 (originX/Y 'left/top' 명시)
  - 네온 글로우 펜 3색 (PencilBrush + Shadow)
  - 이모지 스티커 5종 (IText, 드래그/확대/회전)
  - 선택 지우기 / 전체 초기화 (배경 보존)
- **✨ 완성** 버튼 → `toDataURL({ multiplier: 3.6 })` 고해상도 캡쳐 → img overlay → 길게 눌러 사진 앱 저장
- **영상 저장 버튼** — Supabase `?download=` 쿼리로 attachment 헤더 → 파일 앱 다운로드

### 폰 검증 (이슈 #4)
- `next.config.ts` 의 `allowedDevOrigins` (Next 16 의 외부 origin 차단 우회)
- `.env.local` 의 `NEXT_DEV_LAN_ORIGIN` + `NEXT_PUBLIC_BASE_URL` 로 LAN IP 셋업
- 폰 카메라로 QR 스캔 → `/edit` → 꾸미기 → ✨ 완성 → 길게 눌러 사진 저장 → 영상 저장 버튼 ✅

---

## 🧠 합의된 핵심 결정사항 (잊지 말 것)

`docs/DECISIONS.md` 에 ADR 형식으로 정리. 11개:
- 영상 정책 / 재시도 / 큐 영속화 / `/display` 자동 전환 X / 꾸미기 결과 서버 저장 X /
- 확장성 무시 (MVP) / 인증 단순화 (anon + open RLS) / QR=uuid 직접 /
- UI 긍정형 / 영상은 ARKit 그대로 / 비율 4:3 가로형

---

## ⏭ 향후 작업 후보 (다음 세션)

- **이슈 #7 (선택)**: 디자인 자산 추가 — PNG 만들면 `PhotoBooth/bundle/` 박고 `Filter.all` 에 한 줄 추가
- **멀티 테넌트 기초** — `events` 테이블 + `photos.event_id` FK + `/display/<eventId>`. 행사/매장 분리 구조
- **운영자 대시보드** (`/admin`) — 이벤트 생성/관리. Supabase Auth.
- **HiDPI 영상 캡쳐 효율화** — 현재 sceneView.snapshot() 매 frame. 더 효율적 파이프라인 (SCNRenderer)
- **잔존 디버그 토글 정리** — `CameraSession.swift` 의 `recordVideoEnabled` (현재 true), print 들 OSLog 전환

---

## 🐛 잔존 디버그 토글

- `CameraSession.swift` 상단의 `recordVideoEnabled: Bool = true` — 디버그용 토글
- `SupabaseService.swift` / `UploadQueue.swift` 의 `print` 들 — OSLog 로 전환 가능

---

## 🔐 키 보안 검증 방법

```bash
cd ~/Documents/PhotoBooth

# 1) 실키 파일들이 다 ignore 되는지
git check-ignore -v PhotoBooth/Config/Debug.xcconfig web-app/.env.local
# (둘 다 ignored 로 나와야 ✅)

# 2) sample 파일은 더미값만
ls -la PhotoBooth/Config/Debug.xcconfig.sample web-app/.env.local.sample

# 3) git 추적 대상 중 의심
git status --short | grep -iE "(xcconfig|secret|key|\.env)"
```

---

## ⚠ 환경별 SUPABASE_URL / LAN IP 메모

| 환경 | 형식 | 예시 |
|---|---|---|
| iPad (xcconfig) | `호스트만` (https:// 없이) | `dvdnlivivvrlxodnyusi.supabase.co` |
| Web (.env.local) | `https://` 포함 | `https://dvdnlivivvrlxodnyusi.supabase.co` |
| LAN 검증 | `.env.local` 의 두 변수 | `NEXT_PUBLIC_BASE_URL=http://192.168.x.y:3000` + `NEXT_DEV_LAN_ORIGIN=192.168.x.y` |

iPad 쪽 `SupabaseService.swift` 가 `https://\(host)` 로 prefix + sanitize.
Web 쪽 SDK 가 풀 URL 받음.
LAN IP 는 `ifconfig | grep "inet " | grep -v 127.0.0.1` 로 확인.
