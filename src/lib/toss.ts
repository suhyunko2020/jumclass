// 토스페이먼츠 SDK 래퍼
// - 관리자 설정(useSiteSettings)의 payment.clientKey를 사용
// - sessionStorage에 결제 대기 데이터(payment intent)를 저장 → /payment-success에서 복원
//
// 결제 흐름:
// 1) CheckoutPage에서 requestTossPayment() 호출
// 2) Toss 호스팅 결제창으로 리디렉트
// 3) 성공: /payment-success?paymentKey=&orderId=&amount=
// 4) 실패: /payment-fail?code=&message=&orderId=

import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk'

export interface TossPaymentIntent {
  orderId: string
  amount: number
  orderName: string
  userId: string             // 결제 의도를 만든 사용자 UID — 복원 시 현재 유저와 대조
  // 복원용 메타 (PaymentSuccessPage에서 enroll/서명저장/알림톡 처리에 사용)
  checkoutType: 'course' | 'service'
  courseId?: string
  tierIdx?: number
  days?: number
  assignedInstructorId?: string
  instructorId?: string
  serviceId?: string
  agreedKeys?: string[]
  certAgreement?: {
    name: string
    birthdate: string
    phone: string
    signatureDataUrl: string | null
  }
}

const INTENT_PREFIX = 'toss_intent:'

export function saveIntent(intent: TossPaymentIntent) {
  sessionStorage.setItem(INTENT_PREFIX + intent.orderId, JSON.stringify(intent))
}

export function loadIntent(orderId: string): TossPaymentIntent | null {
  try {
    const raw = sessionStorage.getItem(INTENT_PREFIX + orderId)
    return raw ? JSON.parse(raw) as TossPaymentIntent : null
  } catch {
    return null
  }
}

export function clearIntent(orderId: string) {
  sessionStorage.removeItem(INTENT_PREFIX + orderId)
}

// orderId 생성 — 강한 난수 사용 (예측 불가 보장)
// Toss 권장 형식: 영문/숫자/-/_ 조합, 6~64자
export function generateOrderId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `jum_${Date.now()}_${hex}`
}

export interface RequestPaymentArgs {
  clientKey: string
  customerKey?: string
  orderId: string
  orderName: string
  amount: number
  successUrl: string
  failUrl: string
  customerEmail?: string
  customerName?: string
}

export async function requestTossPayment(args: RequestPaymentArgs): Promise<void> {
  const toss = await loadTossPayments(args.clientKey)
  const payment = toss.payment({ customerKey: args.customerKey || ANONYMOUS })
  await payment.requestPayment({
    method: 'CARD',
    amount: { currency: 'KRW', value: args.amount },
    orderId: args.orderId,
    orderName: args.orderName,
    successUrl: args.successUrl,
    failUrl: args.failUrl,
    customerEmail: args.customerEmail,
    customerName: args.customerName,
  })
}
