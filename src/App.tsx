import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import ScrollToTop from './components/layout/ScrollToTop'
import { AuthModalProvider } from './components/auth/AuthModal'
import ComingSoonPage from './pages/ComingSoonPage'
import HomePage from './pages/HomePage'
import CoursesPage from './pages/CoursesPage'
import CourseDetailPage from './pages/CourseDetailPage'
import LessonPage from './pages/LessonPage'
import CheckoutPage from './pages/CheckoutPage'
import ClassroomPage from './pages/ClassroomPage'
import PaymentSuccessPage from './pages/PaymentSuccessPage'
import PaymentFailPage from './pages/PaymentFailPage'
import AdminPage from './pages/AdminPage'
import MyPage from './pages/MyPage'
import InstructorsPage from './pages/InstructorsPage'
import InstructorDetailPage from './pages/InstructorDetailPage'
import InstructorProgressPageView from './pages/InstructorProgressPage'
import PolicyPage from './pages/PolicyPage'
import NoticePage from './pages/NoticePage'
import { SeoProvider } from './components/ui/SeoHead'
import SitePopup from './components/ui/SitePopup'

// 오픈 시각 — 이 시각 전까지는 비밀번호를 입력하지 않은 모든 방문자에게 공사중 페이지 노출
// 비밀번호는 프론트에 두지 않고 /api/site-unlock(SITE_UNLOCK_PW 환경변수)에서 서버 검증한다.
// 2026-06-19 정식 오픈 — 공사중 잠금 해제됨 (과거 시각이라 게이트가 항상 통과)
const OPEN_AT_MS = new Date('2026-06-19T14:00:00+09:00').getTime()
const SITE_OPEN = true  // 오픈 완료. true면 공사중 게이트를 완전히 비활성화

export default function App() {
  const location = useLocation()
  const isAdmin = location.pathname === '/admin2026'
  const isProgressPage = location.pathname.startsWith('/i/')
  const hideNavbar = isAdmin || isProgressPage
  const hideFooter = isAdmin || location.pathname === '/lesson' || isProgressPage

  // 1초 tick — 카운트다운 갱신 + 오픈 시각 도달 시 자동 해제
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // 사이트 잠금 해제 여부 — 비밀번호 입력 시 localStorage에 기록 (브라우저별 유지)
  const [unlocked, setUnlocked] = useState(() => {
    try { return localStorage.getItem('jum_site_unlock') === '1' } catch { return false }
  })
  async function tryUnlock(pw: string): Promise<boolean> {
    try {
      const res = await fetch('/api/site-unlock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        try { localStorage.setItem('jum_site_unlock', '1') } catch { /* 무시 */ }
        setUnlocked(true)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  // 공사중 판정: 오픈 전 + 비밀번호 미입력이면 URL 직접 접근 포함 모든 페이지 차단.
  // 로컬 개발(import.meta.env.DEV)에선 /api가 없어 잠금에 갇히므로 게이트를 건너뛴다.
  const maintenance = !SITE_OPEN && !import.meta.env.DEV && now < OPEN_AT_MS && !unlocked

  if (maintenance) {
    return <ComingSoonPage remainingMs={OPEN_AT_MS - now} onUnlock={tryUnlock} />
  }

  return (
    <AuthModalProvider>
      <SeoProvider>
      <ScrollToTop />
      <div className="page-bg" />
      {!hideNavbar && <Navbar />}
      <div className="app-main">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/course/:courseId" element={<CourseDetailPage />} />
        <Route path="/lesson" element={<LessonPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/classroom" element={<ClassroomPage />} />
        <Route path="/payment-success" element={<PaymentSuccessPage />} />
        <Route path="/payment-fail" element={<PaymentFailPage />} />
        <Route path="/my" element={<MyPage />} />
        <Route path="/instructors" element={<InstructorsPage />} />
        <Route path="/instructor/:instructorId" element={<InstructorDetailPage />} />
        <Route path="/policy/:type" element={<PolicyPage />} />
        <Route path="/notice" element={<NoticePage />} />
        <Route path="/notice/:id" element={<NoticePage />} />
        <Route path="/i/:token" element={<InstructorProgressPageView />} />
        <Route path="/admin2026" element={<AdminPage />} />
      </Routes>
      </div>
      {!hideFooter && <Footer />}
      {/* 진입 팝업 — 관리자/수강(lesson)/강사진도(/i) 화면 제외 */}
      {!hideNavbar && location.pathname !== '/lesson' && <SitePopup />}
      </SeoProvider>
    </AuthModalProvider>
  )
}
