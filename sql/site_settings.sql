-- 사이트 설정 Supabase 저장 (결제 모드/키 전 사용자 공유 + 시크릿 서버 전용)
-- Supabase SQL Editor에서 1회 실행.

-- 1) 공개 사이트 설정 — 모드/클라이언트키/결제수단/SEO/정책/카피라이트 (시크릿 제외)
create table if not exists public.site_settings (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;

-- 모든 방문자 읽기 허용 (클라이언트 키는 공개 전제, 시크릿은 여기 없음)
drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings
  for select using (true);

-- 관리자만 쓰기 (admin_users에 등록된 uid)
drop policy if exists site_settings_write on public.site_settings;
create policy site_settings_write on public.site_settings
  for all
  using (auth.uid() in (select user_id from public.admin_users))
  with check (auth.uid() in (select user_id from public.admin_users));

-- 2) 결제 시크릿 키 — 서버 전용 (toss-confirm이 service_role로 조회)
create table if not exists public.payment_secret (
  id text primary key default 'main',
  secret_key text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.payment_secret enable row level security;

-- 관리자만 읽기/쓰기 (마스킹 표시 + 저장). anon/일반 사용자 접근 불가.
-- toss-confirm은 service_role 키로 RLS를 우회해 읽음.
drop policy if exists payment_secret_admin on public.payment_secret;
create policy payment_secret_admin on public.payment_secret
  for all
  using (auth.uid() in (select user_id from public.admin_users))
  with check (auth.uid() in (select user_id from public.admin_users));
