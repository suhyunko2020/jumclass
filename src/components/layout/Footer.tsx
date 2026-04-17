import { Link } from 'react-router-dom'
import { useSiteSettings } from '../../hooks/useSiteSettings'
import { useAuth } from '../../hooks/useAuth'
import { useAuthModal } from '../auth/AuthModal'

export default function Footer() {
  const { get: getSettings } = useSiteSettings()
  const { user } = useAuth()
  const { openAuth } = useAuthModal()
  const siteSettings = getSettings()

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <span className="logo">JUMCLASS</span>
            <p>{siteSettings.brandDescription}</p>
          </div>
          <div className="footer-col">
            <h4>강의</h4>
            <Link to="/courses">전체 강의</Link>
            <Link to="/courses">자격증 과정</Link>
            <Link to="/instructors">강사 소개</Link>
          </div>
          <div className="footer-col">
            <h4>플랫폼</h4>
            <Link to="/classroom">내 강의실</Link>
            <Link to="/instructors">강사 소개</Link>
            {!user && (
              <button
                style={{ textAlign: 'left', fontSize: '.83rem', color: 'var(--t2)', display: 'block', marginBottom: '9px' }}
                onClick={() => openAuth('signup')}
              >
                무료 시작
              </button>
            )}
            <Link to="/#contact">문의</Link>
          </div>
          <div className="footer-col">
            <h4>정책</h4>
            <Link to="/policy/privacy">개인정보처리방침</Link>
            <Link to="/policy/terms">이용약관</Link>
            <Link to="/policy/refund">환불 정책</Link>
            <Link to="/policy/copyright">저작권 안내</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>{siteSettings.copyright}</span>
          <span>{siteSettings.businessInfo}</span>
        </div>
      </div>
    </footer>
  )
}
