# CLAUDE.md — JUMCLASS React LMS

## 프로젝트 개요
타로 강의 플랫폼. React 19 + Vite + TypeScript + Tailwind v4 + React Router v7.
**Supabase** 백엔드 연동 완료 (Auth, DB, Edge Functions).
배포: GitHub → Vercel 자동 배포 (`https://jumclass.vercel.app`)

---

## 기술 스택
| 항목 | 내용 |
|------|------|
| 프레임워크 | React 19 + Vite 8 |
| 언어 | TypeScript 6 |
| 스타일 | Tailwind CSS v4 (`@theme` 토큰) + 커스텀 CSS 클래스 (`index.css`) |
| 라우팅 | React Router DOM v7 |
| 상태 관리 | React Context API (AuthContext, ToastContext, AuthModalContext) |
| 백엔드 | Supabase (Auth + PostgreSQL + Edge Functions) |
| 결제 | 토스페이먼츠 연동 예정 (현재 테스트 모드) |
| 배포 | Vercel (GitHub 연동, push 시 자동 재배포) |

---

## 디렉토리 구조

```
src/
├── main.tsx              # 루트: BrowserRouter > AuthProvider > ToastProvider
├── App.tsx               # 라우팅 + AuthModalProvider, /admin2026에서 Navbar 숨김
├── index.css             # Tailwind @theme 토큰 + 모든 컴포넌트 CSS 클래스
│
├── data/
│   ├── types.ts          # 모든 TypeScript 인터페이스 (Course, Enrollment, Inquiry, Review 등)
│   └── courses.ts        # 강의 정적 데이터 (COURSES 배열, TESTIMONIALS)
│
├── hooks/
│   ├── useAuth.tsx       # AuthContext + AuthProvider — Supabase Auth 기반
│   └── useCourses.ts     # 강의 데이터 훅 — 캐시 우선(localStorage) + Supabase 백그라운드 동기화
│
├── lib/
│   ├── supabase.ts       # Supabase 클라이언트 초기화
│   └── database.types.ts # DB 테이블 타입 정의
│
├── utils/
│   ├── storage.ts        # Supabase 비동기 함수 (inquiries, users, enrollments CRUD)
│   └── format.ts         # 포맷 유틸 (formatPrice, discountRate 등)
│
├── components/
│   ├── auth/
│   │   └── AuthModal.tsx  # 로그인/회원가입 모달 + AuthModalContext
│   ├── course/
│   │   └── CourseCard.tsx # 강의 카드 컴포넌트
│   ├── layout/
│   │   └── Navbar.tsx     # 상단 네비게이션 (스크롤 반응, 유저 드롭다운, 모바일 햄버거)
│   └── ui/
│       └── Toast.tsx      # 토스트 알림 (ToastContext, useToast)
│
└── pages/
    ├── HomePage.tsx           # / — 히어로, 강의 목록, 특징, 후기, CTA, 문의, 푸터
    ├── CoursesPage.tsx        # /courses — 강의 목록 (레벨 필터)
    ├── CourseDetailPage.tsx   # /course/:courseId — 강의 상세 (커리큘럼, 구매 사이드바, 리뷰)
    ├── LessonPage.tsx         # /lesson?course=&lesson= — Vimeo 플레이어 + 사이드바 목차
    ├── CheckoutPage.tsx       # /checkout?course=&tier= — 결제 (테스트 모드 / Toss 연동)
    ├── PaymentSuccessPage.tsx # /payment-success — 결제 완료 + 수강 등록 처리
    ├── PaymentFailPage.tsx    # /payment-fail — 결제 실패
    ├── ClassroomPage.tsx      # /classroom — 내 강의실 (진도, 휴강/재개)
    ├── MyPage.tsx             # /my — 마이페이지 (결제 내역, 환불 요청, 1:1 문의 CRUD)
    └── AdminPage.tsx          # /admin2026 — 관리자 (대시보드, 강의/수강생/문의/리뷰 관리)
```

---

## 핵심 아키텍처 규칙

### 강의 데이터 조회
- **항상 `useCourses().getCourse(id)` 또는 `getAllCourses()` 사용**
- `COURSES` 배열 직접 참조 금지 → override/custom 병합 결과가 필요하기 때문
- 앱 시작 시 `syncFromSupabase()` 자동 호출 → localStorage 캐시 갱신

