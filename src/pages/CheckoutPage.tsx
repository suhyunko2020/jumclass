import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useCourses } from '../hooks/useCourses'
import { useAuth } from '../hooks/useAuth'
import { useAuthModal } from '../components/auth/AuthModal'
import { useToast } from '../components/ui/Toast'
import { formatPrice, discountRate } from '../utils/format'

export default function CheckoutPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { getCourse } = useCourses()
  const { user, isEnrolled, enroll } = useAuth()
  const { openAuth } = useAuthModal()
  const toast = useToast()

  const courseId = params.get('course') || ''
  const tierParam = params.get('tier')
  const course = getCourse(courseId)
  const [paying, setPaying] = useState(false)

  const tierIdx = tierParam !== null ? Number(tierParam) : 0
  const tier = course?.pricingTiers?.[tierIdx]
  const price = tier?.price ?? course?.price ?? 0
  const originalPrice = tier?.originalPrice ?? course?.originalPrice ?? 0
  const days = tier?.days ?? 365

  useEffect(() => {
    document.title = '수강신청 — JUMCLASS'
  }, [])

  if (!course) {
    return (
      <div className="auth-gate"><div className="g-ico">😕</div><h2>강의를 찾을 수 없습니다</h2>
        <Link to="/courses" className="btn btn-primary">강의 목록으로</Link>
      </div>
    )
  }

  if (user && isEnrolled(courseId)) {
    return (
      <div className="checkout-wrap">
        <div className="container">
          <div className="auth-gate">
            <div className="g-ico">✓</div>
            <h2>이미 수강 중인 강의입니다</h2>
            <p>{course.title}은 이미 수강 가능합니다.</p>
            <Link to={`/lesson?course=${courseId}`} className="btn btn-primary mt-16">강의 바로 보기 →</Link>
          </div>
        </div>
      </div>
    )
  }

  const dr = discountRate(originalPrice, price)

  async function doPay() {
    if (!user) { openAuth('login'); return }
    setPaying(true)
    await new Promise(r => setTimeout(r, 1500))
    enroll(courseId, days)
    toast('수강신청이 완료됐습니다! ✦', 'ok')
    navigate(`/payment-success?course=${courseId}&demo=1`)
  }

  return (
    <div className="checkout-wrap">
      <div className="container">
        <div className="checkout-grid">
          {/* 주문 내역 */}
          <div>
            <div className="checkout-title">주문 내역</div>
            <div className="order-item">
              <div className="order-emoji">{course.emoji}</div>
              <div className="order-info">
                <h3>{course.title}</h3>
                <p>{course.subtitle}</p>
                <p style={{ marginTop: '5px', color: 'var(--t3)' }}>🎬 {course.lessons}강 &nbsp;·&nbsp; ⏱ {course.duration} &nbsp;·&nbsp; {course.level}</p>
              </div>
            </div>
            <div className="price-table">
              <div className="price-row"><span>정가</span><span>{formatPrice(originalPrice)}</span></div>
              <div className="price-row" style={{ color: 'var(--ok)' }}><span>할인 ({dr}%)</span><span>- {formatPrice(originalPrice - price)}</span></div>
              <div className="price-row total"><span>결제 금액</span><span>{formatPrice(price)}</span></div>
            </div>
            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {['결제 즉시 수강 시작 가능', '365일 수강 기간', '학습 자료 다운로드 포함', '7일 환불 보장'].map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.84rem', color: 'var(--t2)' }}>
                  <span style={{ color: 'var(--ok)' }}>✓</span> {t}
                </div>
              ))}
            </div>
          </div>

          {/* 결제 */}
          <div>
            <div className="pay-box">
              <h3>결제</h3>

              {!user && (
                <div style={{ padding: '14px', borderRadius: 'var(--r2)', background: 'rgba(124,111,205,.08)', border: '1px solid rgba(124,111,205,.2)', marginBottom: '16px' }}>
                  <div style={{ fontSize: '.875rem', fontWeight: 600, marginBottom: '3px' }}>로그인이 필요합니다</div>
                  <div style={{ fontSize: '.82rem', color: 'var(--t2)' }}>결제를 진행하려면 먼저 로그인해주세요.</div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => openAuth('login')}>로그인</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => openAuth('signup')}>회원가입</button>
                  </div>
                </div>
              )}

              <div style={{ padding: '16px', borderRadius: 'var(--r2)', background: 'rgba(61,189,132,.06)', border: '1px solid rgba(61,189,132,.2)', marginBottom: '16px' }}>
                <div style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--ok)', marginBottom: '4px' }}>✓ 테스트 결제 모드</div>
                <div style={{ fontSize: '.8rem', color: 'var(--t2)', lineHeight: 1.6 }}>
                  결제 버튼을 누르면 <strong>테스트 수강등록</strong>이 진행됩니다.
                </div>
              </div>

              <button
                className="btn btn-gold w-full btn-xl"
                onClick={doPay}
                disabled={paying}
              >
                {paying ? '결제 처리 중…' : `${formatPrice(price)} 결제하기 →`}
              </button>

              <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '.76rem', color: 'var(--t3)' }}>
                토스페이먼츠 보안 결제 · SSL 암호화
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
