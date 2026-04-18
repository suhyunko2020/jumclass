import {
  useState, createContext, useContext, useCallback, type ReactNode
} from 'react'
import { useAuth } from '../../hooks/useAuth'

/* ── Context ── */
interface AuthModalContextType {
  openAuth: (tab?: 'login' | 'signup') => void
  closeAuth: () => void
}

const AuthModalContext = createContext<AuthModalContextType | null>(null)

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'login' | 'signup'>('login')

  const openAuth = useCallback((t: 'login' | 'signup' = 'login') => {
    setTab(t); setOpen(true)
  }, [])

  const closeAuth = useCallback(() => setOpen(false), [])

  return (
    <AuthModalContext.Provider value={{ openAuth, closeAuth }}>
      {children}
      {open && <AuthModal tab={tab} setTab={setTab} onClose={closeAuth} />}
    </AuthModalContext.Provider>
  )
}

export const useAuthModal = () => {
  const ctx = useContext(AuthModalContext)
  if (!ctx) throw new Error('useAuthModal must be inside AuthModalProvider')
  return ctx
}

/* ── Modal Component ── */
interface Props {
  tab: 'login' | 'signup'
  setTab: (t: 'login' | 'signup') => void
  onClose: () => void
}

function AuthModal({ tab, setTab, onClose }: Props) {
  const { login, signup, loginWithGoogle } = useAuth()
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifyEmail, setVerifyEmail] = useState('')  // 인증 대기 화면용 이메일

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '' })

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setLoading(true)
    const error = await login(loginForm.email, loginForm.password)
    setLoading(false)
    if (error) { setErr(error); return }
    onClose()
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setLoading(true)
    const error = await signup(signupForm.name, signupForm.email, signupForm.password)
    setLoading(false)
    if (error) { setErr(error); return }
    // 성공 → 이메일 인증 안내 화면으로 전환
    setVerifyEmail(signupForm.email)
  }

  async function handleGoogle() {
    await loginWithGoogle()
    onClose()
  }

  // ── 이메일 인증 안내 화면 ──────────────────────────────────
  if (verifyEmail) {
    return (
      <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="modal-box" style={{ position: 'relative' }}>
          <button className="modal-close" onClick={onClose}>✕</button>

          {/* 헤더 */}
          <div className="modal-head" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.4rem', marginBottom: '12px' }}>📬</div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>인증 메일을 발송했습니다</h2>
            <p style={{ marginTop: '8px', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--purple-2)' }}>{verifyEmail}</strong><br />
              위 주소로 인증 링크를 보냈습니다.
            </p>
          </div>

          <div className="modal-body">
            {/* 안내 단계 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {[
                '받은편지함을 열어주세요',
                'JUMCLASS 발신 메일을 확인해주세요',
                '메일 내 인증 링크를 클릭해주세요',
                '인증 완료 후 로그인해주세요',
              ].map((text, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--purple), var(--purple-sat))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '.75rem', fontWeight: 700,
                  }}>
                    {i + 1}
                  </div>
                  <span style={{ fontSize: '.875rem', color: 'var(--t2)' }}>{text}</span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: '.8rem', color: 'var(--t3)', textAlign: 'center', marginBottom: '20px' }}>
              메일이 보이지 않으면 스팸 폴더를 확인해주세요.
            </p>

            <button className="btn btn-primary w-full"
              onClick={() => { setVerifyEmail(''); setTab('login') }}>
              인증 완료 후 로그인하기 →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── 로그인 / 회원가입 화면 ────────────────────────────────
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ position: 'relative' }}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="modal-head">
          <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>🔮</div>
          <h2>{tab === 'login' ? '로그인' : '회원가입'}</h2>
          <p>{tab === 'login' ? 'JUMCLASS에 오신 것을 환영합니다' : '지금 무료로 시작하세요'}</p>
        </div>

        <div className="modal-body">
          <div className="modal-tabs">
            <button className={`modal-tab ${tab === 'login' ? 'active' : ''}`}
              onClick={() => { setTab('login'); setErr('') }}>로그인</button>
            <button className={`modal-tab ${tab === 'signup' ? 'active' : ''}`}
              onClick={() => { setTab('signup'); setErr('') }}>회원가입</button>
          </div>

          {err && <div className="err-msg">{err}</div>}

          {tab === 'login' ? (
            // autoComplete: 브라우저 비밀번호 매니저가 이메일을 username으로 정확히 인식하도록 명시
            <form onSubmit={handleLogin} autoComplete="on">
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">이메일</label>
                <input className="form-input" id="login-email" name="email" type="email"
                  placeholder="이메일 주소" required autoComplete="username"
                  value={loginForm.email}
                  onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="login-password">비밀번호</label>
                <input className="form-input" id="login-password" name="password" type="password"
                  placeholder="비밀번호" required autoComplete="current-password"
                  value={loginForm.password}
                  onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))} />
              </div>
              <button className="btn btn-primary w-full" type="submit" disabled={loading}>
                {loading ? '로그인 중…' : '로그인'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} autoComplete="on">
              <div className="form-group">
                <label className="form-label" htmlFor="signup-name">이름</label>
                {/* 이름은 username이 아님을 명시 — 비밀번호 매니저가 이메일을 우선 잡도록 */}
                <input className="form-input" id="signup-name" name="name" type="text"
                  placeholder="이름" required autoComplete="name"
                  value={signupForm.name}
                  onChange={e => setSignupForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="signup-email">이메일</label>
                <input className="form-input" id="signup-email" name="email" type="email"
                  placeholder="이메일 주소" required autoComplete="username"
                  value={signupForm.email}
                  onChange={e => setSignupForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="signup-password">비밀번호</label>
                <input className="form-input" id="signup-password" name="new-password" type="password"
                  placeholder="비밀번호 (6자 이상)" required minLength={6} autoComplete="new-password"
                  value={signupForm.password}
                  onChange={e => setSignupForm(p => ({ ...p, password: e.target.value }))} />
              </div>
              <button className="btn btn-primary w-full" type="submit" disabled={loading}>
                {loading ? '처리 중…' : '무료 회원가입'}
              </button>
            </form>
          )}

          <div className="modal-divider">또는</div>

          <button className="btn btn-ghost w-full" onClick={handleGoogle}>
            <span>G</span> Google로 계속하기
          </button>
        </div>
      </div>
    </div>
  )
}