### 데이터 레이어 (캐시 우선 패턴)
- **읽기**: localStorage 캐시에서 동기적으로 즉시 반환
- **쓰기**: localStorage 즉시 업데이트 → Supabase 백그라운드 동기화
- **캐시 키**:
  | 키 | 내용 |
  |----|------|
  | `arcana_course_overrides` | 관리자가 수정한 강의 데이터 |
  | `arcana_custom_courses` | 관리자가 직접 등록한 강의 |
  | `arcana_reviews` | 수강생 리뷰 |
  | `arcana_admin` (sessionStorage) | 관리자 로그인 상태 |

### 인증 (Supabase Auth)
- `useAuth()` 훅: `user(AppUser)`, `login`, `signup`, `loginWithGoogle`, `logout`, `enroll`, `pauseCourse`, `resumeCourse`, `completeLesson`, `enrollManual`
- `AppUser` 타입: `{ uid, name, email, avatar, createdAt, enrollments }`
- `useAuthModal()` 훅: `openAuth('login' | 'signup')` 어디서든 호출 가능

### Supabase 비동기 함수 (`utils/storage.ts`)
- `getMyInquiries(userId)` / `getInquiries()` / `addInquiry()` / `editInquiry()` / `answerInquiry()`
- `getAllUsers()` / `getAllEnrollmentsAdmin()` / `cancelEnrollment()`
- 반환값은 모두 camelCase로 매핑되어 있음

### 토스트 알림
- `useToast()` 훅: `toast('메시지', 'ok' | 'err' | 'info')`

### CSS 전략
- `index.css`에 컴포넌트 CSS 클래스 정의 (`.btn`, `.navbar`, `.course-card`, `.modal-box` 등)
- Tailwind 유틸은 인라인 `style={}` 또는 간단한 레이아웃에만 사용
- 디자인 토큰: `var(--purple)`, `var(--gold)`, `var(--t1)`, `var(--ok)` 등 CSS 변수 사용

---

## Supabase 구성

### 프로젝트
- URL: `https://chhswmpfpmhkmbhvgwcq.supabase.co`
- 환경변수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (`.env` + Vercel 환경변수)

### 테이블
| 테이블 | 용도 |
|--------|------|
| `profiles` | 회원 프로필 (id, name, avatar, email, created_at) |
| `enrollments` | 수강 내역 (user_id, course_id, expiry_date, progress, paused 등) |
| `inquiries` | 1:1 문의 (subject, message, status, answer 등) |
| `reviews` | 수강 후기 (course_id, rating, text 등) |
| `course_overrides` | 강의 데이터 수정 내역 (jsonb) |
| `custom_courses` | 관리자 직접 등록 강의 (jsonb) |

### Edge Functions
- `notify-inquiry`: 새 문의 등록 시 `support@primemuse.com`으로 이메일 알림
  - Trigger: `inquiries` 테이블 INSERT 웹훅
  - 이메일 발송: Resend API
  - Secrets: `RESEND_API_KEY`, `ADMIN_EMAIL`, `SITE_URL`

---

## 관리자 접속
- URL: `/admin2026`
- ID: `admin` / PW: `admin123!`
- 기능: 대시보드, 강의 등록/편집/커리큘럼 관리, 수강생 관리, 결제 내역, 문의 답변, 리뷰 삭제

---

## 배포
- GitHub: `https://github.com/suhyunko2020/jumclass`
- Vercel: `https://jumclass.vercel.app`
- 코드 수정 후 `git add . && git commit -m "메시지" && git push` → Vercel 자동 재배포

---

## 결제 연동
- 현재: 테스트 모드 (버튼 클릭 시 바로 수강 등록)
- Toss 연동: `CheckoutPage.tsx`의 `TOSS_CLIENT_KEY` 설정 필요
- 성공 콜백: `/payment-success?course=&tier=&paymentKey=&orderId=&amount=`
- 실패 콜백: `/payment-fail?course=&message=`

## 수강 기간 (pricingTiers)
- 각 강의는 `pricingTiers` 배열로 복수 기간 옵션 제공
- `days: 9999` = 무제한
- `CheckoutPage`에서 `?tier=0` 파라미터로 선택된 tier 전달

## 휴강 기능
- `pauseConfig: { maxPauses: N, maxDays: M }` — 강의마다 설정
- `useAuth().pauseCourse(courseId)` / `resumeCourse(courseId)`
- 휴강 중 수강 기간 정지, 재개 시 잔여 일수 기준으로 만료일 재계산
