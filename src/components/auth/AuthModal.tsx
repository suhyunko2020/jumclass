import {
  useState, createContext, useContext, useCallback, type ReactNode
} from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../ui/Toast'

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
  const toast = useToast()
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '' })

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setLoading(true)
    const ok = await login(loginForm.email, loginForm.password)
    setLoading(false)
    if (!ok) { setErr('이메일 또는 비밀번호가 올바르지 않습니다.'); return }
    toast('환영합니다! ✦', 'ok')
    onClose()
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setLoading(true)
    const ok = await signup(signupForm.name, signupForm.email, signupForm.password)
    setLoading(false)
    if (!ok) { setErr('이미 사용 중인 이메일이거나 가입에 실패했습니다.'); return }
    toast('가입 완료! 이메일 인증 후 로그인해주세요 ✦', 'ok')
    setTab('login')
  }

  async function handleGoogle() {
    await loginWithGoogle()
    onClose()
  }

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
            <button className={`modal-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setErr('') }}>로그인</button>
            <button className={`modal-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => { setTab('signup'); setErr('') }}>회원가입</button>
          </div>

          {err && <div className="err-msg">{err}</div>}

          {tab === 'login' ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">이메일</label>
                <input className="form-input" type="email" placeholder="이메일 주소" required
                  value={loginForm.email} onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">비밀번호</label>
                <input className="form-input" type="password" placeholder="비밀번호" required
                  value={loginForm.password} onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))} />
              </div>
              <button className="btn btn-primary w-full" type="submit" disabled={loading}>
                {loading ? '로그인 중…' : '로그인'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup}>
              <div className="form-group">
                <label className="form-label">이름</label>
                <input className="form-input" type="text" placeholder="이름" required
                  value={signupForm.name} onChange={e => setSignupForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">이메일</label>
                <input className="form-input" type="email" placeholder="이메일 주소" required
                  value={signupForm.email} onChange={e => setSignupForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">비밀번호</label>
                <input className="form-input" type="password" placeholder="비밀번호 (6자 이상)" required minLength={6}
                  value={signupForm.password} onChange={e => setSignupForm(p => ({ ...p, password: e.target.value }))} />
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
