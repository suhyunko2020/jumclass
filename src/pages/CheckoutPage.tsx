import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useCourses } from '../hooks/useCourses'
import { useInstructors } from '../hooks/useInstructors'
import { useAuth } from '../hooks/useAuth'
import { useAuthModal } from '../components/auth/AuthModal'
import { useToast } from '../components/ui/Toast'
import { formatPrice, discountRate } from '../utils/format'
import { createProgressPage, uploadSignatureImage, saveCertificateAgreement } from '../utils/storage'
import { sendInstructorAlimtalk } from '../utils/alimtalk'
import type { ProgressChecklistItem } from '../data/types'
import CertificateAgreementForm, { type AgreementFormValue } from '../components/course/CertificateAgreementForm'
import { CERTIFICATE_AGREEMENT } from '../data/certificateAgreement'

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
  const assignedInstructorId = params.get('assignedInstructor') || ''

  const course = courseId ? getCourse(courseId) : null
  const instructor = instructorId ? getInstructor(instructorId) : null
  const service = instructor?.services.find(s => s.id === serviceId) || null

  const isServiceCheckout = !!instructor && !!service

  const [paying, setPaying] = useState(false)
  const [certAgreement, setCertAgreement] = useState<AgreementFormValue>({
    name: '', birthdate: '', phone: '', signatureDataUrl: null,
  })
  const [agreements, setAgreements] = useState({ privacy: false, terms: false, refund: false, copyright: false })
  const allAgreed = agreements.privacy && agreements.terms && agreements.refund && agreements.copyright
  const isCertCheckout = !!course && course.level === '자격증'
  const certAgreementReady = !isCertCheckout || (
    certAgreement.name.trim().length > 0 &&
    certAgreement.birthdate.length > 0 &&
    certAgreement.phone.trim().length > 0 &&
    !!certAgreement.signatureDataUrl
  )
  const canProceed = allAgreed && certAgreementReady
  const policies: { key: keyof typeof agreements; label: string }[] = [
    { key: 'privacy', label: '개인정보처리방침' },
    { key: 'terms', label: '이용약관' },
    { key: 'refund', label: '환불 정책' },
    { key: 'copyright', label: '저작권 안내' },
  ]
  const toggleAllAgreements = (checked: boolean) =>
    setAgreements({ privacy: checked, terms: checked, refund: checked, copyright: checked })

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

  // paying 중엔 enroll로 인해 isEnrolled가 true가 되어도 이 가드를 건너뛴다
  // 자격증 과정은 (강의, 강사) 조합으로 체크 — 다른 강사로 재결제 허용
  const alreadyEnrolled = isCertCheckout
    ? isEnrolled(courseId, assignedInstructorId || undefined)
    : isEnrolled(courseId)
  if (course && user && alreadyEnrolled && !paying) {
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
    if (!allAgreed) { toast('약관에 모두 동의해주세요.', 'err'); return }
    if (isCertCheckout && !certAgreementReady) {
      toast('자격증 수강 동의서의 모든 항목을 입력하고 서명해주세요.', 'err')
      return
    }
    setPaying(true)
    await new Promise(r => setTimeout(r, 1500))

    if (isServiceCheckout) {
      toast('서비스 신청이 완료됐습니다!', 'ok')
      navigate(`/instructor/${instructorId}`)
    } else {
      const agreedKeys = policies.filter(p => agreements[p.key]).map(p => p.key)
      await enroll(courseId, days, agreedKeys, assignedInstructorId || undefined)

      // 자격증 과정 — 서명·동의서 저장 (강사별로 독립 저장)
      if (isCertCheckout && user && certAgreement.signatureDataUrl) {
        const signatureUrl = await uploadSignatureImage(user.uid, courseId, certAgreement.signatureDataUrl)
        if (signatureUrl) {
          await saveCertificateAgreement({
            userId: user.uid,
            courseId,
            signerName: certAgreement.name.trim(),
            signerBirthdate: certAgreement.birthdate,
            signerPhone: certAgreement.phone.trim(),
            signatureUrl,
            agreementVersion: CERTIFICATE_AGREEMENT.version,
            agreementSnapshot: CERTIFICATE_AGREEMENT,
            assignedInstructorId: assignedInstructorId || null,
          })
        } else {
          console.warn('서명 이미지 업로드 실패 — 동의서 기록 없이 결제 진행')
        }
      }

      // 자격증 과정 + 강사 선택 시: 강사용 진도 관리 페이지 자동 생성 + 알림톡 발송
      if (course && course.level === '자격증' && assignedInstructorId && user) {
        const checklist: ProgressChecklistItem[] = course.curriculum.flatMap(sec =>
          sec.items.map(item => ({
            id: item.id,
            title: item.title,
            description: sec.section,
            checked: false,
          }))
        )
        const progressPage = await createProgressPage({
          userId: user.uid,
          courseId: course.id,
          instructorId: assignedInstructorId,
          checklist,
        })

        // 알림톡 발송 (비즈엠 심사/환경변수 미완료 시 조용히 실패, 결제는 정상 진행)
        if (progressPage) {
          const inst = getInstructor(assignedInstructorId)
          if (inst?.phone) {
            const periodLabel = days === 90 ? '3개월' : days === 120 ? '4개월' : `${days}일`
            sendInstructorAlimtalk({
              phone: inst.phone,
              instructorName: inst.name,
              studentName: user.name,
              courseName: course.title,
              coursePeriod: periodLabel,
              token: progressPage.id,
            }).then(r => {
              if (!r.ok) console.warn('알림톡 발송 실패 (정상 플로우 계속):', r.reason, r.message)
            })
          }
        }
      }

      toast('수강신청이 완료됐습니다!', 'ok')
      const successQuery = `course=${courseId}&demo=1${assignedInstructorId ? `&assignedInstructor=${assignedInstructorId}` : ''}`
      navigate(`/payment-success?${successQuery}`)
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
            {isServiceCheckout && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {[
                  service!.mode === 'offline' ? '대면 강의로 진행됩니다' :
                    service!.mode === 'online' ? '비대면 강의 (Zoom)로 진행됩니다' :
                    service!.mode === 'both' ? '대면 & 비대면(Zoom) 선택 가능' : null,
                ].filter(Boolean).map(t => (
                  <div key={t as string} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.84rem', color: 'var(--t2)' }}>
                    <span style={{ color: 'var(--ok)' }}>✓</span> {t}
                  </div>
                ))}
              </div>
            )}
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
              <button className="btn btn-gold w-full btn-xl" onClick={doPay} disabled={paying || !canProceed}>
                {paying ? '처리 중…' : `${formatPrice(price)} 결제하기 →`}
              </button>
              <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '.76rem', color: 'var(--t3)' }}>
                토스페이먼츠 보안 결제 · SSL 암호화
              </div>

              {/* 약관 동의 영역 */}
              <div style={{
                marginTop: '20px',
                padding: '14px 16px',
                borderRadius: 'var(--r2)',
                background: 'rgba(6,7,15,.6)',
                border: '1px solid rgba(255,255,255,.06)',
              }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  paddingBottom: '11px',
                  borderBottom: '1px solid rgba(255,255,255,.06)',
                  cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={allAgreed}
                    onChange={e => toggleAllAgreements(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0, accentColor: 'var(--purple-2)' }}
                  />
                  <span style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--t1)' }}>전체 동의하기</span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '11px' }}>
                  {policies.map(p => (
                    <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '9px', flex: 1, cursor: 'pointer', fontSize: '.82rem', color: 'var(--t2)' }}>
                        <input
                          type="checkbox"
                          checked={agreements[p.key]}
                          onChange={e => setAgreements(prev => ({ ...prev, [p.key]: e.target.checked }))}
                          style={{ width: '14px', height: '14px', cursor: 'pointer', flexShrink: 0, accentColor: 'var(--purple-2)' }}
                        />
                        <span>
                          <span style={{ color: 'var(--t3)', fontWeight: 500, marginRight: '4px' }}>(필수)</span>
                          {p.label}
                        </span>
                      </label>
                      <Link
                        to={`/policy/${p.key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '.72rem', color: 'var(--t3)', textDecoration: 'none', flexShrink: 0, padding: '3px 8px', borderRadius: 'var(--r1)', border: '1px solid rgba(255,255,255,.06)' }}
                      >
                        보기
                      </Link>
                    </div>
                  ))}
                </div>
                {!allAgreed && (
                  <div style={{ marginTop: '11px', paddingTop: '11px', borderTop: '1px solid rgba(255,255,255,.04)', fontSize: '.72rem', color: 'var(--t3)', textAlign: 'center' }}>
                    모든 항목에 동의해야 결제할 수 있습니다.
                  </div>
                )}
              </div>

              {/* 자격증 과정 — 수강 동의서 서명 */}
              {isCertCheckout && (
                <div style={{ marginTop: '16px' }}>
                  <CertificateAgreementForm
                    value={certAgreement}
                    onChange={setCertAgreement}
                  />
                  {!certAgreementReady && (
                    <div style={{ marginTop: '8px', fontSize: '.72rem', color: 'var(--warn)', textAlign: 'center' }}>
                      동의서의 모든 항목 입력과 서명이 완료되어야 결제할 수 있습니다.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
