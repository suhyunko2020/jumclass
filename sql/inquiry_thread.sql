-- 1:1 문의 대댓글(스레드) + 답변 완료 처리용 컬럼 추가.
-- Supabase SQL Editor에서 1회 실행. (기존 inquiries에 컬럼만 추가 — 비파괴적)
-- ※ 이 SQL을 먼저 실행한 뒤 배포해야 합니다.

alter table public.inquiries
  add column if not exists thread       jsonb not null default '[]'::jsonb,  -- 주고받은 메시지 [{sender,body,at}]
  add column if not exists resolved_at  timestamptz;                          -- 관리자가 '답변 완료' 처리한 시각
