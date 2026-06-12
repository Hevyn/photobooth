# PhotoBooth — 진행 상황 + 이어 작업 가이드

> 마지막 업데이트: 2026-06-13
> **새 세션 / 새 노트북에서 이 파일부터 먼저 읽고 이어 작업할 것.**

---

## 🎯 프로젝트 한 줄

플리마켓·이벤트용 Y2K 새우 컨셉 포토부스. **iPad 1대 + 방문객 폰** 만으로 운영 가능 (PC 없이 핫스팟 환경 OK).

---

## 🚦 현재 상태 (운영 직전, 거의 완성)

### 운영 흐름 (end-to-end 작동)
1. **iPad** 카메라 + 필터 선택 (얼굴 추적 / 정적 오버레이) → 셔터 → 3-2-1 → 캡쳐
2. Supabase Storage 업로드 + photos row insert
3. **iPad 화면에 QR 코드 전체 오버레이** (방금 사진의 `/edit/<photoId>` URL)
4. 방문객이 폰으로 QR 스캔 → `https://saewoo-v-o3o-v.vercel.app/edit/<id>` 진입
5. Fabric.js 캔버스에서 펜(흰 코어 + 네온 글로우) + PNG 스티커로 꾸미기
6. **완성** 버튼 → 고해상도 dataURL 캡쳐 → 길게 눌러 사진 앱 저장
7. 영상은 `?download=` 쿼리로 파일 앱에 다운로드
8. 운영자 iPad 에서 **확인** 버튼 누르면 QR overlay 닫힘 → 다음 촬영 가능
9. 24h 후 Supabase pg_cron 이 Storage + DB row 자동 파기

### 보조: `/display` (선택)
- 운영자가 별도 노트북/태블릿에서 큐 보고 싶을 때
- 운영 필수 X — iPad 가 QR 직접 표시하니까

---

## 🌍 배포된 곳

| 항목 | URL / 위치 |
|---|---|
| **운영 도메인** | `https://saewoo-v-o3o-v.vercel.app` |
| Vercel 프로젝트 | `vercel.com/hevyns-projects/photobooth` |
| GitHub repo | `github.com/Hevyn/photobooth` (private) |
| Supabase 프로젝트 | `dvdnlivivvrlxodnyusi.supabase.co` |

---

## 💻 새 노트북에서 이어 작업하는 법

### 1. 클론

```bash
cd ~/Documents
git clone git@github.com:Hevyn/photobooth.git PhotoBooth
cd PhotoBooth
```

SSH 키 등록 안 된 새 Mac 이라면:
```bash
ssh-keygen -t ed25519 -C "hevyn@users.noreply.github.com" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
# 출력 복사 → https://github.com/settings/ssh/new → Add
```

### 2. 비밀 파일 두 개 만들기 (.gitignore 라 추적 X)

#### a. `web-app/.env.local`

`.env.local.sample` 복사 후 값 채우기:
```
NEXT_PUBLIC_SUPABASE_URL=https://dvdnlivivvrlxodnyusi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase 대시보드 → Project Settings → API → anon public>
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # 또는 https://saewoo-v-o3o-v.vercel.app
NEXT_DEV_LAN_ORIGIN=192.168.x.y  # 폰 검증 시만, 평소엔 비워둠
```

#### b. `PhotoBooth/Config/Debug.xcconfig`

