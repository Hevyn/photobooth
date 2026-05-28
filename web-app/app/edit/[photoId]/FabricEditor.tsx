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
    canvas.setDimensions(
      { width: `${CANVAS_W}px`, height: `${CANVAS_H}px` },
      { cssOnly: true }
    )
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
    <div className="flex flex-col items-center gap-3">
      {/* 캔버스 — fabric 이 직접 그릴 element. dispose 우려로 항상 mount, 위에 img 오버레이로 가림 */}
      <div
        className="bg-white rounded-2xl shadow-md overflow-hidden relative"
        style={{ width: CANVAS_W, height: CANVAS_H }}
      >
        <canvas ref={canvasElRef} width={CANVAS_W} height={CANVAS_H} />
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
          <p className="text-sm text-pink-800 font-bold">
            📱 위 사진을 길게 눌러 저장하세요
          </p>
          <button
            onClick={() => setSavedDataURL(null)}
            className="px-5 py-2 rounded-full bg-pink-100 text-pink-900 font-bold text-sm shadow-sm hover:bg-pink-200 transition"
          >
            ↩️ 다시 꾸미기
          </button>
        </>
      ) : (
      <>
      {/* 모드 토글 */}
      <div className="flex gap-2">
        <ToolBtn active={mode === 'pen'} onClick={() => setMode('pen')}>
          ✏️ 펜
        </ToolBtn>
        <ToolBtn active={mode === 'sticker'} onClick={() => setMode('sticker')}>
          ✨ 스티커
        </ToolBtn>
      </div>

      {/* 펜 색 선택 */}
      {mode === 'pen' && (
        <div className="flex gap-2 items-center">
          {PEN_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setPenColor(c.value)}
              aria-label={c.name}
              className={`w-9 h-9 rounded-full border-2 transition ${
                penColor === c.value
                  ? 'border-pink-900 scale-110'
                  : 'border-white opacity-70'
              }`}
              style={{
                backgroundColor: c.value,
                boxShadow: `0 0 12px ${c.value}`,
              }}
            />
          ))}
        </div>
      )}

      {/* 이모지 스티커 */}
      {mode === 'sticker' && (
        <div className="flex gap-2">
          {STICKERS.map((s) => (
            <button
              key={s}
              onClick={() => addSticker(s)}
              className="w-11 h-11 text-2xl bg-white rounded-full shadow-sm hover:scale-110 transition"
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
          className="px-3 py-1.5 text-xs rounded-full bg-pink-200 text-pink-900 font-semibold hover:bg-pink-300 transition"
        >
          선택 지우기
        </button>
        <button
          onClick={clearAll}
          className="px-3 py-1.5 text-xs rounded-full bg-pink-200 text-pink-900 font-semibold hover:bg-pink-300 transition"
        >
          전체 초기화
        </button>
      </div>

      {/* 저장 준비 — 고해상도 dataURL 캡쳐 후 img 로 overlay */}
      <button
        onClick={prepareSave}
        className="mt-2 px-6 py-2.5 rounded-full bg-pink-500 text-white font-bold shadow-md hover:bg-pink-600 transition"
      >
        ✨ 완성
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
      className={`px-4 py-2 rounded-full text-sm font-bold transition shadow-sm ${
        active
          ? 'bg-pink-500 text-white scale-105'
          : 'bg-white text-pink-700 hover:bg-pink-50'
      }`}
    >
      {children}
    </button>
  )
}
