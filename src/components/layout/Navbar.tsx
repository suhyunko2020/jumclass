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

  // lesson 페이지는 별도 레이아웃
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

  function handleLogout() {
    logout()
    setDropdownOpen(false)
    navigate('/')
  }

  return (
    <>
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <Link to="/" className="nav-logo">JUM<span className="dot">CLASS</span></Link>

        <div className="nav-center">
          <div className="nav-center-pill">
            <Link to="/" className={`nav-link ${isActive('/') && path === '/' ? 'active' : ''}`}>Home</Link>
            <Link to="/courses" className={`nav-link ${isActive('/courses') || isActive('/course') ? 'active' : ''}`}>Course</Link>
            <Link to="/#contact" className="nav-link">Contact Us</Link>
          </div>
        </div>

        <div className="nav-right">
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
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.05)'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                      }}>
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

        <button className="hamburger" onClick={() => setMobileOpen(p => !p)}>
          <span /><span /><span />
        </button>
      </nav>

      {/* Mobile Menu */}
      <div className={`mobile-menu ${mobileOpen ? 'open' : ''}`}>
        <Link to="/" className={`nav-link ${path === '/' ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>Home</Link>
        <Link to="/courses" className={`nav-link ${isActive('/courses') ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>Course</Link>
        <Link to="/#contact" className="nav-link" onClick={() => setMobileOpen(false)}>Contact Us</Link>
        {user ? (
          <>
            <Link to="/classroom" className="nav-link" onClick={() => setMobileOpen(false)}>📚 내 강의실</Link>
            <Link to="/my?tab=payments" className="nav-link" onClick={() => setMobileOpen(false)}>💳 결제내역</Link>
            <Link to="/my?tab=inquiries" className="nav-link" onClick={() => setMobileOpen(false)}>💬 문의하기</Link>
            <button className="nav-link" style={{ textAlign: 'left' }} onClick={() => { handleLogout(); setMobileOpen(false) }}>로그아웃</button>
          </>
        ) : (
          <div style={{ display: 'flex', gap: '8px', padding: '8px 14px' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { openAuth('login'); setMobileOpen(false) }}>로그인</button>
            <button className="btn btn-primary btn-sm" onClick={() => { openAuth('signup'); setMobileOpen(false) }}>무료 시작</button>
          </div>
        )}
      </div>
    </>
  )
}
