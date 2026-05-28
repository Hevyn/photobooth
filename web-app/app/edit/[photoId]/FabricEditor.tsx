'use client'

import { useEffect, useRef, useState } from 'react'
import { Canvas, FabricImage, IText, PencilBrush, Shadow } from 'fabric'

type Mode = 'pen' | 'sticker'

// 캔버스 표시 사이즈 (4:3 가로형). 원본 사진 1440×1080 은 export 시 multiplier 로 복원
const CANVAS_W = 400
const CANVAS_H = 300

const PEN_COLORS = [
  { name: '핑크', value: '#ff70a6' },
  { name: '노랑', value: '#ffd166' },
  { name: '하늘', value: '#7dd3fc' },
]

const STICKERS = ['✨', '🌸', '💖', '⭐', '🦋']

type Props = {
  imageUrl: string
}

export default function FabricEditor({ imageUrl }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const backgroundRef = useRef<FabricImage | null>(null)
  const [mode, setMode] = useState<Mode>('pen')
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0].value)
  const [savedDataURL, setSavedDataURL] = useState<string | null>(null)

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
    })

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
      brush.color = penColor
      brush.width = 6
      brush.shadow = new Shadow({
        color: penColor,
        blur: 14,
        offsetX: 0,
        offsetY: 0,
      })
      canvas.freeDrawingBrush = brush
    } else {
      canvas.isDrawingMode = false
    }
  }, [mode, penColor])

  const addSticker = (emoji: string) => {
    const canvas = fabricRef.current
    if (!canvas) return
    const text = new IText(emoji, {
      left: CANVAS_W / 2,
      top: CANVAS_H / 2,
      fontSize: 60,
      originX: 'center',
      originY: 'center',
      editable: false,
    })
    canvas.add(text)
    canvas.setActiveObject(text)
    canvas.requestRenderAll()
  }

  const deleteSelected = () => {
    const canvas = fabricRef.current
    if (!canvas) return
    const active = canvas.getActiveObjects()
    active.forEach((o) => canvas.remove(o))
    canvas.discardActiveObject()
    canvas.requestRenderAll()
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
          <p className="text-base font-bold text-pop-ink">
            위 사진을 길게 눌러 저장하세요
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

      {/* 펜 색 선택 */}
      {mode === 'pen' && (
        <div className="flex gap-3 items-center">
          {PEN_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setPenColor(c.value)}
              aria-label={c.name}
              className="w-10 h-10 rounded-full border-[3px] border-pop-ink transition"
              style={{
                backgroundColor: c.value,
                transform: penColor === c.value ? 'scale(1.15)' : 'scale(1)',
                boxShadow: penColor === c.value
                  ? '3px 3px 0 0 var(--color-pop-ink)'
                  : '2px 2px 0 0 var(--color-pop-ink)',
              }}
            />
          ))}
        </div>
      )}

      {/* 이모지 스티커 (기능은 이모지 그대로 유지) */}
      {mode === 'sticker' && (
        <div className="flex gap-2">
          {STICKERS.map((s) => (
            <button
              key={s}
              onClick={() => addSticker(s)}
              className="w-12 h-12 text-2xl bg-white rounded-full border-[3px] border-pop-ink shadow-[3px_3px_0_0_var(--color-pop-ink)] hover:scale-110 transition"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* 보조 버튼 */}
      <div className="flex gap-2 mt-1">
        <button
          onClick={deleteSelected}
          className="chunky-btn bg-white text-pop-ink px-4 py-1.5 text-xs"
        >
          선택 지우기
        </button>
        <button
          onClick={clearAll}
          className="chunky-btn bg-white text-pop-ink px-4 py-1.5 text-xs"
        >
          전체 초기화
        </button>
      </div>

      {/* 저장 준비 — 고해상도 dataURL 캡쳐 후 img 로 overlay */}
      <button
        onClick={prepareSave}
        className="chunky-btn bg-pop-pink text-white px-8 py-3 text-xl mt-1"
      >
        DONE!
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
        active ? 'bg-pop-pink text-white scale-105' : 'bg-white text-pop-ink'
      }`}
    >
      {children}
    </button>
  )
}
