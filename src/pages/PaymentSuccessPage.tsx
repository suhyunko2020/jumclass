import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useCourses } from '../hooks/useCourses'
import { useInstructors } from '../hooks/useInstructors'
import { useAuth } from '../hooks/useAuth'
import { loadIntent, clearIntent, type TossPaymentIntent } from '../lib/toss'
import { notifyAdmin } from '../utils/notifyAdmin'
import { createProgressPage, uploadSignatureImage, saveCertificateAgreement } from '../utils/storage'
import { sendPaymentComplete, sendInstructorProgress, sendCourseStart } from '../utils/alimtalk'
import { formatPrice } from '../utils/format'
import { CERTIFICATE_AGREEMENT } from '../data/certificateAgreement'
import type { ProgressChecklistItem } from '../data/types'

type ConfirmState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ok'; intent: TossPaymentIntent }

export default function PaymentSuccessPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { getCourse } = useCourses()
  const { getInstructor } = useInstructors()
  const { user, enroll, loading: authLoading } = useAuth()

  const paymentKey = params.get('paymentKey')
  const orderId = params.get('orderId')
  const amountStr = params.get('amount')
  const isFree = params.get('free') === '1'

  const [state, setState] = useState<ConfirmState>({ phase: 'loading' })

  // StrictMode 중복 실행 방지 (Toss Confirm은 한 번만 호출돼야 함)
  const ranRef = useRef(false)

  useEffect(() => {
    document.title = '결제 처리 중 — JUMCLASS'
    // Supabase 세션 복구 대기 — 토스 리디렉트 직후엔 user가 아직 null이라
    // 여기서 본인 확인(intent.userId === user.uid)을 하면 잘못 실패함.
    // loading이 끝나 user가 확정된 뒤에만 승인 절차를 진행한다.
    if (authLoading) return
    if (ranRef.current) return
    ranRef.current = true

    ;(async () => {
      // ── 무료 강의 — 토스 승인 없이 즉시 등록 ──────────────
      if (isFree) {
        if (!orderId) {
          setState({ phase: 'error', message: '수강 신청 정보가 올바르지 않습니다.' })
          return
        }
        const intent = loadIntent(orderId)
        if (!intent) {
          setState({ phase: 'error', message: '수강 신청 정보를 찾을 수 없습니다.' })
          return
        }
        if (!user || (intent.userId && intent.userId !== user.uid)) {
          setState({ phase: 'error', message: '다른 계정의 신청 정보입니다. 본인 계정으로 로그인 후 다시 시도해주세요.' })
          return
        }
        try {
          await applyIntent(intent)
        } catch (err) {
          console.error('무료 수강 등록 중 오류', err)
        }
        clearIntent(orderId)
        setState({ phase: 'ok', intent })
        document.title = '수강 신청 완료 — JUMCLASS'
        return
      }

      // 유효성 검사
      if (!paymentKey || !orderId || !amountStr) {
        setState({ phase: 'error', message: '결제 정보가 올바르지 않습니다. (paymentKey 누락)' })
        return
      }
      const amount = Number(amountStr)
      if (!Number.isFinite(amount) || amount <= 0) {
        setState({ phase: 'error', message: '결제 금액이 올바르지 않습니다.' })
        return
      }

      // 결제 intent(CheckoutPage에서 저장한 복원 데이터) 로드
      const intent = loadIntent(orderId)
      if (!intent) {
        setState({ phase: 'error', message: '결제 정보를 찾을 수 없습니다. 결제 완료 후 다른 브라우저/탭에서 접근했을 수 있어요.' })
        return
      }
      if (intent.amount !== amount) {
        setState({ phase: 'error', message: '결제 금액이 일치하지 않습니다.' })
        return
      }
      // 사용자 본인 확인 — intent 생성자와 현재 로그인 유저가 동일해야 함
      if (!user || (intent.userId && intent.userId !== user.uid)) {
        setState({ phase: 'error', message: '다른 계정의 결제 정보입니다. 본인 계정으로 로그인 후 다시 시도해주세요.' })
        return
      }

      // 서버 Confirm API 호출 — 시크릿 키는 서버가 Supabase에서 직접 읽으므로 전달하지 않음
      let confirmRes: Response
      try {
        confirmRes = await fetch('/api/toss-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentKey, orderId, amount }),
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : '네트워크 오류'
        setState({ phase: 'error', message: `결제 승인 요청 실패: ${msg}` })
        return
      }

      const confirmJson = await confirmRes.json().catch(() => ({}))
      if (!confirmRes.ok || !confirmJson?.ok) {
        const reason = confirmJson?.message || '결제 승인에 실패했습니다.'
        setState({ phase: 'error', message: reason })
        return
      }

      // 승인 성공 → enrollment, 서명, 알림톡 등 실행
      try {
        await applyIntent(intent)
      } catch (err) {
        console.error('결제 성공 후 처리 중 오류', err)
      }

      clearIntent(orderId)
      setState({ phase: 'ok', intent })
      document.title = '결제 완료 — JUMCLASS'
    })()

    async function applyIntent(intent: TossPaymentIntent) {
      // 서비스 신청은 별도 처리 없이 성공 메시지만 (토스 결제 자체로 완료)
      if (intent.checkoutType === 'service') return

      if (!user || !intent.courseId) return

      await enroll(intent.courseId, intent.days ?? 365, intent.agreedKeys, intent.assignedInstructorId || undefined)

      const course = getCourse(intent.courseId)
      const isCert = course?.level === '자격증'
      const days = intent.days ?? 365
      const periodLabel = days === 90 ? '3개월' : days === 120 ? '4개월' : days >= 9999 ? '무제한' : `${days}일`
      // 고객 연락처 — 프로필 우선, 자격증 동의서에 입력한 번호로 폴백
      const customerPhone = user.phone || intent.certAgreement?.phone?.trim() || ''

      // 결제완료 알림톡 (고객) — 모든 유료 강의 공통
      if (customerPhone && course) {
        sendPaymentComplete({
          phone: customerPhone,
          customerName: user.name,
          courseName: course.title,
          amount: formatPrice(intent.amount),
          period: periodLabel,
        }).then(r => { if (!r.ok) console.warn('[alimtalk:payment]', r) })
      }

      // 결제 알림(문자) — 관리자에게. 유료 결제만 (무료 수강신청 제외)
      if (course && intent.amount > 0) {
        notifyAdmin({ kind: 'payment', customerName: user.name, courseTitle: course.title, amount: formatPrice(intent.amount) })
      }

      if (isCert && intent.certAgreement?.signatureDataUrl) {
        const signatureUrl = await uploadSignatureImage(user.uid, intent.courseId, intent.certAgreement.signatureDataUrl)
        if (signatureUrl) {
          await saveCertificateAgreement({
            userId: user.uid,
            courseId: intent.courseId,
            signerName: intent.certAgreement.name.trim(),
            signerBirthdate: intent.certAgreement.birthdate,
            signerPhone: intent.certAgreement.phone.trim(),
            signatureUrl,
            agreementVersion: CERTIFICATE_AGREEMENT.version,
            agreementSnapshot: CERTIFICATE_AGREEMENT,
            assignedInstructorId: intent.assignedInstructorId || null,
          })
        }
      }

      // 자격증 + 강사 선택 — 진도 관리 페이지 생성 및 알림톡
      if (isCert && course && intent.assignedInstructorId) {
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
          instructorId: intent.assignedInstructorId,
          checklist,
        })
        if (progressPage) {
          const inst = getInstructor(intent.assignedInstructorId)
          // 진도관리 안내 알림톡 (강사)
          if (inst?.phone) {
            sendInstructorProgress({
              phone: inst.phone,
              instructorName: inst.name,
              studentName: user.name,
              courseName: course.title,
              period: periodLabel,
              token: progressPage.id,
            }).then(r => { if (!r.ok) console.warn('[alimtalk:progress]', r) })
          }
          // 수강시작 안내 알림톡 (수강생)
          if (customerPhone && inst) {
            sendCourseStart({
              phone: customerPhone,
              customerName: user.name,
              courseName: course.title,
              instructorName: inst.name,
              period: periodLabel,
            }).then(r => { if (!r.ok) console.warn('[alimtalk:course-start]', r) })
          }
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading])

  if (state.phase === 'loading') {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: '18px' }}>
        <div className="spinner" />
        <div style={{ fontSize: '.9rem', color: 'var(--t2)' }}>결제를 확인하는 중입니다…</div>
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ textAlign: 'center', maxWidth: '440px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: '12px' }}>결제 처리 오류</h1>
          <p style={{ color: 'var(--t2)', lineHeight: 1.7, marginBottom: '20px', fontSize: '.92rem' }}>{state.message}</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/courses')} className="btn btn-primary btn-lg">강의 목록으로</button>
            <button onClick={() => navigate('/my')} className="btn btn-ghost btn-lg">마이페이지</button>
          </div>
        </div>
      </div>
    )
  }

  // 성공 — 기존 UI 유지
  const { intent } = state
  const course = intent.courseId ? getCourse(intent.courseId) : null
  const days = intent.days ?? 365
  const isCert = course?.level === '자격증'
  const assignedInstructor = intent.assignedInstructorId ? getInstructor(intent.assignedInstructorId) : null

  // 자격증 — 담당 강사 프로필 포함 안내
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

          {assignedInstructor && (
            <div style={{ padding: '20px', borderRadius: 'var(--r3)', background: 'var(--glass-1)', border: '1px solid var(--line)', marginBottom: '20px', textAlign: 'left' }}>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--purple-2)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '14px' }}>
                담당 강사
              </div>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(124,111,205,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800, color: 'var(--purple-2)', overflow: 'hidden', flexShrink: 0 }}>
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

          <div style={{ padding: '14px', borderRadius: 'var(--r2)', background: 'rgba(61,189,132,.06)', border: '1px solid rgba(61,189,132,.15)', fontSize: '.82rem', color: 'var(--t2)' }}>
            <div style={{ marginBottom: '4px', fontWeight: 600, color: 'var(--ok)' }}>✓ 결제 확인 완료</div>
            <div>수강 기간: <strong>{days >= 9999 ? '무제한' : `${days}일`}</strong></div>
            {user && <div>결제 확인 메일이 <strong>{user.email}</strong>으로 발송됩니다.</div>}
          </div>
        </div>
      </div>
    )
  }

  // 서비스 신청인 경우 → 강사 프로필로 안내
  if (intent.checkoutType === 'service') {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(var(--nav-h) + 40px) 20px 60px' }}>
        <div style={{ textAlign: 'center', maxWidth: '440px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎉</div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: '12px' }}>신청이 완료됐습니다</h1>
          <p style={{ color: 'var(--t2)', lineHeight: 1.7, marginBottom: '24px' }}>
            담당 강사님께서 연락드릴 예정입니다.
          </p>
          {intent.instructorId && (
            <Link to={`/instructor/${intent.instructorId}`} className="btn btn-primary btn-lg">강사 프로필 보기 →</Link>
          )}
        </div>
      </div>
    )
  }

  // 일반 강의
  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(var(--nav-h) + 40px) 20px 60px' }}>
      <div style={{ textAlign: 'center', maxWidth: '480px', width: '100%', animation: 'fadeUp .5s ease forwards' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '16px', animation: 'pulse 1s ease-in-out infinite' }}>🎉</div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: '12px' }}>수강신청 완료!</h1>
        <p style={{ color: 'var(--t2)', lineHeight: 1.75, marginBottom: '24px' }}>
          <strong style={{ color: 'var(--gold)' }}>{course?.title || '강의'}</strong>의 수강신청이 완료됐습니다.<br />
          지금 바로 첫 강의를 시작해보세요.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '24px' }}>
          {course && (
            <Link to={`/lesson?course=${intent.courseId}`} className="btn btn-gold btn-lg">강의 시작하기 →</Link>
          )}
          <Link to="/classroom" className="btn btn-ghost btn-lg">내 강의실</Link>
        </div>
        <div style={{ padding: '14px', borderRadius: 'var(--r2)', background: 'rgba(61,189,132,.06)', border: '1px solid rgba(61,189,132,.15)', fontSize: '.82rem', color: 'var(--t2)' }}>
          <div style={{ marginBottom: '4px', fontWeight: 600, color: 'var(--ok)' }}>✓ 결제 확인 완료</div>
          <div>수강 기간: <strong>{days >= 9999 ? '무제한' : `${days}일`}</strong></div>
          {user && <div>결제 확인 메일이 <strong>{user.email}</strong>으로 발송됩니다.</div>}
        </div>
      </div>
    </div>
  )
}
