import { useEffect, useState } from 'react'

// 오픈 전 공사중 화면 — 비밀번호를 입력하기 전까지 모든 방문자에게 표시된다.
// 우하단 자물쇠 아이콘을 눌러 비밀번호를 입력하면 onUnlock으로 해제 시도한다.
export default function ComingSoonPage({
  remainingMs,
  onUnlock,
}: {
  remainingMs: number
  onUnlock: (pw: string) => Promise<boolean>
}) {
  const [showInput, setShowInput] = useState(false)
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => { document.title = '오픈 준비 중 — JUMCLASS' }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(false); setLoading(true)
    const ok = await onUnlock(pw)
    setLoading(false)
    if (!ok) { setErr(true); setPw('') }
  }

  const total = Math.max(0, remainingMs)
  const days = Math.floor(total / 86400000)
  const hours = Math.floor((total % 86400000) / 3600000)
  const mins = Math.floor((total % 3600000) / 60000)
  const secs = Math.floor((total % 60000) / 1000)
  const units = [
    { label: 'DAYS', value: days },
    { label: 'HOURS', value: hours },
    { label: 'MINUTES', value: mins },
    { label: 'SECONDS', value: secs },
  ]

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px', textAlign: 'center', position: 'relative',
      background: 'var(--bg)',
    }}>
      <div className="page-bg" />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '620px', width: '100%' }}>
        <div style={{ fontSize: '2.2rem', marginBottom: '14px' }}>🔮</div>
        <div style={{
          fontWeight: 900, fontSize: 'clamp(1.9rem, 6vw, 3rem)', letterSpacing: '-.04em',
          marginBottom: '14px', color: 'var(--t1)',
        }}>
          JUM<span style={{ color: 'var(--purple-2)' }}>CLASS</span>
        </div>

        <h1 style={{ fontSize: 'clamp(1.05rem, 3.2vw, 1.45rem)', fontWeight: 700, marginBottom: '12px', color: 'var(--t1)' }}>
          사이트를 리뉴얼 중에 있습니다.
        </h1>
        <p style={{ color: 'var(--t2)', lineHeight: 1.75, marginBottom: '40px', fontSize: '.95rem' }}>
          더 나은 모습으로 준비하고 있습니다.<br />
          <strong style={{ color: 'var(--t1)' }}>2026년 6월 19일 오후 2시</strong>에 만나요.
        </p>

        {/* 카운트다운 */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
          {units.map(u => (
            <div key={u.label} style={{
              minWidth: '76px', padding: '18px 12px', borderRadius: 'var(--r3)',
              background: 'var(--glass-1)', border: '1px solid var(--line)',
            }}>
              <div style={{
                fontSize: 'clamp(1.7rem, 5vw, 2.3rem)', fontWeight: 800,
                color: 'var(--purple-2)', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
              }}>
                {String(u.value).padStart(2, '0')}
              </div>
              <div style={{ fontSize: '.6rem', fontWeight: 600, letterSpacing: '.12em', color: 'var(--t3)', marginTop: '9px' }}>{u.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 관리자 진입 — 눈에 띄지 않는 우하단 자물쇠 아이콘 (클릭 시 비밀번호 입력) */}
      <button
        type="button"
        onClick={() => { setShowInput(v => !v); setErr(false) }}
        aria-label="사이트 잠금 해제"
        title=""
        style={{
          position: 'fixed', bottom: '18px', right: '18px',
          width: '34px', height: '34px', borderRadius: '50%',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--t3)', opacity: showInput ? 0.5 : 0.1, transition: 'opacity .25s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3,
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.55' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = showInput ? '0.5' : '0.1' }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </button>

      {/* 비밀번호 입력 — 자물쇠 클릭 시에만 노출 */}
      {showInput && (
        <form onSubmit={submit} style={{
          position: 'fixed', bottom: '60px', right: '18px', zIndex: 3,
          display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end',
        }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="password" autoFocus placeholder="비밀번호" value={pw}
              onChange={e => { setPw(e.target.value); setErr(false) }}
              disabled={loading}
              style={{
                padding: '9px 11px', borderRadius: 'var(--r2)', width: '150px',
                border: `1px solid ${err ? 'var(--fail)' : 'var(--line-2)'}`,
                background: 'var(--bg-3)', color: 'var(--t1)', fontSize: '.85rem',
              }}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>{loading ? '확인 중' : '확인'}</button>
          </div>
          {err && <div style={{ fontSize: '.72rem', color: 'var(--fail)' }}>비밀번호가 올바르지 않습니다.</div>}
        </form>
      )}
    </div>
  )
}
