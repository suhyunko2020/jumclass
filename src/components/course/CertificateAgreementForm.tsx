import { useState, useEffect } from 'react'
import SignaturePad from './SignaturePad'
import { CERTIFICATE_AGREEMENT } from '../../data/certificateAgreement'

const OTP_TTL_MS = 5 * 60 * 1000  // 5분

function formatMmSs(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export interface AgreementFormValue {
  name: string
  birthdate: string        // YYYY-MM-DD
  phone: string
  phoneVerified: boolean   // 인증번호 확인 완료 여부
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
  const [resendSec, setResendSec] = useState(0)
  // 5분 카운트다운 — OTP 만료 시점(Unix ms)과 현재 시각 틱
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const a = CERTIFICATE_AGREEMENT

  // 만료 시점이 잡힌 동안 1초마다 현재 시각 갱신 (리렌더로 카운트다운 표시)
  useEffect(() => {
    if (expiresAtMs === null) return
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [expiresAtMs])

  const secondsLeft = expiresAtMs === null ? 0 : Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000))
  const hasExpired = expiresAtMs !== null && secondsLeft === 0 && otpPhase !== 'verified'

  // 전화번호 입력이 바뀌면 이전 인증 상태 리셋 (동일 번호 다시 입력해도 검증 필요)
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
    // 재전송 시 이전 입력/상태 초기화
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
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setOtpPhase('error')
        setOtpMessage(data.message || '인증번호 전송에 실패했습니다.')
        return
      }
      setOtpPhase('sent')
      setExpiresAtMs(Date.now() + OTP_TTL_MS)
      setNowMs(Date.now())
      const devHint = data.devCode ? ` (테스트 모드: ${data.devCode})` : ''
      setOtpMessage(`인증번호를 발송했습니다.${devHint}`)
      // 재전송 쿨다운 60초
      setResendSec(60)
      const timer = setInterval(() => {
        setResendSec(s => {
          if (s <= 1) { clearInterval(timer); return 0 }
          return s - 1
        })
      }, 1000)
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
        setOtpPhase('sent')  // 다시 시도 가능하도록 sent 상태 유지
        setOtpMessage(data.message || '인증번호가 일치하지 않습니다.')
        // 서버에서 EXPIRED 반환 시 클라이언트 타이머도 만료 상태로 맞춤
        if (data.code === 'EXPIRED') {
          setExpiresAtMs(Date.now() - 1)
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
        <div>
          <label style={{ display: 'block', fontSize: '.74rem', color: 'var(--t3)', marginBottom: '4px' }}>
            생년월일 <span style={{ color: 'var(--fail)' }}>*</span>
          </label>
          <input
            type="date"
            value={value.birthdate}
            onChange={e => onChange({ ...value, birthdate: e.target.value })}
            style={{
              width: '100%', padding: '10px 12px',
              background: 'rgba(6,7,15,.4)', border: '1px solid var(--line)',
              borderRadius: 'var(--r2)', color: 'var(--t1)', fontSize: '.88rem',
              outline: 'none',
              colorScheme: 'dark',
            }}
          />
        </div>

        {/* 휴대폰 + 인증번호 */}
        <div>
          <label style={{ display: 'block', fontSize: '.74rem', color: 'var(--t3)', marginBottom: '4px' }}>
            연락처 <span style={{ color: 'var(--fail)' }}>*</span>
            {isVerified && (
              <span style={{ marginLeft: '8px', fontSize: '.68rem', fontWeight: 700, color: 'var(--ok)', padding: '2px 8px', background: 'rgba(52,211,153,.14)', border: '1px solid rgba(52,211,153,.35)', borderRadius: '999px' }}>
                ✓ 인증 완료
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
                flexShrink: 0, minWidth: '110px',
                opacity: (otpPhase === 'sending' || resendSec > 0) ? 0.6 : 1,
              }}
            >
              {isVerified ? '인증 완료'
                : otpPhase === 'sending' ? '전송 중…'
                : resendSec > 0 ? `${resendSec}초 후 재전송`
                : (otpPhase === 'sent' || otpPhase === 'error') ? '다시 전송'
                : '인증번호 받기'}
            </button>
          </div>

          {/* 인증번호 입력 영역 — 전송 이후에만 표시 */}
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

          {/* 카운트다운 타이머 — 발송 직후 ~ 만료 전까지 */}
          {expiresAtMs !== null && !hasExpired && otpPhase !== 'verified' && (
            <div style={{
              marginTop: '8px', fontSize: '.78rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ color: 'var(--t3)' }}>인증번호를 발송했습니다. 5분 안에 입력해주세요.</span>
              <span style={{
                fontFamily: 'monospace', fontWeight: 700, flexShrink: 0,
                color: secondsLeft <= 30 ? 'var(--warn, #e89c38)' : 'var(--purple-2)',
              }}>
                ⏱ {formatMmSs(secondsLeft)}
              </span>
            </div>
          )}

          {/* 만료 경고 — 눈에 띄는 빨간 박스 */}
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

          {/* 메시지 — 전송 기본 안내문은 타이머에서 보여주므로 중복 제외하고, 에러/완료만 여기 표시 */}
          {otpMessage && !hasExpired && !otpMessage.startsWith('인증번호를 발송했습니다') && (
            <div style={{
              marginTop: '6px', fontSize: '.78rem',
              color: otpPhase === 'verified' ? 'var(--ok)'
                : otpPhase === 'error' ? 'var(--fail)'
                : otpPhase === 'sent' ? 'var(--fail)'  // sent 상태에서 남은 메시지는 검증 에러
                : 'var(--t3)',
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
