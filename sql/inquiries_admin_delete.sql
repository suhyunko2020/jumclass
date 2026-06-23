-- 관리자(admin_users)가 문의(inquiries)를 삭제할 수 있도록 DELETE 정책 추가.
-- 중복/오접수 문의 정리용. Supabase SQL Editor에서 1회 실행.
-- ※ 이 정책이 없으면 어드민의 '🗑 삭제'가 RLS에 막혀 동작하지 않습니다.

drop policy if exists inquiries_admin_delete on public.inquiries;
create policy inquiries_admin_delete on public.inquiries
  for delete
  using (auth.uid() in (select user_id from public.admin_users));
