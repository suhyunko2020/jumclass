import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useCourses } from '../hooks/useCourses'
import { useInstructors } from '../hooks/useInstructors'
import { useAuth } from '../hooks/useAuth'

export default function PaymentSuccessPage() {
  const [params] = useSearchParams()
  const { getCourse } = useCourses()
  const { getInstructor } = useInstructors()
  const { user, enroll } = useAuth()
  const [done, setDone] = useState(false)

  const courseId = params.get('course') || ''
  const tierIdxStr = params.get('tier')
  const isDemo = params.get('demo') === '1'
  const paymentKey = params.get('paymentKey')
  const orderId = params.get('orderId')
  const amount = params.get('amount')
  const assignedInstructorId = params.get('assignedInstructor') || ''

  const course = getCourse(courseId)
  const tierIdx = tierIdxStr !== null ? Number(tierIdxStr) : 0
  const tier = course?.pricingTiers?.[tierIdx]
  const days = tier?.days ?? 365

  const isCert = course?.level === '자격증'
  const assignedInstructor = assignedInstructorId ? getInstructor(assignedInstructorId) : null

  useEffect(() => {
    document.title = '결제 완료 — JUMCLASS'
    async function processPayment() {
      // 실 결제(토스) 콜백일 때만 enroll — 데모 모드는 CheckoutPage에서 이미 enroll 완료됨
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
        await enroll(courseId, days, undefined, assignedInstructorId || undefined)
      }
      setDone(true)
    }
    processPayment()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!done) {
    return (
      <div className="loading" style={{ paddingTop: '140px' }}>
        <div className="spinner" />
      </div>
    )
  }

  // 자격증 과정 — 별도 안내 + 담당 강사 프로필
  if (isCert) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(var(--nav-h) + 40px) 20px 60px' }}>
        <div style={{ textAlign: 'center', maxWidth: '480px', width: '100%', animation: 'fadeUp .5s ease forwards' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '16px', animation: 'pulse 1s ease-in-out infinite' }}>🎉</div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: '12px' }}>수강신청 완료!</h1>
          <p style={{ color: 'var(--t2)', lineHeight: 1.75, marginBottom: '28px' }}>
            <strong style={{ color: 'var(--gold)' }}>{course?.title || '자격증 과정'}</strong>의 수강신청이 완료됐습니다.<br />
            곧 담당 강사님께서 연락드릴 예정입니다.
          </p>

          {/* 담당 강사 프로필 카드 */}
          {assignedInstructor && (
            <div style={{
              padding: '20px', borderRadius: 'var(--r3)',
              background: 'var(--glass-1)', border: '1px solid var(--line)',
              marginBottom: '20px', textAlign: 'left',
            }}>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--purple-2)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '14px' }}>
                담당 강사
              </div>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: 'rgba(124,111,205,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.4rem', fontWeight: 800, color: 'var(--purple-2)', overflow: 'hidden', flexShrink: 0,
                }}>
                  {assignedInstructor.photo
                    ? <img src={assignedInstructor.photo} alt={assignedInstructor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : assignedInstructor.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '.98rem', marginBottom: '2px' }}>{assignedInstructor.name}</div>
                  {assignedInstructor.title && (
                    <div style={{ fontSize: '.78rem', color: 'var(--t3)' }}>{assignedInstructor.title}</div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '.84rem' }}>
                {assignedInstructor.phone && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,.03)', borderRadius: 'var(--r2)' }}>
                    <span style={{ color: 'var(--t3)' }}>전화번호</span>
                    <a href={`tel:${assignedInstructor.phone}`} style={{ color: 'var(--t1)', fontWeight: 600 }}>{assignedInstructor.phone}</a>
                  </div>
                )}
                {assignedInstructor.kakao && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,.03)', borderRadius: 'var(--r2)' }}>
                    <span style={{ color: 'var(--t3)' }}>카카오톡</span>
                    <a href={assignedInstructor.kakao} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--t1)', fontWeight: 600 }}>오픈채팅 열기 →</a>
                  </div>
                )}
                {assignedInstructor.instagram && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,.03)', borderRadius: 'var(--r2)' }}>
                    <span style={{ color: 'var(--t3)' }}>인스타그램</span>
                    <a href={`https://instagram.com/${assignedInstructor.instagram.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--t1)', fontWeight: 600 }}>@{assignedInstructor.instagram.replace(/^@/, '')}</a>
                  </div>
                )}
              </div>
              <div style={{ marginTop: '14px', textAlign: 'center' }}>
                <Link to={`/instructor/${assignedInstructor.id}`} style={{ fontSize: '.82rem', color: 'var(--purple-2)', fontWeight: 600 }}>
                  강사 프로필 자세히 보기 →
                </Link>
              </div>
            </div>
          )}

          <div style={{
            padding: '14px', borderRadius: 'var(--r2)',
            background: 'rgba(61,189,132,.06)', border: '1px solid rgba(61,189,132,.15)',
            fontSize: '.82rem', color: 'var(--t2)',
          }}>
            <div style={{ marginBottom: '4px', fontWeight: 600, color: 'var(--ok)' }}>✓ 결제 확인 완료</div>
            <div>수강 기간: <strong>{days >= 9999 ? '무제한' : `${days}일`}</strong></div>
            {user && <div>결제 확인 메일이 <strong>{user.email}</strong>으로 발송됩니다.</div>}
          </div>
        </div>
      </div>
    )
  }

  // 일반 강의 — 기존 안내
  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(var(--nav-h) + 40px) 20px 60px' }}>
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
          <div>수강 기간: <strong>{days >= 9999 ? '무제한' : `${days}일`}</strong></div>
          {user && <div>결제 확인 메일이 <strong>{user.email}</strong>으로 발송됩니다.</div>}
        </div>
      </div>
    </div>
  )
}
