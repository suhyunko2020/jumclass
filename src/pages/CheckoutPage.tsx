import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useCourses } from '../hooks/useCourses'
import { useInstructors } from '../hooks/useInstructors'
import { useAuth } from '../hooks/useAuth'
import { useAuthModal } from '../components/auth/AuthModal'
import { useToast } from '../components/ui/Toast'
import { formatPrice, discountRate } from '../utils/format'

export default function CheckoutPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { getCourse } = useCourses()
  const { getInstructor } = useInstructors()
  const { user, isEnrolled, enroll } = useAuth()
  const { openAuth } = useAuthModal()
  const toast = useToast()

  const courseId = params.get('course') || ''
  const tierParam = params.get('tier')
  const instructorId = params.get('instructor') || ''
  const serviceId = params.get('service') || ''

  const course = courseId ? getCourse(courseId) : null
  const instructor = instructorId ? getInstructor(instructorId) : null
  const service = instructor?.services.find(s => s.id === serviceId) || null

  const isServiceCheckout = !!instructor && !!service

  const [paying, setPaying] = useState(false)

  const tierIdx = tierParam !== null ? Number(tierParam) : 0
  const tier = course?.pricingTiers?.[tierIdx]
  const price = isServiceCheckout ? service!.price : (tier?.price ?? course?.price ?? 0)
  const originalPrice = isServiceCheckout ? service!.originalPrice : (tier?.originalPrice ?? course?.originalPrice ?? 0)
  const days = tier?.days ?? 365
  const dr = discountRate(originalPrice, price)

  useEffect(() => {
    document.title = isServiceCheckout ? '서비스 신청 — JUMCLASS' : '수강신청 — JUMCLASS'
  }, [isServiceCheckout])

  if (!course && !isServiceCheckout) {
    return (
      <div className="auth-gate"><h2>상품을 찾을 수 없습니다</h2>
        <Link to="/courses" className="btn btn-primary">강의 목록으로</Link>
      </div>
    )
  }

  if (course && user && isEnrolled(courseId)) {
    return (
      <div className="checkout-wrap">
        <div className="container">
          <div className="auth-gate">
            <h2>이미 수강 중인 강의입니다</h2>
            <p>{course.title}은 이미 수강 가능합니다.</p>
            <Link to={`/lesson?course=${courseId}`} className="btn btn-primary mt-16">강의 바로 보기 →</Link>
          </div>
        </div>
      </div>
    )
  }

  async function doPay() {
    if (!user) { openAuth('login'); return }
    setPaying(true)
    await new Promise(r => setTimeout(r, 1500))

    if (isServiceCheckout) {
      toast('서비스 신청이 완료됐습니다!', 'ok')
      navigate(`/instructor/${instructorId}`)
    } else {
      await enroll(courseId, days)
      toast('수강신청이 완료됐습니다!', 'ok')
      navigate(`/payment-success?course=${courseId}&demo=1`)
    }
  }

  const itemTitle = isServiceCheckout ? service!.title : course!.title
  const itemSub = isServiceCheckout
    ? `${instructor!.name} · ${service!.type === 'consultation' ? '상담' : service!.type === 'reading' ? '리딩' : service!.type === 'lesson' ? '레슨' : '기타'} · ${service!.duration}`
    : course!.subtitle

  return (
    <div className="checkout-wrap">
      <div className="container">
        <div className="checkout-grid">
          {/* 주문 내역 */}
          <div>
            <div className="checkout-title">주문 내역</div>
            <div className="order-item">
              {isServiceCheckout ? (
                <div style={{ width: '52px', height: '52px', borderRadius: 'var(--r2)', background: 'rgba(124,111,205,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800, color: 'var(--purple-2)', flexShrink: 0, overflow: 'hidden' }}>
                  {instructor!.photo
                    ? <img src={instructor!.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : instructor!.name.charAt(0)
                  }
                </div>
              ) : (
                <div className="order-emoji">{course!.emoji}</div>
              )}
              <div className="order-info">
                <h3>{itemTitle}</h3>
                <p>{itemSub}</p>
              </div>
            </div>
            <div className="price-table">
              <div className="price-row"><span>정가</span><span>{formatPrice(originalPrice)}</span></div>
              {dr > 0 && <div className="price-row" style={{ color: 'var(--ok)' }}><span>할인 ({dr}%)</span><span>- {formatPrice(originalPrice - price)}</span></div>}
              <div className="price-row total"><span>결제 금액</span><span>{formatPrice(price)}</span></div>
            </div>
            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {(isServiceCheckout
                ? [
                    '결제 후 강사가 직접 연락드립니다',
                    '이후 일정과 스케줄은 모두 개인 맞춤으로 진행됩니다',
                    ...(service!.mode === 'offline' ? ['대면 강의로 진행됩니다'] :
                        service!.mode === 'online' ? ['비대면 강의 (Zoom)로 진행됩니다'] :
                        service!.mode === 'both' ? ['대면 & 비대면(Zoom) 선택 가능'] :
                        []),
                  ]
                : ['결제 즉시 수강 시작 가능', '365일 수강 기간', '학습 자료 다운로드 포함', '7일 환불 보장']
              ).map(t => (
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
                <div style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--ok)', marginBottom: '4px' }}>테스트 결제 모드</div>
                <div style={{ fontSize: '.8rem', color: 'var(--t2)', lineHeight: 1.6 }}>
                  결제 버튼을 누르면 <strong>테스트 {isServiceCheckout ? '신청' : '수강등록'}</strong>이 진행됩니다.
                </div>
              </div>
              <button className="btn btn-gold w-full btn-xl" onClick={doPay} disabled={paying}>
                {paying ? '처리 중…' : `${formatPrice(price)} 결제하기 →`}
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
