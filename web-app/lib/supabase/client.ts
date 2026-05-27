import { createClient } from '@supabase/supabase-js'

/**
 * 브라우저용 Supabase 클라이언트 1개 인스턴스.
 * anon key 는 NEXT_PUBLIC_ 노출 OK — RLS 가 권한 결정.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
)

export type Photo = {
  id: string
  storage_path: string
  image_url: string
  video_path: string | null
  video_url: string | null
  created_at: string
}
