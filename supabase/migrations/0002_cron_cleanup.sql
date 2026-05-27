-- 0002_cron_cleanup.sql
-- 24h 지난 사진/영상/레코드를 15분마다 자동 파기

create extension if not exists pg_cron;

create or replace function public.cleanup_expired_photos()
returns void language plpgsql security definer as $$
begin
  -- 1) Storage 객체 먼저 삭제 (이미지 + 영상 둘 다)
  delete from storage.objects
  where bucket_id = 'photobooth_images'
    and name in (
      select storage_path from public.photos
      where created_at < now() - interval '24 hours'
      union all
      select video_path from public.photos
      where created_at < now() - interval '24 hours'
        and video_path is not null
    );

  -- 2) 레코드 삭제
  delete from public.photos
  where created_at < now() - interval '24 hours';
end;
$$;

select cron.schedule(
  'cleanup-photobooth-photos',
  '*/15 * * * *',
  $$ select public.cleanup_expired_photos(); $$
);
