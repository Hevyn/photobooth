-- 0003_realtime.sql
-- /display 페이지가 새 사진 INSERT 를 Realtime 으로 받으려면
-- photos 테이블을 supabase_realtime publication 에 추가해야 함.

alter publication supabase_realtime add table public.photos;
