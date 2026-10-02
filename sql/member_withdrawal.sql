-- 회원 탈퇴 (계정 삭제 + 개인정보 익명화 + 재가입 차단)
--
-- 정책: 전자상거래법상 보존 의무(대금결제·계약 5년, 소비자분쟁 3년)가 있으므로
--       수강·결제·문의 기록은 삭제하지 않고 개인정보만 익명화한다.
--       로그인 계정(auth.users)은 삭제하고, 해당 이메일은 재가입을 차단한다.

-- 1) 탈퇴 이메일 목록 (재가입 차단용)
create table if not exists public.withdrawn_emails (
  email       text primary key,
  user_id     uuid,
  withdrawn_at timestamptz not null default now(),
  note        text
);

alter table public.withdrawn_emails enable row level security;

-- 관리자만 목록 조회/관리 (일반 사용자에게 노출 금지 — 개인정보)
drop policy if exists withdrawn_emails_admin_all on public.withdrawn_emails;
create policy withdrawn_emails_admin_all on public.withdrawn_emails
  for all
  using (auth.uid() in (select user_id from public.admin_users))
  with check (auth.uid() in (select user_id from public.admin_users));

-- 2) 재가입 차단 트리거 — auth.users INSERT 시점에 서버에서 강제 차단
--    (클라이언트 우회 불가)
create or replace function public.block_withdrawn_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.withdrawn_emails w
    where lower(w.email) = lower(new.email)
  ) then
    raise exception 'withdrawn_email_blocked'
      using hint = '탈퇴한 계정의 이메일은 다시 가입할 수 없습니다.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_withdrawn_signup on auth.users;
create trigger trg_block_withdrawn_signup
  before insert on auth.users
  for each row execute function public.block_withdrawn_signup();

-- 3) 가입 화면에서 미리 안내하기 위한 확인 함수
--    (목록 자체는 노출하지 않고 해당 이메일 여부만 true/false 반환)
create or replace function public.is_email_withdrawn(p_email text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.withdrawn_emails where lower(email) = lower(p_email)
  );
$$;

grant execute on function public.is_email_withdrawn(text) to anon, authenticated;
