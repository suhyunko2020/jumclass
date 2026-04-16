import { useSearchParams, Link } from 'react-router-dom'
import { useEffect } from 'react'

export default function PaymentFailPage() {
  const [params] = useSearchParams()
  const courseId = params.get('course') || ''
  const message = params.get('message') || '결제가 취소되었거나 오류가 발생했습니다.'

  useEffect(() => {
    document.title = '결제 실패 — JUMCLASS'
  }, [])

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ textAlign: 'center', maxWidth: '440px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>😕</div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: '12px' }}>결제에 실패했습니다</h1>
        <p style={{ color: 'var(--t2)', lineHeight: 1.75, marginBottom: '24px' }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {courseId && (
            <Link to={`/checkout?course=${courseId}`} className="btn btn-primary btn-lg">다시 시도하기</Link>
          )}
          <Link to="/courses" className="btn btn-ghost btn-lg">강의 목록으로</Link>
        </div>
      </div>
    </div>
  )
}
