-- 접속 로그 lesson 단위 세분화 + 비인가 시청(lesson_breach) 탐지용 컬럼 추가
-- Supabase SQL Editor에서 1회 실행. (기존 access_logs 테이블에 컬럼만 추가 — 비파괴적)
-- ※ 이 SQL을 먼저 실행한 뒤 배포해야 합니다. (컬럼이 없으면 새 코드의 INSERT가 실패해 로깅이 끊김)

alter table public.access_logs
  add column if not exists lesson_id    text,   -- 시청한 개별 강의(lesson) ID
  add column if not exists lesson_title text;   -- 시청한 개별 강의 제목

-- 비인가 시청(lesson_breach)만 빠르게 조회하기 위한 인덱스 (선택)
create index if not exists access_logs_event_idx on public.access_logs (event);
