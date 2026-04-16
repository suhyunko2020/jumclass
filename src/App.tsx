import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
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

export default function App() {
  const location = useLocation()
  const isAdmin = location.pathname === '/admin2026'

  return (
    <AuthModalProvider>
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
        <Route path="/admin2026" element={<AdminPage />} />
      </Routes>
    </AuthModalProvider>
  )
}
