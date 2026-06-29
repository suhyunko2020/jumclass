-- 자격증 수동등록 시 함께 묶어 등록한 무료 인터넷강의 기록용 컬럼.
-- 상세페이지 공개용(includedCourseIds)과 분리된, 수강건별 비공개 묶음.
-- 환불 시 이 목록 기준으로 시청분 공제를 계산한다.
-- Supabase SQL Editor에서 1회 실행. (비파괴적 — 컬럼만 추가)

alter table public.enrollments
  add column if not exists bundled jsonb not null default '[]'::jsonb;  -- [{ courseId, days }]
