import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAuthModal } from '../auth/AuthModal'

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { openAuth } = useAuthModal()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const isLesson = location.pathname === '/lesson'
  if (isLesson) {
    return (
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <Link to="/" className="nav-logo">JUM<span className="dot">CLASS</span></Link>
        <div className="nav-center" />
        <div className="nav-right">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/classroom')}>← 강의실</button>
        </div>
      </nav>
    )
  }

  const path = location.pathname
  const isActive = (p: string) => path === p || (p !== '/' && path.startsWith(p))

  function handleContact(e: React.MouseEvent) {
    e.preventDefault()
    if (path === '/') {
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate('/')
      setTimeout(() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }), 300)
    }
    setMobileOpen(false)
  }

  function handleLogout() {
    logout()
    setDropdownOpen(false)
    setMobileOpen(false)
    navigate('/')
  }

  return (
    <>
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <Link to="/" className="nav-logo">JUM<span className="dot">CLASS</span></Link>

        {/* 데스크톱 네비 */}
        <div className="nav-center">
          <div className="nav-center-pill">
            <Link to="/" className={`nav-link ${path === '/' ? 'active' : ''}`}>Home</Link>
            <Link to="/courses" className={`nav-link ${isActive('/courses') || isActive('/course') ? 'active' : ''}`}>Course</Link>
            <a href="#contact" className="nav-link" onClick={handleContact}>Contact Us</a>
          </div>
        </div>

        {/* 데스크톱 우측 */}
        <div className="nav-right nav-desktop">
          {user ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setDropdownOpen(p => !p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 14px', borderRadius: '99px', cursor: 'pointer',
                  background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
                  fontSize: '.855rem', fontWeight: 600, color: 'var(--t1)',
                  transition: 'var(--t)',
                }}
              >
                <span style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--purple), var(--purple-sat))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '.75rem', fontWeight: 700, flexShrink: 0,
                }}>{user.avatar}</span>
                {user.name}
              </button>
              {dropdownOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setDropdownOpen(false)} />
                  <div style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 200,
                    background: 'var(--bg-3)', border: '1px solid var(--line)',
                    borderRadius: 'var(--r3)', width: '180px', overflow: 'hidden',
                    boxShadow: '0 16px 48px rgba(0,0,0,.4)',
                  }}>
                    <Link to="/classroom" style={{ display: 'block', padding: '11px 16px', fontSize: '.875rem', transition: 'var(--t)' }}
                      onClick={() => setDropdownOpen(false)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      📚 내 강의실
                    </Link>
                    <Link to="/my?tab=payments" style={{ display: 'block', padding: '11px 16px', fontSize: '.875rem', transition: 'var(--t)' }}
                      onClick={() => setDropdownOpen(false)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      💳 결제내역
                    </Link>
                    <Link to="/my?tab=inquiries" style={{ display: 'block', padding: '11px 16px', fontSize: '.875rem', transition: 'var(--t)' }}
                      onClick={() => setDropdownOpen(false)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      💬 문의하기
                    </Link>
                    <div style={{ height: '1px', background: 'var(--line)', margin: '0 12px' }} />
                    <button onClick={handleLogout} style={{
                      width: '100%', padding: '11px 16px', fontSize: '.875rem',
                      textAlign: 'left', transition: 'var(--t)', color: 'var(--t2)',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.05)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
                      로그아웃
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => openAuth('login')}>로그인</button>
              <button className="btn btn-primary btn-sm" onClick={() => openAuth('signup')}>무료 시작</button>
            </>
          )}
        </div>

        {/* 모바일 우측: 햄버거만 */}
        <button className="hamburger" onClick={() => setMobileOpen(p => !p)}>
          {mobileOpen
            ? <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>✕</span>
            : <><span /><span /><span /></>
          }
        </button>
      </nav>

      {/* 모바일 메뉴 */}
      <div className={`mobile-menu ${mobileOpen ? 'open' : ''}`}>
        {/* 프로필 영역 */}
        {user && (
          <div className="mobile-profile">
            <div className="mobile-profile-avatar">{user.avatar}</div>
            <div>
              <div className="mobile-profile-name">{user.name}</div>
              <div className="mobile-profile-email">{user.email}</div>
            </div>
          </div>
        )}

        {/* 네비게이션 */}
        <div className="mobile-nav-section">
          <Link to="/" className={`mobile-nav-item ${path === '/' ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
            <span className="mobile-nav-icon">🏠</span> Home
          </Link>
          <Link to="/courses" className={`mobile-nav-item ${isActive('/courses') ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
            <span className="mobile-nav-icon">📚</span> Course
          </Link>
          <a href="#contact" className="mobile-nav-item" onClick={handleContact}>
            <span className="mobile-nav-icon">✉️</span> Contact Us
          </a>
        </div>

        {user ? (
          <>
            <div className="mobile-menu-divider" />
            <div className="mobile-nav-section">
              <Link to="/classroom" className="mobile-nav-item" onClick={() => setMobileOpen(false)}>
                <span className="mobile-nav-icon">🎬</span> 내 강의실
              </Link>
              <Link to="/my?tab=payments" className="mobile-nav-item" onClick={() => setMobileOpen(false)}>
                <span className="mobile-nav-icon">💳</span> 결제/환불 내역
              </Link>
              <Link to="/my?tab=inquiries" className="mobile-nav-item" onClick={() => setMobileOpen(false)}>
                <span className="mobile-nav-icon">💬</span> 1:1 문의
              </Link>
            </div>
            <div className="mobile-menu-divider" />
            <div className="mobile-nav-section">
              <button className="mobile-nav-item" style={{ width: '100%', color: 'var(--t3)' }} onClick={handleLogout}>
                로그아웃
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mobile-menu-divider" />
            <div style={{ display: 'flex', gap: '8px', padding: '12px 16px' }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => { openAuth('login'); setMobileOpen(false) }}>로그인</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => { openAuth('signup'); setMobileOpen(false) }}>무료 시작</button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
