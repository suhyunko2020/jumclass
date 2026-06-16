// 환불 처리 판정 헬퍼.
// 환불은 enrollment를 직접 수정하지 않고, 환불 요청 문의(type='refund')에
// refundedAt이 채워졌는지로 판정한다. 결제건은 (강의 + 결제일)로 식별한다.

import type { Inquiry } from '../data/types'

// enrollment 한 건을 식별하는 키 — 환불 문의의 metadata(courseId, orderDate)와 매칭된다.
// orderDate는 MyPage에서 환불 요청 시 toLocaleDateString('ko-KR')로 저장되므로 동일 포맷 사용.
export function enrollmentRefundKey(courseId: string, enrolledAt: string): string {
  return `${courseId}__${new Date(enrolledAt).toLocaleDateString('ko-KR')}`
}

// 환불 완료(refundedAt 존재)된 환불 문의들의 결제건 키 집합을 만든다.
export function refundedKeySet(inquiries: Inquiry[]): Set<string> {
  const set = new Set<string>()
  for (const q of inquiries) {
    if (q.type === 'refund' && q.refundedAt && q.metadata?.courseId) {
      set.add(`${q.metadata.courseId}__${q.metadata.orderDate ?? ''}`)
    }
  }
  return set
}

// 특정 enrollment가 환불 처리됐는지 여부.
export function isEnrollmentRefunded(
  courseId: string, enrolledAt: string, refundedSet: Set<string>,
): boolean {
  return refundedSet.has(enrollmentRefundKey(courseId, enrolledAt))
}
