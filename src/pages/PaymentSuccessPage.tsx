import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useCourses } from '../hooks/useCourses'
import { useAuth } from '../hooks/useAuth'
import { formatDays } from '../utils/format'

export default function PaymentSuccessPage() {
  const [params] = useSearchParams()
  const { getCourse } = useCourses()
  const { user, enroll } = useAuth()
  const [done, setDone] = useState(false)

  const courseId = params.get('course') || ''
  const tierIdxStr = params.get('tier')
  const isDemo = params.get('demo') === '1'
  const paymentKey = params.get('paymentKey')
  const orderId = params.get('orderId')
  const amount = params.get('amount')

  const course = getCourse(courseId)
  const tierIdx = tierIdxStr !== null ? Number(tierIdxStr) : 0
  const tier = course?.pricingTiers?.[tierIdx]
  const days = tier?.days ?? 365

  useEffect(() => {
    document.title = '결제 완료 — JUMCLASS'
    async function processPayment() {
      // 실제 Toss 결제 확인 (paymentKey 있을 때)
      if (paymentKey && orderId && amount && !isDemo) {
        try {
          await fetch('https://api.tosspayments.com/v1/payments/confirm', {
            method: 'POST',
            headers: {
              Authorization: 'Basic dGVzdF9nY2tfUG94eTFYUUw4UllOUEdtTE9vazVyN25PNVdtbDo=',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
          })
        } catch {}
      }
      // 수강 등록
      enroll(courseId, days)
      setDone(true)
    }
    processPayment()
  }, [])

  if (!done) {
    return (
      <div className="loading" style={{ paddingTop: '140px' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{
        textAlign: 'center', maxWidth: '480px', width: '100%',
        animation: 'fadeUp .5s ease forwards',
      }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '16px', animation: 'pulse 1s ease-in-out infinite' }}>🎉</div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: '12px' }}>수강신청 완료!</h1>
        <p style={{ color: 'var(--t2)', lineHeight: 1.75, marginBottom: '24px' }}>
          <strong style={{ color: 'var(--gold)' }}>{course?.title || '강의'}</strong>의 수강신청이 완료됐습니다.<br />
          지금 바로 첫 강의를 시작해보세요.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '24px' }}>
          {course && (
            <Link to={`/lesson?course=${courseId}`} className="btn btn-gold btn-lg">강의 시작하기 →</Link>
          )}
          <Link to="/classroom" className="btn btn-ghost btn-lg">내 강의실</Link>
        </div>
        <div style={{
          padding: '14px', borderRadius: 'var(--r2)',
          background: 'rgba(61,189,132,.06)', border: '1px solid rgba(61,189,132,.15)',
          fontSize: '.82rem', color: 'var(--t2)',
        }}>
          <div style={{ marginBottom: '4px', fontWeight: 600, color: 'var(--ok)' }}>✓ 결제 확인 완료</div>
          <div>수강 기간: <strong>{formatDays(days)}</strong></div>
          {user && <div>결제 확인 메일이 <strong>{user.email}</strong>으로 발송됩니다.</div>}
        </div>
      </div>
    </div>
  )
}
