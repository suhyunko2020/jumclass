-- 홈페이지 문의(비회원) 접수 지원
-- 기존 inquiries.user_id 가 NOT NULL 이라 비회원(user_id=null) 문의가 거부됨(code 23502).
-- 비회원 문의를 허용하려면 user_id 를 nullable 로 변경.
-- Supabase SQL Editor에서 1회 실행.

alter table public.inquiries alter column user_id drop not null;

-- 참고: user_id 외래키가 있다면 null 은 FK 검사 대상이 아니므로 그대로 두어도 됩니다.
-- 홈 문의는 api/contact 가 service_role 로 user_id=null, type='contact' 로 저장합니다.
