-- 0001_init_photos.sql
-- photos 테이블 + Storage 버킷 + 익명 접근용 RLS

create extension if not exists pgcrypto;

create table public.photos (
  id            uuid primary key default gen_random_uuid(),
  storage_path  text not null,                    -- ex) 2026-05-24/<uuid>.jpg
  image_url     text not null,                    -- 공개 URL (웹에서 바로 로드)
  video_path    text,                             -- 촬영 과정 영상 (null 가능)
  video_url     text,                             -- 영상 공개 URL (null 가능)
  created_at    timestamptz not null default now()
);

create index photos_created_at_idx on public.photos (created_at);

-- 현장 부스라 로그인 없음 → anon 키 + 단순 RLS
alter table public.photos enable row level security;

create policy "anon_read"   on public.photos for select using (true);
create policy "anon_insert" on public.photos for insert with check (true);

-- Storage 버킷 (이미지 + 영상 같은 버킷, 폴더로만 구분)
insert into storage.buckets (id, name, public)
values ('photobooth_images', 'photobooth_images', true)
on conflict (id) do nothing;

create policy "bucket_read"
  on storage.objects for select using (bucket_id = 'photobooth_images');

create policy "bucket_insert"
  on storage.objects for insert with check (bucket_id = 'photobooth_images');
