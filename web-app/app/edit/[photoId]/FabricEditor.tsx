'use client'

import { useEffect, useRef, useState } from 'react'
import { Canvas, FabricImage, PencilBrush, Shadow } from 'fabric'

type Mode = 'pen' | 'sticker'

// 캔버스 표시 사이즈 (4:3 가로형). 원본 사진 1440×1080 은 export 시 multiplier 로 복원
const CANVAS_W = 400
const CANVAS_H = 300

// 펜은 항상 흰색 코어 + 선택한 색의 글로우 (네온 광선 효과)
const PEN_CORE = '#ffffff'
const GLOW_COLORS = [
  { name: '핑크', value: '#ff70a6' },
  { name: '노랑', value: '#ffd166' },
  { name: '블루', value: '#5bc0eb' },
  { name: '퍼플', value: '#b294f7' },
  { name: '그린', value: '#a8e063' },
]

// PNG 스티커 자산 — public/stickers/ 안에 위치
const STICKERS = [
  '/stickers/sticker1.png',
  '/stickers/sticker2.png',
  '/stickers/sticker3.png',
  '/stickers/sticker4.png',
  '/stickers/sticker5.png',
  '/stickers/sticker6.png',
  '/stickers/sticker7.png',
  '/stickers/sticker8.png',
]
// 캔버스 좌표 기준 새 스티커 기본 너비 (PNG 비율에 따라 height 자동)
const STICKER_BASE_WIDTH = 100

type Props = {
  imageUrl: string
}

