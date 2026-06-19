-- 사용자 접속 로그 (어드민 분석용)
-- Supabase SQL Editor에서 1회 실행.
-- 기록은 서버리스 함수(api/log-event)가 service_role로 INSERT (IP/위치/기기 헤더 수집).
-- 조회는 관리자(admin_users)만 가능.

create table if not exists public.access_logs (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_id     uuid,                 -- 로그인 사용자 (비로그인 접속은 null)
  user_name   text,
  user_email  text,
  event       text not null,        -- 'login' | 'signup' | 'course_view' | 'lesson_view'
  course_id   text,
  course_title text,
  path        text,                 -- 접속 경로
  ip          text,                 -- 클라이언트 IP (x-forwarded-for)
  country     text,                 -- 접속 국가 (Vercel geo 헤더)
  city        text,                 -- 접속 도시 (Vercel geo 헤더)
  device      text,                 -- 'mobile' | 'tablet' | 'desktop'
  os          text,
  browser     text,
  user_agent  text
);

create index if not exists access_logs_created_idx on public.access_logs (created_at desc);
create index if not exists access_logs_user_idx    on public.access_logs (user_id);
create index if not exists access_logs_course_idx  on public.access_logs (course_id);

alter table public.access_logs enable row level security;

-- 관리자만 조회 (admin_users에 등록된 uid). INSERT 정책은 두지 않음 →
-- anon/일반 사용자는 직접 쓰기 불가. 기록은 service_role(api/log-event)이 RLS 우회로 수행.
drop policy if exists access_logs_admin_read on public.access_logs;
create policy access_logs_admin_read on public.access_logs
  for select
  using (auth.uid() in (select user_id from public.admin_users));

-- (선택) 오래된 로그 정리: 90일 경과분 삭제 — 필요 시 cron/수동 실행
-- delete from public.access_logs where created_at < now() - interval '90 days';
