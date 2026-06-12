'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase, type Photo } from '@/lib/supabase/client'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

export default function DisplayPage() {
  const [queue, setQueue] = useState<Photo[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [loaded, setLoaded] = useState(false)

  // 1) 첫 로드 — 최근 24h photos 가져오기 (최신이 큐 앞에 오게 descending)
  useEffect(() => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    supabase
      .from('photos')
      .select('*')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('[display] initial load failed:', error)
        } else if (data) {
          setQueue(data as Photo[])
        }
        setLoaded(true)
      })
  }, [])

  // 2) Realtime — 새 INSERT 시 큐 앞(0번)에 prepend.
  // 운영자가 0번(최신) 보고 있으면 새 사진이 자동 표시, 다른 사진 보고 있으면
  // 그 사진 유지 (currentIdx +1 로 밀어줌)
  useEffect(() => {
    const channel = supabase
      .channel('photos-insert')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'photos' },
        (payload) => {
          const newPhoto = payload.new as Photo
          setQueue((prev) => {
            if (prev.some((p) => p.id === newPhoto.id)) return prev
            return [newPhoto, ...prev]
          })
          setCurrentIdx((prev) => (prev === 0 ? 0 : prev + 1))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const current = queue[currentIdx]
  const total = queue.length

  // 큐가 비어있거나 인덱스 무효해질 때 보정
  useEffect(() => {
    if (total > 0 && currentIdx >= total) {
      setCurrentIdx(total - 1)
    }
  }, [total, currentIdx])

  // descending 큐 기준: PREV = 시간상 이전(더 옛) = 인덱스 +1, NEXT = 더 최신 = 인덱스 -1
  const goPrev = () => setCurrentIdx((i) => Math.min(total - 1, i + 1))
  const goNext = () => setCurrentIdx((i) => Math.max(0, i - 1))

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6">
      <header className="text-center mb-8 flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/decorate.png"
          alt="SAEWOO"
          className="w-64 md:w-80 h-auto tilt-left"
        />
        <p className="mt-3 text-lg font-bold">
          {!loaded
            ? '불러오는 중...'
            : total === 0
              ? '아직 사진이 없어요. 첫 사진을 기다려요'
              : `대기 ${total}장 · 현재 ${currentIdx + 1}번째`}
        </p>
      </header>

      {current ? (
        <section className="sticker-card p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 max-w-4xl w-full">
          <div className="flex-1 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.image_url}
              alt="사진 미리보기"
              className="rounded-2xl border-[3px] border-pop-ink shadow-[2px_2px_0_0_var(--color-pop-ink)] max-h-[60vh] object-contain tilt-right"
            />
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-4 rounded-2xl border-[3px] border-pop-ink shadow-[2px_2px_0_0_var(--color-pop-ink)] tilt-left">
              <QRCodeSVG
                value={`${BASE_URL}/edit/${current.id}`}
                size={240}
                level="M"
                bgColor="#ffffff"
                fgColor="#1a1a1a"
              />
            </div>
            <p className="font-body font-bold text-base text-pop-ink text-center leading-relaxed">
              QR을 스캔해주세요♡
              <br />
              감사합니다 - 새우 -
            </p>
            <p className="text-[10px] font-mono opacity-40 select-all">
              id: {current.id}
            </p>
          </div>
        </section>
      ) : loaded ? (
        <section className="sticker-card p-12 text-center">
          <p className="font-display text-2xl text-pop-apricot">FIRST&nbsp;SHOT!</p>
          <p className="font-bold mt-2">첫 촬영을 시작해보세요</p>
        </section>
      ) : null}

      {total > 0 && (
        <nav className="mt-8 flex gap-4">
          <button
            onClick={goPrev}
            disabled={currentIdx >= total - 1}
            className="chunky-btn bg-pop-yellow text-pop-ink px-7 py-3 text-lg"
          >
            PREV
          </button>
          <button
            onClick={goNext}
            disabled={currentIdx === 0}
            className="chunky-btn bg-pop-apricot text-pop-ink px-7 py-3 text-lg"
          >
            NEXT
          </button>
        </nav>
      )}

      <footer className="mt-10 text-sm font-bold opacity-70">
        사진과 QR 은 24시간 후 자동으로 삭제됩니다.
      </footer>
    </main>
  )
}
