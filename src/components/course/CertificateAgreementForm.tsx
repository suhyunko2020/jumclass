import { useState, useEffect, useRef } from 'react'
import SignaturePad from './SignaturePad'
import { CERTIFICATE_AGREEMENT } from '../../data/certificateAgreement'

const OTP_TTL_MS = 5 * 60 * 1000  // 5분
const RESEND_COOLDOWN_SEC = 60
const MSG_AUTO_HIDE_MS = 3500     // 일반 메시지 자동 숨김 (만료 경고는 예외)

function formatMmSs(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export interface AgreementFormValue {
  name: string
  birthdate: string        // YYYY-MM-DD (내부 저장 포맷 유지)
  phone: string
  phoneVerified: boolean
  signatureDataUrl: string | null
}

interface Props {
  value: AgreementFormValue
  onChange: (v: AgreementFormValue) => void
}

type OtpPhase = 'idle' | 'sending' | 'sent' | 'verifying' | 'verified' | 'error'

export default function CertificateAgreementForm({ value, onChange }: Props) {
  const [agreementOpen, setAgreementOpen] = useState(false)
  const [otpPhase, setOtpPhase] = useState<OtpPhase>(value.phoneVerified ? 'verified' : 'idle')
  const [otpInput, setOtpInput] = useState('')
  const [otpMessage, setOtpMessage] = useState<string | null>(null)
  const [msgVisible, setMsgVisible] = useState(false)

  // 5분 만료 타이머
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null)
  // 60초 재전송 쿨다운
  const [resendSec, setResendSec] = useState(0)
  // 현재 시간 틱 — 두 타이머 공용
  const [nowMs, setNowMs] = useState(() => Date.now())

  const a = CERTIFICATE_AGREEMENT

  // 생년월일 분리 입력용 임시 상태 — value.birthdate에서 역산
  const [birthY, setBirthY] = useState('')
  const [birthM, setBirthM] = useState('')
  const [birthD, setBirthD] = useState('')
  const monthRef = useRef<HTMLInputElement>(null)
  const dayRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const m = value.birthdate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (m) {
      setBirthY(m[1]); setBirthM(m[2]); setBirthD(m[3])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function commitBirthdate(y: string, m: string, d: string) {
    setBirthY(y); setBirthM(m); setBirthD(d)
    // 모두 유효한 경우에만 저장 포맷 업데이트 (부분 입력 중에도 호출 가능)
    if (/^\d{4}$/.test(y) && /^\d{2}$/.test(m) && /^\d{2}$/.test(d)) {
      onChange({ ...value, birthdate: `${y}-${m}-${d}` })
    } else if (!y && !m && !d) {
      onChange({ ...value, birthdate: '' })
    }
  }

  // 공통 시계 — 만료/쿨다운 중일 때만 1초 간격 틱
  useEffect(() => {
    const active = expiresAtMs !== null || resendSec > 0
    if (!active) return
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [expiresAtMs, resendSec])

  // 쿨다운 감소 — resendSec은 1초마다 -1, setTimeout 체인으로 안정적 관리
  useEffect(() => {
    if (resendSec <= 0) return
    const t = setTimeout(() => setResendSec(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendSec])

  // 메시지 자동 숨김 — 만료 경고(phase=sent & hasExpired) 제외하고 N초 후 opacity 0
  useEffect(() => {
    if (!otpMessage) { setMsgVisible(false); return }
    setMsgVisible(true)
    const t = setTimeout(() => setMsgVisible(false), MSG_AUTO_HIDE_MS)
    return () => clearTimeout(t)
  }, [otpMessage])

  const secondsLeft = expiresAtMs === null ? 0 : Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000))
  const hasExpired = expiresAtMs !== null && secondsLeft === 0 && otpPhase !== 'verified'

  function handlePhoneChange(newPhone: string) {
    if (value.phoneVerified && newPhone !== value.phone) {
      setOtpPhase('idle')
      setOtpInput('')
      setOtpMessage(null)
      setExpiresAtMs(null)
      onChange({ ...value, phone: newPhone, phoneVerified: false })
    } else {
      onChange({ ...value, phone: newPhone })
    }
  }

  async function handleSendOtp() {
    if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(value.phone.replace(/\s/g, ''))) {
      setOtpMessage('올바른 휴대폰 번호를 입력해주세요. (예: 010-1234-5678)')
      setOtpPhase('error')
      return
    }
    setOtpInput('')
    setExpiresAtMs(null)
    setOtpPhase('sending')
    setOtpMessage(null)
    try {
      const res = await fetch('/api/sms-otp-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: value.phone }),
      })
      // 서버 응답이 JSON이 아닐 수도 있음 (Vercel 함수 오류 페이지 등) — 원문까지 로깅
      const raw = await res.text()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = {}
      try { data = raw ? JSON.parse(raw) : {} } catch { data = {} }
      if (!res.ok || !data.ok) {
        console.warn('[otp-send-fail]', { status: res.status, data, raw: raw.slice(0, 200) })
        setOtpPhase('error')
        const base = data.message || '인증번호 전송에 실패했습니다.'
        const codeHint = data.code ? ` [${data.code}]` : ''
        const statusHint = res.status !== 200 ? ` (HTTP ${res.status})` : ''
        setOtpMessage(base + codeHint + statusHint)
        return
      }
      setOtpPhase('sent')
      setExpiresAtMs(Date.now() + OTP_TTL_MS)
      setNowMs(Date.now())
      const devHint = data.devCode ? ` (테스트 모드: ${data.devCode})` : ''
      setOtpMessage(`인증번호를 발송했습니다.${devHint}`)
      setResendSec(RESEND_COOLDOWN_SEC)
    } catch (err) {
      setOtpPhase('error')
      setOtpMessage(err instanceof Error ? err.message : '네트워크 오류가 발생했습니다.')
    }
  }

  async function handleVerifyOtp() {
    if (!/^\d{6}$/.test(otpInput)) {
      setOtpMessage('6자리 숫자를 입력해주세요.')
      return
    }
    setOtpPhase('verifying')
    setOtpMessage(null)
    try {
      const res = await fetch('/api/sms-otp-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: value.phone, code: otpInput }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setOtpPhase('sent')
        setOtpMessage(data.message || '인증번호가 일치하지 않습니다.')
        if (data.code === 'EXPIRED') {
          setExpiresAtMs(Date.now() - 1)  // 클라이언트 타이머도 즉시 만료 상태로
        }
        return
      }
      setOtpPhase('verified')
      setOtpMessage('✓ 본인 인증이 완료되었습니다.')
      setExpiresAtMs(null)
      onChange({ ...value, phoneVerified: true })
    } catch (err) {
      setOtpPhase('sent')
      setOtpMessage(err instanceof Error ? err.message : '네트워크 오류가 발생했습니다.')
    }
  }

  const isVerified = otpPhase === 'verified' && value.phoneVerified
  const inputLocked = isVerified

  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: 'var(--r2)',
      background: 'rgba(6,7,15,.6)',
      border: '1px solid rgba(255,255,255,.06)',
    }}>
      <div style={{ fontSize: '.88rem', fontWeight: 700, color: 'var(--t1)', marginBottom: '4px' }}>
        자격증 수강 동의서 서명
      </div>
      <div style={{ fontSize: '.74rem', color: 'var(--t3)', marginBottom: '12px' }}>
        민간자격 취득을 위한 교육훈련·자격검정 계약 체결을 위해 아래 정보와 서명이 필요합니다.
      </div>

      {/* 약관 본문 (토글) */}
      <div style={{
        background: 'rgba(0,0,0,.28)',
        border: '1px solid rgba(255,255,255,.06)',
        borderRadius: 'var(--r2)',
        marginBottom: '14px',
        overflow: 'hidden',
      }}>
        <button
          type="button"
          onClick={() => setAgreementOpen(o => !o)}
          style={{
            width: '100%', padding: '10px 12px', textAlign: 'left',
            background: 'transparent', border: 'none', color: 'var(--t1)',
            fontSize: '.82rem', fontWeight: 600, cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>민간자격 약관 (버전 {a.version})</span>
          <span style={{ fontSize: '.72rem', color: 'var(--t3)', flexShrink: 0, marginLeft: '8px' }}>
            {agreementOpen ? '접기 ▲' : '본문 보기 ▼'}
          </span>
        </button>
        {agreementOpen && (
          <div style={{
            maxHeight: '320px', overflowY: 'auto',
            padding: '12px 14px',
            borderTop: '1px solid rgba(255,255,255,.06)',
            fontSize: '.78rem', color: 'var(--t2)', lineHeight: 1.7,
          }}>
            <p style={{ marginBottom: '12px' }}>{a.preamble}</p>
            {a.chapters.map((ch, ci) => (
              <div key={ci} style={{ marginBottom: '14px' }}>
                <div style={{ fontWeight: 700, color: 'var(--t1)', margin: '10px 0 6px' }}>
                  {ch.title}
                </div>
                {ch.articles.map((art, ai) => (
                  <div key={ai} style={{ marginBottom: '10px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--t1)', marginBottom: '3px' }}>
                      {art.number} [{art.subject}]
                    </div>
                    {art.paragraphs.map((p, pi) => (
                      <p key={pi} style={{ whiteSpace: 'pre-wrap', margin: '2px 0' }}>{p}</p>
                    ))}
                  </div>
                ))}
              </div>
            ))}
            {a.closing.map((c, i) => (
              <p key={i} style={{ margin: '8px 0' }}>{c}</p>
            ))}
          </div>
        )}
      </div>

      {/* 입력 필드 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '.74rem', color: 'var(--t3)', marginBottom: '4px' }}>
            성명 <span style={{ color: 'var(--fail)' }}>*</span>
          </label>
          <input
            type="text"
            value={value.name}
            onChange={e => onChange({ ...value, name: e.target.value })}
            placeholder="실명 입력"
            style={{
              width: '100%', padding: '10px 12px',
              background: 'rgba(6,7,15,.4)', border: '1px solid var(--line)',
              borderRadius: 'var(--r2)', color: 'var(--t1)', fontSize: '.88rem',
              outline: 'none',
            }}
          />
        </div>

        {/* 생년월일 — YYYY / MM / DD 3분할 (연도 4자리 제한 + 자동 포커스 이동) */}
        <div>
          <label style={{ display: 'block', fontSize: '.74rem', color: 'var(--t3)', marginBottom: '4px' }}>
            생년월일 <span style={{ color: 'var(--fail)' }}>*</span>
          </label>
          <div style={{
            display: 'flex', gap: '6px', alignItems: 'center',
            maxWidth: '320px',  // 데스크톱에서 과도한 가로 확장 방지
          }}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={birthY}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                commitBirthdate(v, birthM, birthD)
                if (v.length === 4) monthRef.current?.focus()
              }}
              placeholder="YYYY"
              style={{
                flex: '1.6 1 0', minWidth: 0, padding: '10px 8px', textAlign: 'center',
                background: 'rgba(6,7,15,.4)', border: '1px solid var(--line)',
                borderRadius: 'var(--r2)', color: 'var(--t1)', fontSize: '.88rem',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            <span style={{ color: 'var(--t3)', fontSize: '.8rem', flexShrink: 0 }}>/</span>
            <input
              ref={monthRef}
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={birthM}
              onChange={e => {
                let v = e.target.value.replace(/\D/g, '').slice(0, 2)
                // 부분 보정: 월 2~9 첫자리 → 02, 03.. 자동 보정
                if (v.length === 1 && Number(v) > 1) v = '0' + v
                commitBirthdate(birthY, v, birthD)
                if (v.length === 2) dayRef.current?.focus()
              }}
              placeholder="MM"
              style={{
                flex: '1 1 0', minWidth: 0, padding: '10px 8px', textAlign: 'center',
                background: 'rgba(6,7,15,.4)', border: '1px solid var(--line)',
                borderRadius: 'var(--r2)', color: 'var(--t1)', fontSize: '.88rem',
                outline: 'none',
              }}
            />
            <span style={{ color: 'var(--t3)', fontSize: '.8rem', flexShrink: 0 }}>/</span>
            <input
              ref={dayRef}
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={birthD}
              onChange={e => {
                let v = e.target.value.replace(/\D/g, '').slice(0, 2)
                if (v.length === 1 && Number(v) > 3) v = '0' + v
                commitBirthdate(birthY, birthM, v)
              }}
              placeholder="DD"
              style={{
                flex: '1 1 0', minWidth: 0, padding: '10px 8px', textAlign: 'center',
                background: 'rgba(6,7,15,.4)', border: '1px solid var(--line)',
                borderRadius: 'var(--r2)', color: 'var(--t1)', fontSize: '.88rem',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* 휴대폰 + 인증번호 */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.74rem', color: 'var(--t3)', marginBottom: '4px' }}>
            <span>연락처 <span style={{ color: 'var(--fail)' }}>*</span></span>
            {isVerified && (
              <span style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--ok)', padding: '2px 8px', background: 'rgba(52,211,153,.14)', border: '1px solid rgba(52,211,153,.35)', borderRadius: '999px' }}>
                ✓ 인증 완료
              </span>
            )}
            {/* 만료 타이머 — 라벨 우측에 인라인으로 표시 (깔끔한 위치) */}
            {expiresAtMs !== null && !hasExpired && !isVerified && (
              <span style={{
                marginLeft: 'auto', fontSize: '.72rem', fontFamily: 'monospace', fontWeight: 700,
                color: secondsLeft <= 30 ? 'var(--warn, #e89c38)' : 'var(--purple-2)',
              }}>
                ⏱ {formatMmSs(secondsLeft)}
              </span>
            )}
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="tel"
              value={value.phone}
              onChange={e => handlePhoneChange(e.target.value)}
              placeholder="010-0000-0000"
              disabled={inputLocked}
              style={{
                flex: 1, padding: '10px 12px',
                background: inputLocked ? 'rgba(52,211,153,.06)' : 'rgba(6,7,15,.4)',
                border: `1px solid ${inputLocked ? 'rgba(52,211,153,.35)' : 'var(--line)'}`,
                borderRadius: 'var(--r2)', color: 'var(--t1)', fontSize: '.88rem',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={otpPhase === 'sending' || isVerified || resendSec > 0 || !value.phone}
              style={{
                padding: '10px 14px', fontSize: '.78rem', fontWeight: 700,
                background: isVerified ? 'rgba(52,211,153,.14)' : 'rgba(124,111,205,.16)',
                border: `1px solid ${isVerified ? 'rgba(52,211,153,.35)' : 'rgba(124,111,205,.35)'}`,
                color: isVerified ? 'var(--ok)' : 'var(--purple-2)',
                borderRadius: 'var(--r2)', cursor: isVerified ? 'default' : 'pointer',
                flexShrink: 0, minWidth: '120px',
                opacity: (otpPhase === 'sending' || resendSec > 0) ? 0.6 : 1,
                transition: 'opacity .2s',
              }}
            >
              {isVerified ? '인증 완료'
                : otpPhase === 'sending' ? '전송 중…'
                : resendSec > 0 ? (
                  <span>
                    <span style={{ fontFamily: 'monospace', fontSize: '.9rem' }}>{resendSec}</span>
                    <span style={{ fontSize: '.72rem' }}>초 후 재전송</span>
                  </span>
                )
                : (otpPhase === 'sent' || otpPhase === 'error') ? '다시 전송'
                : '인증번호 받기'}
            </button>
          </div>

          {/* 인증번호 입력창 — 전송 후 표시 */}
          {(otpPhase === 'sent' || otpPhase === 'verifying' || otpPhase === 'error') && !isVerified && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpInput}
                onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="6자리 인증번호"
                disabled={hasExpired}
                style={{
                  flex: 1, padding: '10px 12px',
                  background: 'rgba(6,7,15,.4)', border: '1px solid var(--line)',
                  borderRadius: 'var(--r2)', color: 'var(--t1)', fontSize: '.95rem',
                  outline: 'none',
                  opacity: hasExpired ? 0.5 : 1,
                }}
              />
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={otpPhase === 'verifying' || otpInput.length !== 6 || hasExpired}
                style={{
                  padding: '10px 18px', fontSize: '.82rem', fontWeight: 700,
                  background: 'var(--purple)',
                  border: '1px solid var(--purple-sat)',
                  color: 'white', borderRadius: 'var(--r2)',
                  cursor: (otpInput.length === 6 && !hasExpired) ? 'pointer' : 'not-allowed',
                  flexShrink: 0, opacity: (otpPhase === 'verifying' || hasExpired) ? 0.6 : 1,
                }}
              >
                {otpPhase === 'verifying' ? '확인 중…' : '확인'}
              </button>
            </div>
          )}

          {/* 만료 경고 — 강조 박스 (fade 대상 아님) */}
          {hasExpired && (
            <div style={{
              marginTop: '10px',
              padding: '12px 14px',
              background: 'rgba(224,82,82,.08)',
              border: '1px solid rgba(224,82,82,.4)',
              borderRadius: 'var(--r2)',
              fontSize: '.85rem',
              color: 'var(--fail)',
              fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <span style={{ fontSize: '1.1rem' }}>⚠️</span>
              <span>인증번호가 만료되었습니다. <strong>다시 전송</strong>을 눌러주세요.</span>
            </div>
          )}

          {/* 일반 메시지 — 3.5초 후 서서히 사라짐 */}
          {otpMessage && !hasExpired && (
            <div style={{
              marginTop: '6px', fontSize: '.78rem',
              color: otpPhase === 'verified' ? 'var(--ok)'
                : (otpPhase === 'error' || otpPhase === 'sent') ? 'var(--fail)'
                : 'var(--t3)',
              opacity: msgVisible ? 1 : 0,
              transition: 'opacity .6s ease',
              pointerEvents: msgVisible ? 'auto' : 'none',
            }}>
              {otpMessage}
            </div>
          )}
        </div>
      </div>

      {/* 서명 */}
      <div>
        <label style={{ display: 'block', fontSize: '.74rem', color: 'var(--t3)', marginBottom: '6px' }}>
          서명 <span style={{ color: 'var(--fail)' }}>*</span>
        </label>
        <SignaturePad
          onChange={dataUrl => onChange({ ...value, signatureDataUrl: dataUrl })}
        />
      </div>

      <div style={{
        marginTop: '14px', padding: '10px 12px',
        background: 'rgba(232,156,56,.06)', border: '1px solid rgba(232,156,56,.2)',
        borderRadius: 'var(--r2)', fontSize: '.74rem', color: 'var(--t2)', lineHeight: 1.6,
      }}>
        서명을 완료하면 위 약관 전문에 동의한 것으로 간주되며,
        서명 이미지와 약관 본문이 함께 보관되어 추후 분쟁 시 증빙 자료로 활용될 수 있습니다.
      </div>
    </div>
  )
}
