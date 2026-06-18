// 카카오 알림톡 발송 헬퍼 — 서버리스 함수(/api/send-kakao, SOLAPI) 프록시
// 실패해도 결제/업무 플로우는 계속 진행되도록 설계 (throw 하지 않음)
//
// 모든 함수는 휴대폰 번호가 없으면 조용히 skip 한다.
// 변수 키는 템플릿에 등록된 한글 키 그대로 사용 (서버가 #{} 형식으로 변환).

const SITE_ORIGIN =
  (typeof window !== 'undefined' && window.location?.origin) || 'https://jumclass.com'

export type KakaoType =
  | 'payment_complete'
  | 'inquiry_received'
  | 'inquiry_answered'
  | 'refund_complete'
  | 'instructor_progress'
  | 'course_start'
  | 'expiry_soon'
  | 'course_complete'
  | 'welcome'

export interface KakaoResult {
  ok: boolean
  reason?: string
  message?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawData?: any
}

interface SendOpts {
  buttons?: Array<Record<string, unknown>>
  userId?: string   // to가 없으면 서버가 이 userId로 profiles에서 번호 조회 (RLS 우회)
}

// 핵심 발송 함수 — 직접 호출보다 아래 트리거별 래퍼 사용 권장
export async function sendKakao(
  type: KakaoType,
  to: string,
  variables: Record<string, string | number>,
  opts?: SendOpts,
): Promise<KakaoResult> {
  if (!to && !opts?.userId) return { ok: false, reason: 'missing-phone' }
  try {
    const res = await fetch('/api/send-kakao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, to, userId: opts?.userId, variables, buttons: opts?.buttons }),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json().catch(() => null) as any
    if (!res.ok || data?.ok === false) {
      return { ok: false, reason: data?.code || `http-${res.status}`, message: data?.message, rawData: data }
    }
    return data ?? { ok: true }
  } catch (err) {
    return { ok: false, reason: 'network-error', message: err instanceof Error ? err.message : String(err) }
  }
}

// ── 트리거별 래퍼 ─────────────────────────────────────────────

// 결제완료 (고객)
export function sendPaymentComplete(p: {
  phone: string; customerName: string; courseName: string; amount: string; period: string
}): Promise<KakaoResult> {
  return sendKakao('payment_complete', p.phone, {
    고객명: p.customerName, 강의명: p.courseName, 결제금액: p.amount, 수강기간: p.period,
  })
}

// 진도관리 안내 (강사) — 진도 페이지 링크 버튼 포함
export function sendInstructorProgress(p: {
  phone: string; instructorName: string; studentName: string; courseName: string; period: string; token: string
}): Promise<KakaoResult> {
  const url = `${SITE_ORIGIN}/i/${p.token}`
  return sendKakao('instructor_progress', p.phone, {
    강사명: p.instructorName, 수강생명: p.studentName, 과정명: p.courseName, 수강기간: p.period, 토큰: p.token,
  }, {
    buttons: [{ buttonType: 'WL', buttonName: '진도 관리 페이지', linkMo: url, linkPc: url }],
  })
}

// 수강시작 안내 (자격증 수강생)
export function sendCourseStart(p: {
  phone: string; customerName: string; courseName: string; instructorName: string; period: string
}): Promise<KakaoResult> {
  return sendKakao('course_start', p.phone, {
    고객명: p.customerName, 과정명: p.courseName, 강사명: p.instructorName, 수강기간: p.period,
  })
}

// 문의접수 (고객) — phone 없으면 userId로 서버 조회
export function sendInquiryReceived(p: {
  phone?: string; userId?: string; customerName: string; title: string
}): Promise<KakaoResult> {
  return sendKakao('inquiry_received', p.phone || '', { 고객명: p.customerName, 문의제목: p.title }, { userId: p.userId })
}

// 문의답변 (고객) — 관리자가 타인에게 발송 → userId로 서버 조회
export function sendInquiryAnswered(p: {
  phone?: string; userId?: string; customerName: string; title: string
}): Promise<KakaoResult> {
  return sendKakao('inquiry_answered', p.phone || '', { 고객명: p.customerName, 문의제목: p.title }, { userId: p.userId })
}

// 환불완료 (고객) — 관리자가 타인에게 발송 → userId로 서버 조회
export function sendRefundComplete(p: {
  phone?: string; userId?: string; customerName: string; courseName: string; amount: string
}): Promise<KakaoResult> {
  return sendKakao('refund_complete', p.phone || '', {
    고객명: p.customerName, 강의명: p.courseName, 환불금액: p.amount,
  }, { userId: p.userId })
}

// 회원가입 환영 (고객)
export function sendWelcome(p: { phone: string; customerName: string }): Promise<KakaoResult> {
  return sendKakao('welcome', p.phone, { 고객명: p.customerName })
}

// 수료완료 (고객) — 강사 진도페이지는 비로그인이라 userId로 서버가 이름+번호 조회
export function sendCourseComplete(p: {
  phone?: string; userId?: string; customerName?: string; courseName: string
}): Promise<KakaoResult> {
  return sendKakao('course_complete', p.phone || '',
    { 고객명: p.customerName || '', 과정명: p.courseName }, { userId: p.userId })
}

// 수강 만료임박 (고객) — 주로 Cron에서 서버측 호출
export function sendExpirySoon(p: {
  phone: string; customerName: string; daysLeft: string; courseName: string; expiryDate: string
}): Promise<KakaoResult> {
  return sendKakao('expiry_soon', p.phone, {
    고객명: p.customerName, 남은일수: p.daysLeft, 강의명: p.courseName, 만료일: p.expiryDate,
  })
}
