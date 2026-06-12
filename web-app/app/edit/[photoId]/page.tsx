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
    return <Centered>사진을 불러오고 있어요...</Centered>
  }

  if (status === 'not_found') {
    return (
      <Centered>
        <h1 className="font-display text-3xl text-pop-pink mb-3 drop-shadow-[2px_2px_0_var(--color-pop-ink)]">
          OOPS!
        </h1>
        <p className="text-lg font-bold">이 링크의 사진은 이미 사라졌어요</p>
        <p className="text-sm mt-1 opacity-70">24시간이 지났거나, 다른 QR 일 수 있어요</p>
      </Centered>
    )
  }

  if (status === 'error') {
    return (
      <Centered>
        <h1 className="font-display text-3xl text-pop-pink mb-3 drop-shadow-[2px_2px_0_var(--color-pop-ink)]">
          TRY&nbsp;AGAIN
        </h1>
        <p className="text-lg font-bold">잠시 후 다시 시도해주세요</p>
        <p className="text-sm mt-1 opacity-70">사진을 불러오는 중 문제가 있었어요</p>
      </Centered>
    )
  }

  return (
    <main className="min-h-dvh p-4">
      <header className="text-center mb-6 mt-2 flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/decorate.png"
          alt="SAEWOO"
          className="w-48 md:w-56 h-auto tilt-left"
        />
        <p className="mt-2 text-base font-bold leading-relaxed">
          저와 추억을 쌓아주셔서 감사합니다.
          <br />
          사진을 저장하고 싶으시다면 완성 버튼을 눌러주세요♡
        </p>
      </header>

      <section className="mb-4 max-w-md mx-auto">
        <FabricEditor imageUrl={photo!.image_url} />
      </section>

      {photo!.video_url && (
        <section className="sticker-card p-4 mb-4 max-w-md mx-auto flex flex-col items-center gap-3">
          <video
            src={photo!.video_url}
            controls
            playsInline
            className="w-full rounded-2xl border-[3px] border-pop-ink"
          />
          <a
            href={`${photo!.video_url}${photo!.video_url.includes('?') ? '&' : '?'}download=photobooth_${photoId.slice(0, 8)}.mp4`}
            download={`photobooth_${photoId.slice(0, 8)}.mp4`}
            className="chunky-btn bg-pop-sky text-pop-ink px-6 py-2.5 text-base inline-block"
          >
            영상 저장하기
          </a>
          <p className="text-xs font-bold text-pop-ink/70 text-center max-w-xs">
            폰의 다운로드 폴더 (파일 앱) 에 저장됩니다.
          </p>
        </section>
      )}

      <footer className="mt-6 text-sm font-bold opacity-70 text-center pb-4">
        사진과 QR 은 24시간 후 자동으로 삭제됩니다.
      </footer>
    </main>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 text-center">
      <div className="sticker-card px-8 py-10 max-w-md">{children}</div>
    </main>
  )
}
