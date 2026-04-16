# components

## auth/AuthModal.tsx
로그인/회원가입 모달 + AuthModalContext.
openAuth('login'|'signup') 어디서든 호출 가능.
회원가입 후 이메일 인증 안내 모달 표시.

## course/CourseCard.tsx
강의 카드 컴포넌트. course + enrolledCount props.
총 시간은 calcTotalDuration(course.curriculum) 사용.

## layout/Navbar.tsx
데스크톱: 로고 + pill 네비(Home/Course/Instructor/Contact) + 프로필 드롭다운
모바일: 로고 + 햄버거(CSS 애니메이션 ↔ X) → 풀스크린 메뉴(프로필+네비+내메뉴+로그아웃)
/lesson 경로에서는 간소화된 네비.

## ui/Toast.tsx
ToastContext + useToast(). toast('메시지', 'ok'|'err'|'info')

## ui/HeroBg.tsx
캔버스 기반 3D 배경. 회전 링 4개(원근 투영) + 깊이 파티클 60개 + 마우스 패럴랙스 + 연결선.

## ui/SeoHead.tsx
useSiteSettings에서 SEO 설정 읽어 meta 태그 동적 주입 (title, description, og, twitter).
