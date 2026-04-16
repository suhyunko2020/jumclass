// ── 포맷 유틸리티 ──────────────────────────────────────────
export const formatPrice = (n: number) => '₩' + n.toLocaleString('ko-KR');

export const discountRate = (orig: number, price: number) => {
  if (!orig || orig <= 0) return 0;
  return Math.round((1 - price / orig) * 100);
};

// 9999일 이상이면 "무제한 시청"
export const formatDays = (days: number) =>
  days >= 9999 ? '무제한 시청' : `${days}일 수강 기간`;

export const formatDaysShort = (days: number) =>
  days >= 9999 ? '무제한' : `${days}일 수강`;

export function maskName(name: string): string {
  if (!name) return ''
  const isKorean = /[가-힣]/.test(name.charAt(0))
  if (isKorean) {
    if (name.length <= 1) return name
    return name.charAt(0) + '*'.repeat(name.length - 1)
  }
  if (name.length <= 2) return name
  return name.slice(0, 2) + '*'.repeat(name.length - 2)
}

export function calcRefund(
  course: { badge: string; price: number },
  enrollment: { enrolledAt: string; expiryDate: string; completedLessons?: string[] },
  totalLessons: number
): { refundable: boolean; refundAmount: number; penalty: number; reason: string } {
  const price = course.price
  const penalty10 = Math.round(price * 0.1)
  const enrollDate = new Date(enrollment.enrolledAt)
  const expiryDate = new Date(enrollment.expiryDate)
  const now = new Date()
  const daysSinceEnroll = Math.floor((now.getTime() - enrollDate.getTime()) / 86400000)
  const totalDays = Math.floor((expiryDate.getTime() - enrollDate.getTime()) / 86400000)
  const completedCount = enrollment.completedLessons?.length ?? 0
  const isCert = course.badge === '자격증'

  if (isCert) {
    const oneThird = totalDays / 3
    const half = totalDays / 2
    if (completedCount === 0) {
      return { refundable: true, refundAmount: price - penalty10, penalty: penalty10, reason: '강습 시작 전 — 전액 환불 (위약금 10% 별도)' }
    }
    if (daysSinceEnroll < oneThird) {
      const amount = Math.round(price * 2 / 3)
      return { refundable: true, refundAmount: amount - penalty10, penalty: penalty10, reason: '총 강습 기간의 1/3 경과 전 — 수강료의 2/3 환불 (위약금 10% 별도)' }
    }
    if (daysSinceEnroll < half) {
      const amount = Math.round(price / 2)
      return { refundable: true, refundAmount: amount - penalty10, penalty: penalty10, reason: '총 강습 기간의 1/2 경과 전 — 수강료의 1/2 환불 (위약금 10% 별도)' }
    }
    return { refundable: false, refundAmount: 0, penalty: 0, reason: '총 강습 기간의 1/2 경과 후 — 환불 불가' }
  }

  // 인터넷 강의
  const halfPeriod = totalDays / 2
  if (completedCount === 0) {
    return { refundable: true, refundAmount: price - penalty10, penalty: penalty10, reason: '수강 시작 전 — 전액 환불 (위약금 10% 별도)' }
  }
  if (daysSinceEnroll <= 7 && completedCount <= 2) {
    const amount = Math.round(price * 0.9)
    return { refundable: true, refundAmount: amount - penalty10, penalty: penalty10, reason: '수강 시작 후 7일 이내 (2강 이하) — 90% 환불 (위약금 10% 별도)' }
  }
  if (daysSinceEnroll <= halfPeriod) {
    const watched = Math.round((completedCount / totalLessons) * price)
    const amount = price - watched
    return { refundable: true, refundAmount: Math.max(0, amount - penalty10), penalty: penalty10, reason: `수강 시작 후 7일 이후 (기간 1/2 이하) — 수강한 강의 공제 후 환불 (위약금 10% 별도)` }
  }
  return { refundable: false, refundAmount: 0, penalty: 0, reason: '수강 기간의 1/2 초과 — 환불 불가' }
}
