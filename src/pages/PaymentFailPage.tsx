import { useSearchParams, Link } from 'react-router-dom'
import { useEffect } from 'react'
import { loadIntent, clearIntent } from '../lib/toss'

// Toss 공식 문서의 대표적 실패 코드 매핑
const ERROR_GUIDE: Record<string, string> = {
  PAY_PROCESS_CANCELED: '결제를 취소하셨습니다.',
  PAY_PROCESS_ABORTED: '결제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  USER_CANCEL: '결제를 취소하셨습니다.',
  INVALID_CARD_COMPANY: '유효하지 않은 카드사입니다.',
  INVALID_CARD_NUMBER: '카드 번호를 다시 확인해주세요.',
  INVALID_CARD_EXPIRATION: '카드 유효기간을 확인해주세요.',
  INVALID_CARD_PASSWORD: '카드 비밀번호를 확인해주세요.',
  EXCEED_MAX_CARD_INSTALLMENT_PLAN: '해당 카드로는 지원하지 않는 할부 개월 수입니다.',
  NOT_ENOUGH_BALANCE: '잔액이 부족하거나 한도를 초과했습니다.',
  REJECT_CARD_COMPANY: '카드사에서 결제를 거절했습니다.',
}

export default function PaymentFailPage() {
  const [params] = useSearchParams()
  const orderId = params.get('orderId') || ''
  const code = params.get('code') || ''
  const rawMessage = params.get('message') || ''

  useEffect(() => {
    document.title = '결제 실패 — JUMCLASS'
    // 실패 시 대기 중인 intent 정리 (재결제 시 새 orderId로 다시 저장됨)
    if (orderId) clearIntent(orderId)
  }, [orderId])

  const friendly = ERROR_GUIDE[code] || rawMessage || '결제가 취소되었거나 오류가 발생했습니다.'

  // intent 잔여물에서 courseId 추출해 "다시 시도" 경로 유도
  const intent = orderId ? loadIntent(orderId) : null
  const retryHref = intent?.courseId
    ? `/checkout?course=${intent.courseId}${intent.assignedInstructorId ? `&assignedInstructor=${intent.assignedInstructorId}` : ''}${typeof intent.tierIdx === 'number' ? `&tier=${intent.tierIdx}` : ''}`
    : intent?.instructorId && intent?.serviceId
      ? `/checkout?instructor=${intent.instructorId}&service=${intent.serviceId}`
      : '/courses'

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ textAlign: 'center', maxWidth: '440px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>😕</div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: '12px' }}>결제에 실패했습니다</h1>
        <p style={{ color: 'var(--t2)', lineHeight: 1.75, marginBottom: '8px' }}>{friendly}</p>

        {code && (
          <div style={{ fontSize: '.72rem', color: 'var(--t3)', marginBottom: '20px', fontFamily: 'monospace' }}>
            오류 코드: {code}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to={retryHref} className="btn btn-primary btn-lg">다시 시도하기</Link>
          <Link to="/courses" className="btn btn-ghost btn-lg">강의 목록으로</Link>
        </div>
      </div>
    </div>
  )
}
