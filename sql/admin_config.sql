-- 관리자 전용 설정 (공개 site_settings와 분리 — 관리자 알림 수신번호 등 민감값)
-- Supabase SQL Editor에서 1회 실행.
-- 읽기/쓰기는 관리자(admin_users)만. 서버리스(notify-admin)는 service_role로 RLS 우회 조회.

create table if not exists public.admin_config (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.admin_config enable row level security;

drop policy if exists admin_config_admin on public.admin_config;
create policy admin_config_admin on public.admin_config
  for all
  using (auth.uid() in (select user_id from public.admin_users))
  with check (auth.uid() in (select user_id from public.admin_users));
