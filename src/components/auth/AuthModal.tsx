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

// eslint-disable-next-line react-refresh/only-export-components
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
  const { login, signup } = useAuth()
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'auth' | 'reset'>('auth')  // 비밀번호 재설정 화면 전환

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '', phone: '' })
  // 회원가입 휴대폰 인증 상태
  const [signupOtp, setSignupOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpErr, setOtpErr] = useState('')

  // 비밀번호 재설정 상태
  const [resetStep, setResetStep] = useState<'request' | 'confirm' | 'done'>('request')
  const [resetEmail, setResetEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [resetPw, setResetPw] = useState('')
  const [resetPw2, setResetPw2] = useState('')
  const [resetMsg, setResetMsg] = useState('')

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
    if (!phoneVerified) { setErr('휴대폰 인증을 완료해주세요.'); return }
    setErr(''); setLoading(true)
    const error = await signup(signupForm.name, signupForm.email, signupForm.password, signupForm.phone)
    if (error) { setLoading(false); setErr(error); return }
    // 휴대폰 인증으로 본인확인 완료 → 가입 직후 자동 로그인
    await login(signupForm.email, signupForm.password)
    setLoading(false)
    onClose()
  }

  // 회원가입 휴대폰 인증번호 발송/검증 (기존 SMS OTP API 재사용)
  async function sendSignupOtp() {
    setOtpErr(''); setOtpLoading(true)
    try {
      const res = await fetch('/api/sms-otp-send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: signupForm.phone, purpose: 'signup' }),
      })
      const data = await res.json().catch(() => ({}))
      setOtpLoading(false)
      if (!res.ok || !data.ok) { setOtpErr(data.message || '인증번호 발송에 실패했습니다.'); return }
      setOtpSent(true)
    } catch { setOtpLoading(false); setOtpErr('네트워크 오류가 발생했습니다.') }
  }
  async function verifySignupOtp() {
    setOtpErr(''); setOtpLoading(true)
    try {
      const res = await fetch('/api/sms-otp-verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: signupForm.phone, code: signupOtp }),
      })
      const data = await res.json().catch(() => ({}))
      setOtpLoading(false)
      if (!res.ok || !data.ok) { setOtpErr(data.message || '인증번호가 일치하지 않습니다.'); return }
      setPhoneVerified(true)
    } catch { setOtpLoading(false); setOtpErr('네트워크 오류가 발생했습니다.') }
  }


  // ── 비밀번호 재설정 핸들러 ────────────────────────────────
  async function handleResetRequest(e?: React.FormEvent) {
    e?.preventDefault()
    setErr(''); setResetMsg(''); setLoading(true)
    try {
      const res = await fetch('/api/email-otp-send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      })
      const data = await res.json().catch(() => ({}))
      setLoading(false)
      if (!res.ok || !data.ok) { setErr(data.message || '인증번호 발송에 실패했습니다.'); return }
      setResetStep('confirm')
      setResetMsg('가입된 이메일이라면 인증번호가 발송됩니다. 메일함(스팸함 포함)을 확인해주세요.')
    } catch {
      setLoading(false); setErr('네트워크 오류가 발생했습니다.')
    }
  }

  async function handleResetConfirm(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (resetPw !== resetPw2) { setErr('새 비밀번호가 일치하지 않습니다.'); return }
    if (resetPw.length < 6) { setErr('비밀번호는 6자 이상이어야 합니다.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, code: resetCode, newPassword: resetPw }),
      })
      const data = await res.json().catch(() => ({}))
      setLoading(false)
      if (!res.ok || !data.ok) { setErr(data.message || '비밀번호 변경에 실패했습니다.'); return }
      setResetStep('done')
    } catch {
      setLoading(false); setErr('네트워크 오류가 발생했습니다.')
    }
  }

  function backToLogin() {
    setView('auth'); setTab('login')
    setResetStep('request'); setResetCode(''); setResetPw(''); setResetPw2(''); setResetMsg(''); setErr('')
  }

  // ── 비밀번호 재설정 화면 ──────────────────────────────────
  if (view === 'reset') {
    return (
      <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="modal-box" style={{ position: 'relative' }}>
          <button className="modal-close" onClick={onClose}>✕</button>
          <div className="modal-head">
            <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>🔑</div>
            <h2>비밀번호 재설정</h2>
            <p>{resetStep === 'done' ? '비밀번호가 변경되었습니다' : '가입한 이메일로 인증번호를 받아 재설정하세요'}</p>
          </div>
          <div className="modal-body">
            {err && <div className="err-msg">{err}</div>}
            {resetMsg && resetStep !== 'done' && (
              <div style={{ fontSize: '.82rem', color: 'var(--purple-2)', background: 'rgba(124,111,205,.08)', borderRadius: 'var(--r2)', padding: '10px 12px', marginBottom: '14px', lineHeight: 1.5 }}>
                {resetMsg}
              </div>
            )}

            {resetStep === 'done' ? (
              <>
                <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
                  <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>✅</div>
                  <p style={{ color: 'var(--t2)', lineHeight: 1.6 }}>새 비밀번호로 로그인해주세요.</p>
                </div>
                <button className="btn btn-primary w-full" onClick={() => { setLoginForm({ email: resetEmail, password: '' }); backToLogin() }}>
                  로그인하러 가기 →
                </button>
              </>
            ) : resetStep === 'request' ? (
              <form onSubmit={handleResetRequest}>
                <div className="form-group">
                  <label className="form-label" htmlFor="reset-email">가입 이메일</label>
                  <input className="form-input" id="reset-email" type="email" placeholder="이메일 주소" required
                    value={resetEmail} onChange={e => setResetEmail(e.target.value)} />
                </div>
                <button className="btn btn-primary w-full" type="submit" disabled={loading}>
                  {loading ? '발송 중…' : '인증번호 받기'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetConfirm}>
                <div className="form-group">
                  <label className="form-label" htmlFor="reset-code">인증번호</label>
                  <input className="form-input" id="reset-code" inputMode="numeric" maxLength={6} placeholder="메일로 받은 6자리" required
                    value={resetCode} onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="reset-pw">새 비밀번호</label>
                  <input className="form-input" id="reset-pw" type="password" placeholder="새 비밀번호 (6자 이상)" required minLength={6}
                    value={resetPw} onChange={e => setResetPw(e.target.value)} autoComplete="new-password" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="reset-pw2">새 비밀번호 확인</label>
                  <input className="form-input" id="reset-pw2" type="password" placeholder="새 비밀번호 확인" required minLength={6}
                    value={resetPw2} onChange={e => setResetPw2(e.target.value)} autoComplete="new-password" />
                </div>
                <button className="btn btn-primary w-full" type="submit" disabled={loading}>
                  {loading ? '변경 중…' : '비밀번호 변경'}
                </button>
                <button type="button" className="btn btn-ghost w-full" style={{ marginTop: '8px' }} disabled={loading}
                  onClick={() => handleResetRequest()}>
                  인증번호 재발송
                </button>
              </form>
            )}

            <button type="button" onClick={backToLogin}
              style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 'none', color: 'var(--t3)', fontSize: '.82rem', cursor: 'pointer' }}>
              ← 로그인으로 돌아가기
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
              <button type="button"
                onClick={() => { setView('reset'); setErr(''); setResetEmail(loginForm.email) }}
                style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: 'var(--t3)', fontSize: '.82rem', cursor: 'pointer', textDecoration: 'underline' }}>
                비밀번호를 잊으셨나요?
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

              {/* 휴대폰 인증 */}
              <div className="form-group">
                <label className="form-label" htmlFor="signup-phone">휴대폰 번호</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="form-input" id="signup-phone" type="tel" placeholder="01000000000" required
                    value={signupForm.phone} disabled={phoneVerified}
                    onChange={e => setSignupForm(p => ({ ...p, phone: e.target.value.replace(/[^0-9]/g, '') }))} />
                  <button type="button" className="btn btn-ghost btn-sm" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    disabled={otpLoading || phoneVerified || !signupForm.phone}
                    onClick={sendSignupOtp}>
                    {phoneVerified ? '인증완료' : otpSent ? '재발송' : '인증번호'}
                  </button>
                </div>
              </div>
              {otpSent && !phoneVerified && (
                <div className="form-group">
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input className="form-input" inputMode="numeric" maxLength={6} placeholder="인증번호 6자리"
                      value={signupOtp} onChange={e => setSignupOtp(e.target.value.replace(/\D/g, ''))} />
                    <button type="button" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                      disabled={otpLoading || signupOtp.length !== 6} onClick={verifySignupOtp}>확인</button>
                  </div>
                </div>
              )}
              {phoneVerified && <div style={{ fontSize: '.78rem', color: 'var(--ok)', marginBottom: '10px' }}>✓ 휴대폰 인증 완료</div>}
              {otpErr && <div style={{ fontSize: '.78rem', color: 'var(--fail)', marginBottom: '10px' }}>{otpErr}</div>}

              <button className="btn btn-primary w-full" type="submit" disabled={loading || !phoneVerified}>
                {loading ? '처리 중…' : '무료 회원가입'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
