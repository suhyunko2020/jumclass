import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import ScrollToTop from './components/layout/ScrollToTop'
import { AuthModalProvider } from './components/auth/AuthModal'
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
import PolicyPage from './pages/PolicyPage'
import SeoHead from './components/ui/SeoHead'

export default function App() {
  const location = useLocation()
  const isAdmin = location.pathname === '/admin2026'
  const hideFooter = isAdmin || location.pathname === '/lesson'

  return (
    <AuthModalProvider>
      <SeoHead />
      <ScrollToTop />
      <div className="page-bg" />
      {!isAdmin && <Navbar />}
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
        <Route path="/admin2026" element={<AdminPage />} />
      </Routes>
      {!hideFooter && <Footer />}
    </AuthModalProvider>
  )
}