export default function FabricEditor({ imageUrl }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const backgroundRef = useRef<FabricImage | null>(null)
  const [mode, setMode] = useState<Mode>('pen')
  const [glowColor, setGlowColor] = useState<string>(GLOW_COLORS[0].value)
  const [savedDataURL, setSavedDataURL] = useState<string | null>(null)

  // Undo/Redo — snapshot 스택 (canvas.toJSON 직렬화). loadFromJSON 이 async 라
  // 적용 중에는 새 snapshot 안 쌓이게 isApplyingRef 가드.
  const historyRef = useRef<string[]>([])
  const historyIndexRef = useRef(-1)
  const isApplyingRef = useRef(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const updateCanUndoRedo = () => {
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
  }

  const pushHistory = () => {
    const canvas = fabricRef.current
    if (!canvas || isApplyingRef.current) return
    const json = JSON.stringify(canvas.toJSON())
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    historyRef.current.push(json)
    if (historyRef.current.length > 50) historyRef.current.shift()
    historyIndexRef.current = historyRef.current.length - 1
    updateCanUndoRedo()
  }

  const applyHistory = async (index: number) => {
    const canvas = fabricRef.current
    if (!canvas) return
    const json = historyRef.current[index]
    if (!json) return
    isApplyingRef.current = true
    await canvas.loadFromJSON(JSON.parse(json))
    // 배경 사진 ref 재설정 — selectable: false 인 image 객체
    backgroundRef.current =
      (canvas.getObjects().find(
        (o) => o.type === 'image' && o.selectable === false,
      ) as FabricImage | null) ?? null
    canvas.renderAll()
    historyIndexRef.current = index
    updateCanUndoRedo()
    isApplyingRef.current = false
  }

  const undo = () => {
    if (historyIndexRef.current <= 0) return
    void applyHistory(historyIndexRef.current - 1)
  }

  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    void applyHistory(historyIndexRef.current + 1)
  }

  // 캔버스 초기화 + 배경 사진 로드 (한 번만)
  // StrictMode dev 모드는 effect 를 두 번 호출 → fabricRef 가드로 1회 보장
  useEffect(() => {
    if (!canvasElRef.current || fabricRef.current) return

    const canvas = new Canvas(canvasElRef.current, {
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundColor: '#ffffff',
      // Retina 자동 확대 끄기 — 명확한 1:1 좌표. HiDPI 는 export 시 복원 (이슈 #3)
      enableRetinaScaling: false,
    })
    // CSS 사이즈는 외부 wrapper 폭에 맞춰 동적으로 (모바일 overflow 방지).
    // internal 좌표는 CANVAS_W×CANVAS_H 그대로 → fabric 이 좌표 자동 매핑.
    // 주의: canvasElRef.current.parentElement 는 fabric 이 만든 canvas-container 라
    // 거기 폭은 backing pixel 고정 → 반드시 우리가 박은 wrapperRef 를 관찰해야 한다.
    const syncCssSize = () => {
      const w = wrapperRef.current
      if (!w) return
      const cssW = Math.min(w.clientWidth, CANVAS_W)
      const cssH = cssW * (CANVAS_H / CANVAS_W)
      canvas.setDimensions(
        { width: `${cssW}px`, height: `${cssH}px` },
        { cssOnly: true }
      )
    }
    syncCssSize()
    const ro = new ResizeObserver(syncCssSize)
    if (wrapperRef.current) {
      ro.observe(wrapperRef.current)
    }
    fabricRef.current = canvas

    FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' }).then((img) => {
      // aspect-fit: 캔버스 안에 꽉 차되 비율 유지. 비율 다르면 가운데 정렬 + 여백
      const cw = canvas.getWidth()
      const ch = canvas.getHeight()
      const w = img.width ?? cw
      const h = img.height ?? ch
      const scale = Math.min(cw / w, ch / h)
      const scaledW = w * scale
      const scaledH = h * scale
      img.set({
        scaleX: scale,
        scaleY: scale,
        left: (cw - scaledW) / 2,
        top: (ch - scaledH) / 2,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
        hoverCursor: 'default',
      })
      canvas.add(img)
      canvas.sendObjectToBack(img)
      backgroundRef.current = img
      canvas.requestRenderAll()
      // 배경만 있는 초기 상태를 history 의 첫 entry 로
      pushHistory()
    })

    // 펜 stroke 완료 + 스티커 transform 시 history push
    canvas.on('path:created', () => pushHistory())
    canvas.on('object:modified', () => pushHistory())

    // 의도적으로 cleanup 없음 — StrictMode dev 의 두 번 mount 패턴에서
    // 첫 cleanup 이 ref 를 비우면 두 번째 mount 에서 또 init 됨.
    // 페이지 navigate 시 component 가 GC 되면 ref/wrapper 도 같이 정리됨.
  }, [imageUrl])

  // 모드 / 펜 색 변경 반영
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    if (mode === 'pen') {
      canvas.isDrawingMode = true
      const brush = new PencilBrush(canvas)
      brush.color = PEN_CORE // 흰색 코어
      brush.width = 5
      brush.shadow = new Shadow({
        color: glowColor, // 글로우만 색
        blur: 8, // 작은 blur — 진한 광선 효과
        offsetX: 0,
        offsetY: 0,
      })
      canvas.freeDrawingBrush = brush
    } else {
      canvas.isDrawingMode = false
    }
  }, [mode, glowColor])

  const addSticker = async (assetPath: string) => {
    const canvas = fabricRef.current
    if (!canvas) return
    try {
      const img = await FabricImage.fromURL(assetPath, { crossOrigin: 'anonymous' })
      const naturalW = img.width ?? STICKER_BASE_WIDTH
      const scale = STICKER_BASE_WIDTH / naturalW
      img.set({
        scaleX: scale,
        scaleY: scale,
        left: CANVAS_W / 2,
        top: CANVAS_H / 2,
        originX: 'center',
        originY: 'center',
      })
      canvas.add(img)
      canvas.setActiveObject(img)
      canvas.requestRenderAll()
      pushHistory()
    } catch (e) {
      console.error('[sticker] load failed:', e)
    }
  }

  const clearAll = () => {
    const canvas = fabricRef.current
    if (!canvas) return
    // 배경 사진은 보존
    canvas
      .getObjects()
      .filter((o) => o !== backgroundRef.current)
      .forEach((o) => canvas.remove(o))
    canvas.discardActiveObject()
    canvas.requestRenderAll()
    pushHistory()
  }

  // 캔버스 표시 사이즈(400) → 원본 사진 해상도(1440)로 export.
  // 길게 눌러 저장하면 OS 가 이 고해상도 dataURL 을 사진 앱에 저장.
  const prepareSave = () => {
    const canvas = fabricRef.current
    if (!canvas) return
    canvas.discardActiveObject()
    canvas.requestRenderAll()
    const url = canvas.toDataURL({
      format: 'png',
      multiplier: 1440 / CANVAS_W,
    })
    setSavedDataURL(url)
  }

  return (
    <div className="sticker-card p-4 flex flex-col items-center gap-4 w-full">
      {/* 캔버스 — 부모 폭에 맞춰 반응형. internal 좌표는 CANVAS_W×H 그대로 */}
      <div
        ref={wrapperRef}
        className="rounded-2xl border-[3px] border-pop-ink overflow-hidden relative bg-white w-full"
        style={{
          maxWidth: CANVAS_W,
          aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
        }}
      >
        <canvas
          ref={canvasElRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block"
        />
        {savedDataURL && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={savedDataURL}
            alt="저장용 고해상도 미리보기"
            className="absolute inset-0 w-full h-full object-contain bg-white"
          />
        )}
      </div>

      {savedDataURL ? (
        <>
          <p className="text-base font-bold text-pop-ink text-center leading-relaxed">
            위 사진을 길게 눌러 저장해주세요♡
            <br />
            감사합니다 - 새우 -
          </p>
          <button
            onClick={() => setSavedDataURL(null)}
            className="chunky-btn bg-pop-yellow text-pop-ink px-6 py-2 text-base"
          >
            BACK
          </button>
        </>
      ) : (
      <>
      {/* 모드 토글 */}
      <div className="flex gap-3">
        <ToolBtn active={mode === 'pen'} onClick={() => setMode('pen')}>
          PEN
        </ToolBtn>
        <ToolBtn active={mode === 'sticker'} onClick={() => setMode('sticker')}>
          STICKER
        </ToolBtn>
      </div>

      {/* 글로우 색 선택 (펜 코어는 항상 흰색) */}
      {mode === 'pen' && (
        <div className="flex gap-2 items-center">
          {GLOW_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setGlowColor(c.value)}
              aria-label={c.name}
              className="w-9 h-9 rounded-full border-[3px] border-pop-ink transition"
              style={{
                backgroundColor: c.value,
                transform: glowColor === c.value ? 'scale(1.15)' : 'scale(1)',
                boxShadow: glowColor === c.value
                  ? '2px 2px 0 0 var(--color-pop-ink)'
                  : '1px 1px 0 0 var(--color-pop-ink)',
              }}
            />
          ))}
        </div>
      )}

      {/* PNG 스티커 — 가로 스크롤 */}
      {mode === 'sticker' && (
        <div className="flex gap-2 overflow-x-auto max-w-full px-1 pb-1">
          {STICKERS.map((path) => (
            <button
              key={path}
              onClick={() => addSticker(path)}
              className="shrink-0 w-12 h-12 bg-white rounded-lg border-[3px] border-pop-ink shadow-[2px_2px_0_0_var(--color-pop-ink)] hover:scale-110 transition flex items-center justify-center p-1"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={path} alt="" className="max-w-full max-h-full object-contain" />
            </button>
          ))}
        </div>
      )}

      {/* 보조 버튼 — UNDO / REDO */}
      <div className="flex gap-2 mt-1">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="chunky-btn bg-white text-pop-ink px-5 py-1.5 text-sm"
        >
          UNDO
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="chunky-btn bg-white text-pop-ink px-5 py-1.5 text-sm"
        >
          REDO
        </button>
      </div>

      {/* 저장 준비 — 고해상도 dataURL 캡쳐 후 img 로 overlay */}
      <button
        onClick={prepareSave}
        className="chunky-btn bg-pop-apricot text-pop-ink px-8 py-3 text-xl mt-1"
      >
        완성
      </button>
      </>
      )}
    </div>
  )
}

function ToolBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`chunky-btn px-5 py-2 text-base ${
        active ? 'bg-pop-apricot text-pop-ink scale-105' : 'bg-white text-pop-ink'
      }`}
    >
      {children}
    </button>
  )
}
