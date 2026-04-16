# lib

## supabase.ts
Supabase 클라이언트. env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
URL: chhswmpfpmhkmbhvgwcq.supabase.co

## DB 테이블
profiles, enrollments, inquiries, reviews(+source), course_overrides(jsonb), custom_courses(jsonb)
RLS 정책 적용. auth.users INSERT 트리거 → profiles 자동 생성.

## Storage 버킷
lesson-attachments: 커리큘럼 첨부파일 (public, 10MB 제한, anon 업로드 허용)

## Edge Functions
notify-inquiry: inquiries INSERT 웹훅 → Resend API → support@primemuse.com
Secrets: RESEND_API_KEY, ADMIN_EMAIL, SITE_URL

## SEO
robots.txt + noindex 메타태그로 크롤링 임시 차단 중. 오픈 시 제거 필요.
