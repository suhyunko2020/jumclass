# components

## auth/AuthModal.tsx
로그인/회원가입 모달 + AuthModalContext.
openAuth('login'|'signup') 어디서든 호출 가능.
회원가입 후 이메일 인증 안내 모달 표시.

## course/CourseCard.tsx
강의 카드 컴포넌트. course + enrolledCount props.

## layout/Navbar.tsx
스크롤 반응, 유저 드롭다운(강의실/결제내역/문의하기/로그아웃), 모바일 햄버거.
Contact Us → #contact 스크롤(홈) 또는 navigate+scroll(타 페이지).
/lesson 경로에서는 간소화된 네비 표시.

## ui/Toast.tsx
ToastContext + useToast(). toast('메시지', 'ok'|'err'|'info')

## ui/HeroBg.tsx
캔버스 기반 별자리 배경. 90개 별 + 3 오브 + 마우스 패럴랙스.
