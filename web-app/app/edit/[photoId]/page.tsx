'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase, type Photo } from '@/lib/supabase/client'

// Fabric.js 는 브라우저 전용 (window/document 사용) — SSR 차단
const FabricEditor = dynamic(() => import('./FabricEditor'), { ssr: false })

type Status = 'loading' | 'not_found' | 'error' | 'ready'

// photoId 가 UUID 형식이 아니면 DB 조회 전에 not_found 로 단락
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function EditPage() {
  const params = useParams<{ photoId: string }>()
  const photoId = params?.photoId ?? ''
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    if (!UUID_RE.test(photoId)) {
      setStatus('not_found')
      return
    }
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('photos')
          .select('*')
          .eq('id', photoId)
          .maybeSingle()
        if (error) {
          console.error('[edit] fetch failed:', error)
          setStatus('error')
        } else if (!data) {
          setStatus('not_found')
        } else {
          setPhoto(data as Photo)
          setStatus('ready')
        }
      } catch (e) {
        console.error('[edit] fetch threw:', e)
        setStatus('error')
      }
    })()
  }, [photoId])

  if (status === 'loading') {
    return <Centered>📷 사진을 불러오고 있어요...</Centered>
  }

  if (status === 'not_found') {
    return (
      <Centered>
        <h1 className="text-2xl font-black mb-2">이 링크의 사진은 이미 사라졌어요</h1>
        <p className="text-sm opacity-70">24시간이 지났거나, 다른 QR 일 수 있어요.</p>
      </Centered>
    )
  }

  if (status === 'error') {
    return (
      <Centered>
        <h1 className="text-2xl font-black mb-2">잠시 후 다시 시도해주세요</h1>
        <p className="text-sm opacity-70">사진을 불러오는 중 문제가 있었어요.</p>
      </Centered>
    )
  }

  return (
    <main className="min-h-dvh bg-gradient-to-br from-pink-100 via-pink-50 to-yellow-100 p-4 text-pink-900">
      <header className="text-center mb-6">
        <h1 className="text-2xl font-black tracking-tight">✨ 사진 꾸미기</h1>
        <p className="text-xs mt-1 opacity-60">아래 사진을 꾸민 뒤 길게 눌러 저장하세요</p>
      </header>

      {/* 사진 꾸미기 캔버스 */}
      <section className="mb-4 max-w-md mx-auto">
        <FabricEditor imageUrl={photo!.image_url} />
      </section>

      {/* 영상 영역 */}
      {photo!.video_url && (
        <section className="bg-white rounded-3xl shadow-xl p-4 mb-4 max-w-md mx-auto flex flex-col items-center gap-3">
          <video
            src={photo!.video_url}
            controls
            playsInline
            className="w-full rounded-2xl"
          />
          <a
            href={`${photo!.video_url}${photo!.video_url.includes('?') ? '&' : '?'}download=photobooth_${photoId.slice(0, 8)}.mp4`}
            download={`photobooth_${photoId.slice(0, 8)}.mp4`}
            className="px-5 py-2 rounded-full bg-pink-500 text-white font-bold text-sm shadow-md hover:bg-pink-600 transition"
          >
            📥 영상 저장
          </a>
          <p className="text-[10px] text-pink-700 opacity-80 text-center max-w-xs">
            폰의 다운로드 폴더 (파일 앱) 에 저장돼요
          </p>
        </section>
      )}

      <footer className="mt-6 text-xs opacity-60 text-center">
        📷 사진과 QR 은 24시간 후 자동으로 삭제됩니다
      </footer>
    </main>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-gradient-to-br from-pink-100 via-pink-50 to-yellow-100 flex flex-col items-center justify-center p-6 text-pink-900 text-center">
      {children}
    </main>
  )
}
