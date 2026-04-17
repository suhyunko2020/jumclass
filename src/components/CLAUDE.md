# components

## auth/AuthModal.tsx
로그인/회원가입 모달 + AuthModalContext.
openAuth('login'|'signup') 어디서든 호출 가능.
회원가입 후 이메일 인증 안내 모달 표시.

## course/CourseCard.tsx
강의 카드. 레벨 뱃지는 `getLevelColor()` 적용 (색상만, 박스 없음).
총 시간은 `calcTotalDuration(course.curriculum)` 사용.

## course/SignaturePad.tsx
Canvas 기반 서명 패드. PointerEvent로 터치/마우스 모두 지원.
DPR 대응, "다시 쓰기" 버튼, PNG DataURL(`onChange`) 반환.

## course/CertificateAgreementForm.tsx
자격증 수강 동의서 폼. 약관 본문 토글 + 이름/생년월일/연락처 + SignaturePad 통합.
CheckoutPage에서 자격증 결제 시 약관 동의 영역 아래에 삽입됨.

## layout/Navbar.tsx
데스크톱: 로고 + pill 네비(Home/Course/Instructor/Contact) + 프로필 드롭다운
모바일: 로고 + 햄버거(CSS 애니메이션 ↔ X) → 풀스크린 메뉴
**`authLoading` 중엔 우측 영역 빈 공간으로 렌더링** → 새로고침 시 깜빡임 방지
/lesson, /admin2026, /i/* 경로에서는 Navbar 숨김 (App.tsx에서 처리)

## layout/Footer.tsx
공통 푸터 (브랜드/강의/플랫폼/정책 4컬럼).
App.tsx에서 /admin2026, /lesson, /i/* 제외한 모든 경로에 렌더됨.

## layout/ScrollToTop.tsx
라우트 이동 시 최상단 스크롤. hash 있으면 스킵 (앵커 동작 보존).
App.tsx에 한 번만 배치.

## ui/Toast.tsx
ToastContext + useToast(). toast('메시지', 'ok'|'err'|'info')

## ui/HeroBg.tsx
캔버스 기반 3D 배경. 회전 링 4개(원근 투영) + 깊이 파티클 60개 + 마우스 패럴랙스 + 연결선.

## ui/SeoHead.tsx
useSiteSettings에서 SEO 설정 읽어 meta 태그 동적 주입 (title, description, og, twitter).
