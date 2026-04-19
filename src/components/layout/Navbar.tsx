import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAuthModal } from '../auth/AuthModal'

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, loading: authLoading, isAdminLoggedIn } = useAuth()
  const { openAuth } = useAuthModal()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

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

        <div className="nav-center">
          <div className="nav-center-pill">
            <Link to="/" className={`nav-link ${path === '/' ? 'active' : ''}`}>Home</Link>
            <Link to="/courses" className={`nav-link ${isActive('/courses') || isActive('/course') ? 'active' : ''}`}>Course</Link>
            <Link to="/instructors" className={`nav-link ${isActive('/instructor') ? 'active' : ''}`}>Instructor</Link>
            <a href="#contact" className="nav-link" onClick={handleContact}>Contact</a>
          </div>
        </div>

        {/* 데스크톱 우측 */}
        <div className="nav-right nav-desktop">
          {authLoading ? (
            <div style={{ width: '160px', height: '36px' }} aria-hidden />
          ) : user ? (
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
                      내 강의실
                    </Link>
                    <Link to="/my?tab=payments" style={{ display: 'block', padding: '11px 16px', fontSize: '.875rem', transition: 'var(--t)' }}
                      onClick={() => setDropdownOpen(false)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      결제내역
                    </Link>
                    <Link to="/my?tab=inquiries" style={{ display: 'block', padding: '11px 16px', fontSize: '.875rem', transition: 'var(--t)' }}
                      onClick={() => setDropdownOpen(false)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      문의하기
                    </Link>
                    <div style={{ height: '1px', background: 'var(--line)', margin: '0 12px' }} />
                    {isAdminLoggedIn && (
                      <Link to="/admin2026" style={{ display: 'block', padding: '11px 16px', fontSize: '.875rem', transition: 'var(--t)', color: 'var(--gold)', fontWeight: 600 }}
                        onClick={() => setDropdownOpen(false)}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        관리자 페이지
                      </Link>
                    )}
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

        <button className={`hamburger ${mobileOpen ? 'is-open' : ''}`} onClick={() => setMobileOpen(p => !p)}>
          <span /><span /><span />
        </button>
      </nav>

      {/* 모바일 메뉴 */}
      <div className={`mobile-menu ${mobileOpen ? 'open' : ''}`}>
        {user && (
          <div className="mobile-profile">
            <div className="mobile-profile-avatar">{user.avatar}</div>
            <div>
              <div className="mobile-profile-name">{user.name}</div>
              <div className="mobile-profile-email">{user.email}</div>
            </div>
          </div>
        )}

        <div className="mobile-nav-section">
          <Link to="/" className={`mobile-nav-item ${path === '/' ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>Home</Link>
          <Link to="/courses" className={`mobile-nav-item ${isActive('/courses') ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>Course</Link>
          <Link to="/instructors" className={`mobile-nav-item ${isActive('/instructor') ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>Instructor</Link>
          <a href="#contact" className="mobile-nav-item" onClick={handleContact}>Contact</a>
        </div>

        {authLoading ? null : user ? (
          <>
            <div className="mobile-menu-divider" />
            <div className="mobile-nav-section">
              <Link to="/classroom" className="mobile-nav-item" onClick={() => setMobileOpen(false)}>내 강의실</Link>
              <Link to="/my?tab=payments" className="mobile-nav-item" onClick={() => setMobileOpen(false)}>결제/환불 내역</Link>
              <Link to="/my?tab=inquiries" className="mobile-nav-item" onClick={() => setMobileOpen(false)}>1:1 문의</Link>
            </div>
            <div className="mobile-menu-divider" />
            <div className="mobile-nav-section">
              {isAdminLoggedIn && (
                <Link to="/admin2026" className="mobile-nav-item" style={{ color: 'var(--gold)', fontWeight: 600 }} onClick={() => setMobileOpen(false)}>관리자 페이지</Link>
              )}
              <button className="mobile-nav-item" style={{ width: '100%', color: 'var(--t3)' }} onClick={handleLogout}>로그아웃</button>
            </div>
          </>
        ) : (
          <>
            <div className="mobile-menu-divider" />
            <div style={{ padding: '16px 16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button className="btn btn-primary w-full" style={{ padding: '13px', fontSize: '.9rem' }} onClick={() => { openAuth('signup'); setMobileOpen(false) }}>무료로 시작하기</button>
              <button className="btn btn-ghost w-full" style={{ padding: '13px', fontSize: '.9rem' }} onClick={() => { openAuth('login'); setMobileOpen(false) }}>이미 계정이 있으신가요? 로그인</button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
