# CLAUDE.md — JUMCLASS React LMS

## 프로젝트 개요
타로 강의 플랫폼. React 19 + Vite + TypeScript + Tailwind v4 + React Router v7.
localStorage 기반 데모 모드 (실제 운영 시 Firebase로 교체 예정).

---

## 기술 스택
| 항목 | 내용 |
|------|------|
| 프레임워크 | React 19 + Vite 8 |
| 언어 | TypeScript 6 |
| 스타일 | Tailwind CSS v4 (`@theme` 토큰) + 커스텀 CSS 클래스 (`index.css`) |
| 라우팅 | React Router DOM v7 |
| 상태 관리 | React Context API (AuthContext, ToastContext, AuthModalContext) |
| 데이터 저장 | localStorage (데모) |
| 결제 | 토스페이먼츠 연동 예정 (현재 테스트 모드) |

---

## 디렉토리 구조

```
src/
├── main.tsx              # 루트: BrowserRouter > AuthProvider > ToastProvider
├── App.tsx               # 라우팅 + AuthModalProvider
├── index.css             # Tailwind @theme 토큰 + 모든 컴포넌트 CSS 클래스
│
├── data/
│   ├── types.ts          # 모든 TypeScript 인터페이스 (Course, User, Enrollment, Inquiry, Review 등)
│   └── courses.ts        # 강의 데이터 (COURSES 배열, TESTIMONIALS)
│
├── hooks/
│   ├── useAuth.tsx       # AuthContext + AuthProvider (로그인/회원가입/수강/휴강 등)
│   └── useCourses.ts     # 강의 데이터 훅 (getCourse, getAllCourses, 리뷰 API 등)
│
├── utils/
│   ├── storage.ts        # localStorage 캡슐화 (User, Course 오버라이드, Review, Inquiry CRUD)
│   └── format.ts         # 포맷 유틸 (formatPrice, discountRate, formatDays 등)
│
├── components/
│   ├── auth/
│   │   └── AuthModal.tsx # 로그인/회원가입 모달 + AuthModalContext (openAuth 전역 노출)
│   ├── course/
│   │   └── CourseCard.tsx # 강의 카드 컴포넌트
│   ├── layout/
│   │   └── Navbar.tsx    # 상단 네비게이션 (스크롤 반응, 유저 드롭다운, 모바일 햄버거)
│   └── ui/
│       └── Toast.tsx     # 토스트 알림 (ToastContext, useToast)
│
└── pages/
    ├── HomePage.tsx          # / — 히어로, 강의 목록, 특징, 후기, CTA, 문의, 푸터
    ├── CoursesPage.tsx       # /courses — 강의 목록 (레벨 필터)
    ├── CourseDetailPage.tsx  # /course/:courseId — 강의 상세 (커리큘럼, 구매 사이드바, 리뷰)
    ├── LessonPage.tsx        # /lesson?course=&lesson= — Vimeo 플레이어 + 사이드바 목차
    ├── CheckoutPage.tsx      # /checkout?course=&tier= — 결제 (테스트 모드 / Toss 연동)
    ├── PaymentSuccessPage.tsx # /payment-success — 결제 완료 + 수강 등록 처리
    ├── PaymentFailPage.tsx   # /payment-fail — 결제 실패
    ├── ClassroomPage.tsx     # /classroom — 내 강의실 (진도, 휴강/재개)
    ├── MyPage.tsx            # /my — 마이페이지 (결제 내역, 환불 요청, 1:1 문의 CRUD)
    └── AdminPage.tsx         # /admin2026 — 관리자 (대시보드, 강의/수강생/문의 관리)
```

---

## 핵심 아키텍처 규칙

### 강의 데이터 조회
- **항상 `useCourses().getCourse(id)` 또는 `getAllCourses()` 사용**
- `COURSES` 배열 직접 참조 금지 → `getCourseOverrides()`와 병합된 결과가 필요하기 때문

### 인증 상태
- `useAuth()` 훅으로 `user`, `login`, `signup`, `enroll`, `completeLesson` 등 접근
- `useAuthModal()` 훅으로 `openAuth('login' | 'signup')` 어디서든 호출 가능

### 토스트 알림
- `useToast()` 훅: `toast('메시지', 'ok' | 'err' | 'info')`

### localStorage 키
| 키 | 내용 |
|----|------|
| `arcana_user` | 현재 로그인 세션 (User 객체) |
| `arcana_users` | 가입한 전체 유저 목록 |
| `arcana_course_overrides` | 관리자가 수정한 강의 데이터 |
| `arcana_reviews` | 수강생 리뷰 |
| `arcana_inquiries` | 1:1 문의 목록 |
| `arcana_admin` (sessionStorage) | 관리자 로그인 상태 |

### CSS 전략
- `index.css`에 컴포넌트 CSS 클래스 정의 (`.btn`, `.navbar`, `.course-card`, `.modal-box` 등)
- Tailwind 유틸은 인라인 `style={}` 또는 간단한 레이아웃에만 사용
- 디자인 토큰: `var(--purple)`, `var(--gold)`, `var(--t1)`, `var(--ok)` 등 CSS 변수 사용

---

## 관리자 접속
- URL: `/admin2026`
- ID: `admin` / PW: `admin123!`
- 기능: 대시보드, 강의 관리, 수강생 관리 (수동 등록), 문의 답변

## 결제 연동
- 현재: 테스트 모드 (버튼 클릭 시 바로 수강 등록)
- Toss 연동: `CheckoutPage.tsx`의 `TOSS_CLIENT_KEY` 설정 (현재 미설정)
- 성공 콜백: `/payment-success?course=&tier=&paymentKey=&orderId=&amount=`
- 실패 콜백: `/payment-fail?course=&message=`

## 수강 기간 (pricingTiers)
- 각 강의는 `pricingTiers` 배열로 복수 기간 옵션 제공
- `days: 9999` = 무제한 (`formatDays`가 "무제한 시청"으로 표시)
- `CheckoutPage`에서 `?tier=0` 파라미터로 선택된 tier 전달

## 휴강 기능
- `pauseConfig: { maxPauses: N, maxDays: M }` — 강의마다 설정
- `useAuth().pauseCourse(courseId)` / `resumeCourse(courseId)`
- 휴강 중 수강 기간 정지, 재개 시 잔여 일수 기준으로 만료일 재계산
