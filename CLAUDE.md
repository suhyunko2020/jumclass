# JUMCLASS — 타로 강의 플랫폼

React 19 + Vite 8 + TS + Tailwind v4 + Supabase + Vercel
배포: `jumclass.vercel.app` / GitHub push 시 자동 재배포
관리자: `/admin2026` (admin / admin123!)

## 핵심 규칙
- 강의 조회: `useCourses().getCourse(id)` / `getPublicCourses()` — COURSES 직접 참조 금지
- 데이터: localStorage 캐시 읽기(동기) → Supabase 쓰기(비동기) — 캐시 우선 패턴
- 인증: `useAuth()` — Supabase Auth 기반, `AppUser` 타입
- CSS: `index.css` 컴포넌트 클래스 + `var(--purple)` 등 CSS 변수
- **반응형 필수**: 모든 UI 변경은 PC + 모바일(768px) 모두 대응. clamp()/auto-fit 우선, @media 규칙 병행
- 세부 사항은 각 폴더의 CLAUDE.md 참조
