# PhotoBooth MVP — 진행 상황

> 마지막 업데이트: 2026-05-24 (저녁, 웹 #1 검증 완료)
> 다음 세션에서 이 파일부터 읽고 이어 진행할 것.

---

## 🎯 프로젝트 개요

플리마켓용 Y2K 프리쿠라 감성 포토부스 MVP.

- **아이패드 1대 (촬영 전용)** — Swift/SwiftUI + ARKit + AVFoundation ✅
- **노트북/태블릿 1대 (`/display`)** — Next.js, Supabase Realtime 으로 새 사진 큐에 쌓고 운영자가 이전/다음 버튼으로 QR 노출 ✅
- **방문객 폰 (`/edit/<photoId>`)** — Next.js + Fabric.js 꾸미기, 길게 눌러서 로컬 저장 (서버 재업로드 X) ⏳ 다음
- **백엔드** — Supabase (Postgres + Storage + Realtime), 24h 자동 파기 (pg_cron) ✅

---

## 📂 현재 파일 트리

```
~/Documents/PhotoBooth/
├── .git/
├── .gitignore                                (xcconfig + .env 다 보호)
├── PROGRESS.md                               ← 이 파일
├── PhotoBooth/                               ← iPad 앱 (Xcode 프로젝트)
│   ├── PhotoBooth.xcodeproj
│   ├── App/PhotoBoothApp.swift
│   ├── Config/Debug.xcconfig                 🔐
│   ├── Config/Debug.xcconfig.sample          (516 bytes, 더미)
│   ├── Features/
│   │   ├── ARStickers/DummyStickerNode.swift  (코 빨간 점, MVP 후 교체)
│   │   └── Camera/CameraSession.swift + CameraView.swift
│   ├── Services/SupabaseService.swift + UploadQueue.swift
│   ├── PhotoBooth/Assets.xcassets
│   ├── PhotoBoothTests/
│   └── PhotoBoothUITests/
├── web-app/                                  ← Next.js 16 + React 19 + TS + Tailwind
│   ├── .env.local                            🔐
│   ├── .env.local.sample
│   ├── package.json (next 16.2.6, supabase-js, qrcode.react)
│   ├── app/
│   │   ├── layout.tsx (lang="ko")
│   │   ├── page.tsx                          (/ → /display redirect)
│   │   ├── display/page.tsx                  (큐 + QR + 이전/다음, Realtime 구독)
│   │   └── edit/[photoId]/page.tsx           ⏳ 다음 작업
│   └── lib/supabase/client.ts                (brower client + Photo type)
└── supabase/
    └── migrations/
        ├── 0001_init_photos.sql
        ├── 0002_cron_cleanup.sql
        └── 0003_realtime.sql                 (photos → supabase_realtime publication)
```

---

## ✅ 완료된 작업 (모든 검증 통과)

### 1. Supabase
- photos 테이블 (id uuid PK, storage_path, image_url, video_path, video_url, created_at)
- Storage 버킷 `photobooth_images` (public, 2 policies)
- pg_cron 24h 자동 파기
- Realtime publication 추가 (photos INSERT 이벤트 구독 가능)

### 2. iPad 앱 — 실기기 검증 통과 ✅
- ARKit FaceTracking + 코 빨간 점 합성 (더미 스티커)
- 셔터 → 3-2-1 카운트다운 (sceneView 바깥이라 영상 안 들어감)
- 사진 + 영상 동시 캡처 (영상 720×720 15fps H.264, ~3.3초, ~0.9MB)
- UploadQueue 영속 큐 + 3회 재시도 (7s/2s/2s) + 백그라운드 1회
- Supabase Storage + photos row insert 검증됨

### 3. 웹 #1 `/display` — 브라우저 검증 통과 ✅
- 첫 로드 시 24h 내 photos 다 가져옴
- Realtime INSERT 구독 → 큐 자동 append (현재 인덱스 유지, 자동 전환 X)
- QR 코드 (`${NEXT_PUBLIC_BASE_URL}/edit/${photoId}`)
- 이전/다음 버튼, 카운터, 24h 안내
- 디자인: 핑크/노랑 그라데이션, 키치 톤

---

## ⏭ 다음 작업: 웹 #2 `/edit/[photoId]`

### 명확화 (사용자 의도 재확인됨)
**한 페이지에 사진 + 영상 두 개가 같이 보임:**
- **사진**: Fabric.js 캔버스로 꾸미기 가능 (펜, 스티커 추가)
- **영상**: 그냥 표시 (재생만, 꾸미기 반영 X). 이미 촬영 시점에 ARKit 합성된 채로 저장됨

**저장**: 사진 (꾸민 결과) + 영상 (그대로) 각각 길게 눌러 로컬 저장. 서버 재업로드 X.

### 구현 체크리스트
- [ ] Fabric.js 패키지 설치 (`fabric`)
- [ ] `/edit/[photoId]/page.tsx` — Next 16 의 async params 패턴 사용 (`PageProps<'/edit/[photoId]'>`)
- [ ] photo id 로 Supabase 에서 사진 + 영상 URL 가져오기 (404 처리)
- [ ] Fabric.js 캔버스 셋업 (사진 배경)
- [ ] 네온 글로우 형광펜 브러쉬 (Y2K 감성, shadow + blur)
- [ ] 터치 스티커 (확대/축소/회전 — Fabric.js 기본 지원)
- [ ] HiDPI export (`devicePixelRatio` 곱한 multiplier)
- [ ] 영상 `<video controls>` 표시 (편집 X)
- [ ] "길게 눌러 저장" 안내 문구
- [ ] "📷 사진과 QR 은 24시간 후 자동 삭제됩니다" 하단 문구

### 폰 검증 시 주의
- 같은 와이파이의 폰에서 접속 → `http://192.168.219.101:3000` (현재 노트북 IP. dev 서버 켤 때 표시됨)
- QR 도 IP 로 만들려면 `.env.local` 의 `NEXT_PUBLIC_BASE_URL` 을 `http://192.168.219.101:3000` 으로 변경 후 dev 재시작
- 또는 Vercel 배포 후 진짜 URL 로

---

## 🧠 합의된 핵심 결정사항 (잊지 말 것)

1. **영상 정책**: 720x720, 15fps, ~3.3초 (셔터→3-2-1→찰칵+0.3s), H.264 ~2Mbps. 약 0.5~1MB. 카운트다운 숫자는 영상에 안 들어가게 sceneView **바깥** 오버레이. ARKit 스티커는 영상에 들어감
2. **재시도 정책**: 전경 3회 (7s / 2s / 2s). 메시지는 시도 단계와 1:1 연동. 백그라운드 1회 추가
3. **큐 영속화**: FileManager + JSON manifest. Application Support/upload_queue/. iCloud 백업 제외
4. **`/display` 자동 전환 X**: 새 사진은 큐에 append 만, 화면은 운영자/방문객 버튼으로 이동
5. **꾸미기 결과 서버 저장 X**: 길게 눌러서 폰 로컬 저장만
6. **확장성 (여러 기기 / 토글) 무시**: MVP 후 진짜 개발자와 재설계
7. **인증 단순화**: 익명 키 + open RLS (현장 부스 특성). 토큰/매핑 테이블 X
8. **QR URL**: `/edit/<uuid>` 그대로 (uuid 36자 = 충분히 안전, 매핑 비용 0)
9. **UI 카피는 긍정형 우선** ("다시 한 번 찍어주세요" 같은 톤)
10. **`/edit` 꾸미기는 사진에만 적용. 영상은 ARKit 합성 그대로 표시·다운로드 (꾸미기 반영 X)** ← 이번에 명확화됨
11. **사진/영상 비율**: 현재 정사각 (1080×1080 / 720×720). 사용자 선호는 4:3 (보이는 대로). 디자인 정해지면 변경 — `CameraSession.swift` 의 `videoSize` + `snapshotJPEG()` 의 `target` 두 줄만 수정

---

## 🐛 잔존 디버그 토글 (정리 필요 — MVP 마무리 단계)

- `CameraSession.swift` 상단의 `recordVideoEnabled` (현재 true) — 디버그용 토글이라 production 에선 제거 또는 항상 true
- `SupabaseService.swift` / `UploadQueue.swift` 의 `print` 들 — 정돈 시 제거 또는 OSLog 로 전환

---

## 🔐 키 보안 검증 방법

```bash
cd ~/Documents/PhotoBooth

# 1) 실키 파일들이 다 ignore 되는지
find . -name "Debug.xcconfig" -name ".env.local" -not -path "*/.git/*" -not -path "*/node_modules/*" | while read f; do
  printf "%s: " "$f"
  git check-ignore "$f" > /dev/null 2>&1 && echo "✅ ignored" || echo "❌ TRACKED!"
done

# 2) sample 파일 사이즈로 키 노출 의심
ls -la PhotoBooth/Config/Debug.xcconfig.sample web-app/.env.local.sample
# Debug.xcconfig.sample: ~516 bytes 면 안전 더미
# .env.local.sample: 더미값만 들어있어야 함

# 3) git 추적 대상 중 의심
git status --short | grep -iE "(xcconfig|secret|key|\.env)"
```

---

## ⚠ 환경별 SUPABASE_URL 형식 차이 (헷갈리기 쉬움)

| 환경 | 형식 | 예시 |
|---|---|---|
| iPad (xcconfig) | `호스트만` (https:// 없이) | `dvdnlivivvrlxodnyusi.supabase.co` |
| Web (.env.local) | `https://` 포함 | `https://dvdnlivivvrlxodnyusi.supabase.co` |

iPad 쪽은 `SupabaseService.swift` 가 `https://\(host)` 로 prefix 붙임 + sanitize (path/공백 제거).
Web 쪽은 SDK 가 풀 URL 받음.

---

## ⚠️ 잔존 진단 (실제 에러 X)

Xcode 빌드 통과하면 진짜 코드 이슈는 없음. SourceKit 단독 평가의 잔존 노이즈:
- `No such module 'UIKit'` / `No such module 'Supabase'`
- `Cannot find type 'UploadQueue' / 'CameraSession' / 'UploadStage'`
- `Cannot find 'UIApplication' / 'ARSCNView' / 'UIViewRepresentable'`

---

## ⏭ 다음 사용자가 할 것

쉬고 돌아오면:
1. **(웹 #2)** `/edit/[photoId]` 페이지 작업 시작 — Fabric.js 셋업 + 캔버스 + 네온 펜 + 스티커 + HiDPI export + 영상 표시
2. dev 서버는 background 로 켜뒀음. 종료됐으면 `cd web-app && npm run dev` 다시
