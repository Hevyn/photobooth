'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase, type Photo } from '@/lib/supabase/client'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

export default function DisplayPage() {
  const [queue, setQueue] = useState<Photo[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [loaded, setLoaded] = useState(false)

  // 1) 첫 로드 — 최근 24h photos 가져오기 (오래된 순으로 정렬해서 큐로)
  useEffect(() => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    supabase
      .from('photos')
      .select('*')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('[display] initial load failed:', error)
        } else if (data) {
          setQueue(data as Photo[])
        }
        setLoaded(true)
      })
  }, [])

  // 2) Realtime — 새 INSERT 들어오면 큐에 append (자동 전환 X, 현재 인덱스 유지)
  useEffect(() => {
    const channel = supabase
      .channel('photos-insert')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'photos' },
        (payload) => {
          const newPhoto = payload.new as Photo
          setQueue((prev) => {
            // 중복 방지 (드물지만 안전망)
            if (prev.some((p) => p.id === newPhoto.id)) return prev
            return [...prev, newPhoto]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const current = queue[currentIdx]
  const total = queue.length

  // 큐가 비어있다 → currentIdx 가 무효해질 때 보정
  useEffect(() => {
    if (total > 0 && currentIdx >= total) {
      setCurrentIdx(total - 1)
    }
  }, [total, currentIdx])

  const goPrev = () => setCurrentIdx((i) => Math.max(0, i - 1))
  const goNext = () => setCurrentIdx((i) => Math.min(total - 1, i + 1))

  return (
    <main className="min-h-dvh bg-gradient-to-br from-pink-100 via-pink-50 to-yellow-100 flex flex-col items-center justify-center p-6 text-pink-900">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-black tracking-tight">📸 PhotoBooth</h1>
        <p className="text-sm mt-1 opacity-70">
          {!loaded
            ? '불러오는 중...'
            : total === 0
              ? '아직 사진이 없어요. 첫 사진을 기다리는 중!'
              : `📥 대기 ${total}장 · 현재 ${currentIdx + 1}번째`}
        </p>
      </header>

      {current ? (
        <section className="bg-white rounded-3xl shadow-xl p-8 flex flex-col md:flex-row items-center gap-8 max-w-4xl w-full">
          {/* 미리보기 */}
          <div className="flex-1 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.image_url}
              alt="사진 미리보기"
              className="rounded-2xl shadow-md max-h-[60vh] object-contain"
            />
          </div>

          {/* QR */}
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-4 rounded-2xl border-4 border-pink-200">
              <QRCodeSVG
                value={`${BASE_URL}/edit/${current.id}`}
                size={240}
                level="M"
                bgColor="#ffffff"
                fgColor="#1f1f1f"
              />
            </div>
            <p className="text-sm font-semibold text-pink-700">
              📱 QR 을 스캔하면 꾸미기 페이지로 이동해요
            </p>
          </div>
        </section>
      ) : loaded ? (
        <section className="bg-white/60 rounded-3xl p-12 text-center text-pink-700">
          첫 촬영을 시작해보세요!
        </section>
      ) : null}

      {/* 이전/다음 */}
      {total > 0 && (
        <nav className="mt-8 flex gap-4">
          <button
            onClick={goPrev}
            disabled={currentIdx === 0}
            className="px-6 py-3 rounded-full bg-pink-400 text-white font-bold shadow-md hover:bg-pink-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            ◀ 이전
          </button>
          <button
            onClick={goNext}
            disabled={currentIdx >= total - 1}
            className="px-6 py-3 rounded-full bg-pink-400 text-white font-bold shadow-md hover:bg-pink-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            다음 ▶
          </button>
        </nav>
      )}

      <footer className="mt-10 text-xs opacity-60">
        📷 사진과 QR 은 24시간 후 자동으로 삭제됩니다
      </footer>
    </main>
  )
}
