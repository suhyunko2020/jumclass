# JUMCLASS — 타로 강의 플랫폼

React 19 + Vite 8 + TS + Tailwind v4 + Supabase + Vercel
배포: `jumclass.vercel.app` / GitHub push 시 자동 재배포
관리자: `/admin2026` — Supabase Auth 로그인 + `admin_users` 테이블에 본인 uid 등록된 계정만 접근 (하드코딩 비밀번호 없음)

## 핵심 규칙

- 강의 조회: `useCourses().getCourse(id)` / `getPublicCourses()` — COURSES 직접 참조 금지
- 강사 조회: `useInstructors().getInstructor(id)` — Supabase 동기화됨 (localStorage 캐시 우선)
- 데이터 패턴: localStorage 캐시 읽기(동기) → Supabase 쓰기(비동기)
- 인증: `useAuth()` — Supabase Auth 기반, `AppUser` 타입. `loading` 상태로 깜빡임 방지
- 모달: `.modal-box`는 flex-column + overflow:hidden, `.modal-body`만 내부 스크롤
- CSS: `index.css` 컴포넌트 클래스 + `var(--purple)` 등 CSS 변수. 과도한 그라디언트/글로우/블러 지양
- **반응형 필수**: 모든 UI 변경은 PC + 모바일(768px) 모두 대응. clamp()/auto-fit 우선, @media 규칙 병행
- **톤**: AI스러운 과장 문구 지양. 자연스럽고 간결한 표현 사용

## 강의 레벨 분기

`level === '자격증'`일 때 UI/UX가 크게 달라짐 — `isCert` 상수로 일원화 권장
- 가격 티어: 3개월(90일) / 4개월(120일) 중 1개 (일반은 30/90/무제한 3개)
- 강사 선택: 구매 시 담당 강사 필수 선택
- 진도 관리: 강사가 직접 체크 (`instructor_progress_pages`)
- 수강 동의서: 캔버스 서명 + 이름/생년월일/연락처 수집
- 알림톡: 결제 시 강사에게 자동 발송 (비즈엠)
- 수강실: "진도 확인" + "약관 보기" 버튼 (lesson 페이지 이동 X)
- 커리큘럼 문구: "강의 진행 순서" (일반은 "강의 목차")
- `handleLevelChange()`가 레벨 전환 시 관련 필드 자동 정리 (`AdminPage.tsx`)

## 배포 워크플로우

1. 제가 코드 수정 → `npx tsc -b && npx vite build`로 검증
2. 사용자님이 `localhost:5173`에서 확인
3. 사용자님이 **"배포"** 말하면 그때 `git add/commit/push origin main`
4. Vercel 자동 재배포 (1~2분)

세부 사항은 각 폴더의 CLAUDE.md 참조
