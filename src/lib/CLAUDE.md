# lib

## supabase.ts
Supabase 클라이언트. env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
URL: chhswmpfpmhkmbhvgwcq.supabase.co

## DB 테이블
- **profiles, enrollments(+ policy_agreed_at/keys, attachment_downloads jsonb, assigned_instructor_id), inquiries, reviews(+source)**
- **course_overrides(jsonb), custom_courses(jsonb), instructors(id+data jsonb)**
- **instructor_progress_pages**(id=토큰, user_id, course_id, instructor_id, checklist jsonb, notes, completed_at, expires_at)
- **certificate_agreements**(user_id, course_id, signer_name/birthdate/phone, signature_url, agreement_version, agreement_snapshot jsonb, signed_at)

RLS 정책 적용. auth.users INSERT 트리거 → profiles 자동 생성.
관리자 쿼리를 위해 대부분의 테이블에 `anon SELECT` 허용 정책 있음.

## Storage 버킷
- **lesson-attachments** (public, 10MB, 커리큘럼 첨부파일)
- **certificate-signatures** (public, 5MB, PNG only, 자격증 수강 동의서 서명 이미지)

## Edge Functions (Supabase)
- **notify-inquiry**: inquiries INSERT 웹훅 → Resend API → support@primemuse.com
  Secrets: RESEND_API_KEY, ADMIN_EMAIL, SITE_URL

## 서버리스 함수 (/api, Vercel Edge Runtime)
- **/api/send-alimtalk**: 비즈엠 알림톡 API 프록시 (자격증 결제 시 강사에게 진도 관리 URL 발송)
  Env: `BIZM_USERID`, `BIZM_PROFILE`, `BIZM_TEMPLATE_ID`, `SITE_ORIGIN`
  심사/환경변수 미완료 시 503 반환 (결제 플로우에는 영향 없음)

## SEO
robots.txt + noindex 메타태그로 크롤링 임시 차단 중. 오픈 시 제거 필요.
