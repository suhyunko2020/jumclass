-- 강의별 시청률 저장 (시청 시간에 비례해 진도 게이지가 차도록)
-- enrollments.lesson_watch = { "<lessonId>": <0~100 정수> }  최대 시청률 누적
-- 전체 progress = (Σ 강의별 시청률(완료강의는 100)) / 강의수
-- Supabase SQL Editor에서 1회 실행.

alter table public.enrollments
  add column if not exists lesson_watch jsonb not null default '{}'::jsonb;
