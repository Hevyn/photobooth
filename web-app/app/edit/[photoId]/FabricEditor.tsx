'use client'

import { useEffect, useRef, useState } from 'react'
import { Canvas, FabricImage, IText, PencilBrush, Shadow } from 'fabric'

type Mode = 'pen' | 'sticker'

const CANVAS_SIZE = 360 // 폰 친화 표시 사이즈. 원본 사진 1080 은 export 시 multiplier 로 복원

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

  // 캔버스 초기화 + 배경 사진 로드 (한 번만)
  // StrictMode dev 모드는 effect 를 두 번 호출 → fabricRef 가드로 1회 보장
  useEffect(() => {
    if (!canvasElRef.current || fabricRef.current) return

    const canvas = new Canvas(canvasElRef.current, {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      backgroundColor: '#ffffff',
      // Retina 자동 확대 끄기 — 명확한 1:1 좌표. HiDPI 는 export 시 복원 (이슈 #3)
      enableRetinaScaling: false,
    })
    canvas.setDimensions(
      { width: `${CANVAS_SIZE}px`, height: `${CANVAS_SIZE}px` },
      { cssOnly: true }
    )
    fabricRef.current = canvas

    FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' }).then((img) => {
      // fabric 의 실제 internal 좌표계 기준 (enableRetinaScaling 무관하게 자동 적응)
      const cw = canvas.getWidth()
      const ch = canvas.getHeight()
      const longer = Math.max(img.width ?? cw, img.height ?? ch, 1)
      const scale = Math.min(cw, ch) / longer
      img.set({
        scaleX: scale,
        scaleY: scale,
        left: 0,
        top: 0,
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
      left: CANVAS_SIZE / 2,
      top: CANVAS_SIZE / 2,
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

  return (
    <div className="flex flex-col items-center gap-3">
      {/* 캔버스 */}
      <div
        className="bg-white rounded-2xl shadow-md overflow-hidden"
        style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
      >
        <canvas ref={canvasElRef} width={CANVAS_SIZE} height={CANVAS_SIZE} />
      </div>

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