`Debug.xcconfig.sample` 복사 후 값 채우기. Supabase URL 은 **호스트만** (https:// 없이):
```
SUPABASE_URL = dvdnlivivvrlxodnyusi.supabase.co
SUPABASE_ANON_KEY = <같은 anon key>
```

### 3. 의존성 설치

```bash
cd web-app && npm install && cd ..
```

iPad 빌드는 Xcode 열고 `PhotoBooth/PhotoBooth.xcodeproj` 더블클릭. Apple Developer 계정 로그인 + 팀 선택 필요.

### 4. 작동 확인

- 웹: `cd web-app && npm run dev` → http://localhost:3000/display
- iPad: Xcode 에서 실기기 빌드 (시뮬레이터는 ARKit 미지원)

---

## 📂 파일 트리 (핵심)

```
~/Documents/PhotoBooth/
├── PROGRESS.md                          ← 이 파일
├── .gitignore                           (xcconfig + .env + bundle/ 워킹폴더 보호)
├── docs/
│   ├── REQUIREMENTS.md                  (FR 15 + NFR)
│   └── DECISIONS.md                     (ADR 11)
│
├── PhotoBooth/                          ← iPad 앱 (Swift/SwiftUI + ARKit)
│   ├── PhotoBooth.xcodeproj
│   ├── Config/Debug.xcconfig            🔐 (gitignore)
│   ├── Config/Debug.xcconfig.sample     (더미값)
│   ├── App/PhotoBoothApp.swift
│   ├── Features/
│   │   ├── Camera/CameraSession.swift   (촬영 + 필터 부착 + 영상 합성)
│   │   ├── Camera/CameraView.swift      (UI + QR overlay)
│   │   └── Filters/Filter.swift         (필터 모델 + Filter.all 배열)
│   ├── Services/SupabaseService.swift   (Storage 업로드 + photos insert)
│   ├── Services/UploadQueue.swift       (영속 큐 + 재시도)
│   └── bundle/                          (Xcode folder reference, PNG 자산)
│       ├── eye_glasses.png              (얼굴 추적 — 안경/모자/볼)
│       ├── eye_glasses2.png
│       ├── face_shrimp.png              (얼굴 감싸기)
│       ├── lip_fork1~5.png              (입 옆)
│       └── overlay_*.png                (정적 오버레이 — 화면 가득)
│
├── web-app/                             ← Next.js 16 + React 19 + TS + Tailwind v4
│   ├── .env.local                       🔐 (gitignore)
│   ├── .env.local.sample
│   ├── next.config.ts                   (allowedDevOrigins)
│   ├── app/
│   │   ├── layout.tsx                   (next/font/local — MonoplexKR)
│   │   ├── globals.css                  (파스텔 팔레트 + 패턴 + sticker-card / chunky-btn)
│   │   ├── page.tsx                     (→ /display)
│   │   ├── display/page.tsx             (운영자 화면, 최신 사진 먼저)
│   │   └── edit/[photoId]/
│   │       ├── page.tsx                 (Supabase fetch + 영상 저장)
│   │       └── FabricEditor.tsx         (캔버스 + 펜/스티커/undo/redo/완성)
│   ├── lib/supabase/client.ts
│   └── public/
│       ├── decorate.png                 (SAEWOO 로고)
│       ├── fonts/MonoplexKR-Italic.ttf  (단일 폰트)
│       └── stickers/sticker1~8.png      (꾸미기 PNG 스티커)
│
└── supabase/migrations/
    ├── 0001_init_photos.sql             (photos 테이블 + Storage 정책)
    ├── 0002_cron_cleanup.sql            (24h 후 Storage + row 자동 파기)
    └── 0003_realtime.sql                (Realtime publication)
```

---

## 🛠️ 자주 하는 작업 — 정확한 절차

### A. 웹 디자인/카피 수정

1. `web-app/app/...` 코드 수정
2. `git add ... && git commit -m "..." && git push`
3. Vercel 자동 빌드 + 배포 (1-2분)
4. `https://saewoo-v-o3o-v.vercel.app` 새로고침 (Cmd+Shift+R)

### B. 폰트 추가/교체

1. 폰트 파일 → `web-app/public/fonts/MyFont.woff2` (또는 ttf/otf)
2. `app/layout.tsx` 의 `localFont({src: "../public/fonts/MyFont.woff2", variable: "--font-jua"})` 수정
3. push → 자동 배포

### C. 스티커 PNG 추가

1. PNG → `web-app/public/stickers/sticker9.png`
2. `app/edit/[photoId]/FabricEditor.tsx` 의 `STICKERS` 배열에 path 추가
3. push → 자동 배포

### D. iPad 필터 추가 (얼굴 추적 / 정적 오버레이)

1. PNG → `PhotoBooth/bundle/myasset.png` (Xcode folder reference 라 자동 인식)
2. `PhotoBooth/Features/Filters/Filter.swift` 의 `Filter.all` 에 한 줄 추가
3. **Xcode 재빌드 + 실기기 배포**

### E. iPad 코드 변경 (필터 외)

1. Swift 파일 수정
2. **Xcode 재빌드 + 실기기 배포**

---

## 🎨 디자인 자산 사이즈 가이드

| 종류 | 추천 사이즈 | 비고 |
|---|---|---|
| `/edit` 캔버스 꾸미기 스티커 | 400×400 PNG 알파 | 가운데 비율 유지로 들어감 |
| iPad 얼굴 추적 (안경) | 1024×512 PNG 알파 | 비율 자동, faceSize.width 만 조절 |
| iPad 얼굴 추적 (모자/얼굴 감싸기) | 1024×1024 PNG 알파 | |
| iPad 정적 오버레이 (배경 데코) | 1440×1080 PNG 알파 가로형 4:3 | 가운데 투명, 외곽 그래픽 |
| 사이트 로고 | 600×400 정도 | 알파 |

---

## 🔑 환경변수 / 핵심 상수

### web-app/.env.local (모두 NEXT_PUBLIC_ — 빌드 시 코드에 박힘)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase 호스트 (https:// 포함)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — 공개 OK 인 anon key
- `NEXT_PUBLIC_BASE_URL` — QR 코드에 들어갈 URL prefix
- `NEXT_DEV_LAN_ORIGIN` — 폰 LAN 검증 시 노트북 IP (dev only)

### PhotoBooth/Config/Debug.xcconfig (xcconfig 형식, gitignore)
- `SUPABASE_URL` — **호스트만** (예: `dvdnlivivvrlxodnyusi.supabase.co`)
- `SUPABASE_ANON_KEY`

### iPad 코드의 하드코딩 상수
- `CameraView.swift` 의 `kBaseURL = "https://saewoo-v-o3o-v.vercel.app"` — QR URL 만들 때 사용

⚠ **운영 도메인 바뀌면**: `kBaseURL` + `NEXT_PUBLIC_BASE_URL` 둘 다 업데이트.

---

## 🌐 Vercel 배포 메모

### 프로젝트 설정 (이미 설정됨)
- Root Directory: `web-app` ⚠ 필수
- Framework Preset: **Next.js** ⚠ Other 면 404 발생
- Environment Variables: `NEXT_PUBLIC_SUPABASE_URL` + `_ANON_KEY` + `_BASE_URL` 3개 박혀있음
- Production Domain: `saewoo-v-o3o-v.vercel.app`

### 환경변수 바뀐 후엔 반드시
Deployments → 최근 ⋯ → **Redeploy** (⚠ "Use existing Build Cache" 체크 해제). `NEXT_PUBLIC_*` 은 빌드 시점에 코드에 박혀서 새 빌드 필요.

### 도메인 추가
Settings → Domains → 입력란에 `<name>.vercel.app` 입력 → Add → ⋯ → Set as Production.

---

## 🗄️ Supabase 메모

### 핵심 테이블
- `photos` (id uuid PK, storage_path, image_url, video_path, video_url, created_at)
- Storage 버킷 `photobooth_images` (public, RLS open)

### 24시간 자동 파기 (검증됨)
- `0002_cron_cleanup.sql` 의 pg_cron 이 15분마다 실행
- **Storage 객체 먼저 삭제 → 그 다음 photos row 삭제**
- 운영 중 누적 위험 없음

### 무료 plan 한도
- Storage: 1GB / Bandwidth: 5GB·월 / DB: 500MB
- **300명 × 1장 = ~450MB Storage 피크** → Free 충분
- 운영 전 사전 정리 권장:
  ```sql
  -- Supabase SQL Editor 에서
  delete from public.photos;
  delete from storage.objects where bucket_id = 'photobooth_images';
  ```

### 일시정지 주의
무료 plan 은 **7일간 활동 없으면 자동 일시정지** → 대시보드 카드의 "Restore" 누르면 1-2분 활성화. 운영 전 활성 상태 확인.

---

## ✅ 합의된 핵심 결정사항 (잊지 말 것)

상세는 `docs/DECISIONS.md`. 요약:

1. 영상 720×720 → 4:3 가로형 **960×720**, 사진 **1440×1080**
2. 업로드 재시도: 전경 3회 (7s/2s/2s) + 백그라운드 1회
3. 큐 영속화: FileManager + JSON manifest, iCloud 백업 제외
4. `/display` 큐 정렬: **descending (최신 0번)**. 새 INSERT 시 0번 보고 있으면 자동 표시, 다른 인덱스면 보던 사진 유지
5. 꾸미기 결과는 폰 로컬만 (서버 재업로드 X)
6. 인증: anon key + open RLS (행사 단기 운영 가정)
7. QR URL = `/edit/<uuid>` 직접 (매핑 없음, UploadJob.id = Supabase photos.id)
8. UI 카피 긍정형 + 마침표 통일
9. `/edit` 꾸미기는 사진에만, 영상은 ARKit 합성 그대로 + 다운로드
10. ARKit 얼굴 추적 — `maximumNumberOfTrackedFaces = supportedNumberOfTrackedFaces` (A12+ 면 3명 동시)
11. iPad 가 QR 직접 표시 → /display 없이도 운영 가능

---

## 🎨 디자인 톤 (현재)

- **폰트**: MonoplexKR-Italic 단일 (영문/한글 모두)
- **로고**: `/public/decorate.png` — SAEWOO (E8FFFF 배경 + FF9F6E 살구 + 313131 검정)
- **팔레트** (globals.css):
  - 살구 primary: `--color-pop-apricot: #ff9f6e`
  - 파스텔 핑크: `#ffc8dd`
  - 파스텔 노랑: `#ffe2a8`
  - 연 민트: `#e8ffff`
  - 잉크: `#313131`
- **컴포넌트 utility**:
  - `.sticker-card` — 두꺼운 검정 보더 + 3px chunky shadow
  - `.chunky-btn` — 알약 보더 버튼 + 2px shadow + hover/active 인터랙션
  - `.tilt-left` / `.tilt-right` — ±2.2° 기울임
- 배경: cream `#fff8e0` 단색 (`/edit`), 단색 (`/display`)

---

## 🐛 알려진 이슈 / 노이즈

### SourceKit 경고 (실제 에러 X)
Xcode 의 _live_ 분석이 가끔 `UIKit`, `UploadQueue`, `Filter` 등 모듈/타입을 못 찾는다고 경고. **Xcode 빌드(Cmd+B) 는 정상**. 무시.

### Vercel 환경변수 변경 후 변화 안 보일 때
- Use existing Build Cache 해제 + Redeploy
- 브라우저 하드 새로고침 (Cmd+Shift+R)

### iPad QR overlay 가 안 뜸
- 업로드 _succeeded_ 까지 가야 표시 — `stage = .succeeded` 도달 확인
- `kBaseURL` 이 운영 도메인과 맞는지

### bundle/ 의 `" 2"` 접미사 파일들
Xcode 가 자동으로 _복사본_ 만든 흔적. 의도. 건드리지 말 것.

---

## 🚧 향후 작업 후보

- 멀티 테넌트 (events 테이블 + photos.event_id) — 행사 여러 개 동시
- 운영자 대시보드 (`/admin`) — Supabase Auth
- ARKit 자산 정밀 위치 조정 (얼굴 landmark blendShape 기반)
- 디자인 자산 더 추가
- pg_cron 동작 모니터링 (24h 이내 정리 확인)
- 행사 후 회고 + 사용자 피드백 반영
