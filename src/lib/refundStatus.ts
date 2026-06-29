// 환불 처리 판정 헬퍼.
// 환불은 enrollment를 직접 수정하지 않고, 환불 요청 문의(type='refund')에
// refundedAt이 채워졌는지로 판정한다. 결제건은 (강의 + 결제일)로 식별한다.
//
// 중요: 환불과 재신청은 별개다. 같은 강의를 환불한 뒤 같은 날 다시 결제하면
// (강의ID + 날짜) 키가 동일해 충돌하므로, 환불 처리 시각(refundedAt)과
// 결제 시각(enrolledAt)을 비교해 "그 결제건보다 나중에 처리된 환불"만 매칭한다.
// 즉 환불 후 새로 한 결제(enrolledAt > refundedAt)는 환불로 보지 않는다.

import type { Inquiry, Enrollment } from '../data/types'

export interface RefundRecord {
  courseId: string
  orderDate: string   // 환불 대상 결제일 — toLocaleDateString('ko-KR')
  refundedAt: string  // 환불 처리 시각 (ISO)
}

// 환불 완료(refundedAt 존재)된 환불 문의들을 레코드 배열로 만든다.
export function refundRecords(inquiries: Inquiry[]): RefundRecord[] {
  const records: RefundRecord[] = []
  for (const q of inquiries) {
    if (q.type === 'refund' && q.refundedAt && q.metadata?.courseId) {
      records.push({
        courseId: q.metadata.courseId,
        orderDate: q.metadata.orderDate ?? '',
        refundedAt: q.refundedAt,
      })
    }
  }
  return records
}

// 특정 enrollment가 환불 처리됐는지 여부.
// (강의 + 결제일)이 일치하면서, 그 결제(enrolledAt) 이후에 처리된 환불이 있으면 환불된 것.
// 환불보다 나중에 한 재결제는 매칭되지 않아 정상적으로 "수강 중"으로 남는다.
export function isEnrollmentRefunded(
  courseId: string, enrolledAt: string, records: RefundRecord[],
): boolean {
  const orderDate = new Date(enrolledAt).toLocaleDateString('ko-KR')
  const enrolledTime = new Date(enrolledAt).getTime()
  return records.some(r =>
    r.courseId === courseId &&
    r.orderDate === orderDate &&
    new Date(r.refundedAt).getTime() >= enrolledTime,
  )
}

// 환불 판정용 enrollment 키 (강의 + 결제일).
export function refundedKey(courseId: string, enrolledAt: string): string {
  return `${courseId}:${new Date(enrolledAt).toLocaleDateString('ko-KR')}`
}

// 환불된 모든 결제건의 키 집합을 만든다.
// 자격증이 환불되면, 그 자격증에 묶여 무료 제공된 인터넷강의도 함께 환불된 것으로 본다
// (묶음 강의는 별도 환불 레코드가 없으므로 부모 자격증의 환불 여부로 판정).
// 재결제분(환불 처리 시각 이후 등록)은 제외해 정상 노출되도록 한다.
export function buildRefundedKeys(
  enrollments: Enrollment[], records: RefundRecord[],
): Set<string> {
  const keys = new Set<string>()
  // 1) 직접 환불된 결제건
  for (const e of enrollments) {
    if (isEnrollmentRefunded(e.courseId, e.enrolledAt, records)) {
      keys.add(refundedKey(e.courseId, e.enrolledAt))
    }
  }
  // 2) 환불된 자격증에 묶여 제공된 무료 강의도 함께 환불 처리
  for (const cert of enrollments) {
    if (!cert.bundled?.length) continue
    const certDate = new Date(cert.enrolledAt).toLocaleDateString('ko-KR')
    const certTime = new Date(cert.enrolledAt).getTime()
    const rec = records.find(r =>
      r.courseId === cert.courseId &&
      r.orderDate === certDate &&
      new Date(r.refundedAt).getTime() >= certTime,
    )
    if (!rec) continue
    const refundTime = new Date(rec.refundedAt).getTime()
    for (const b of cert.bundled) {
      for (const e of enrollments) {
        if (e.courseId !== b.courseId) continue
        // 자격증 환불 처리 시각 이후의 재결제분은 제외
        if (new Date(e.enrolledAt).getTime() > refundTime) continue
        // 자격증과 같은 등록 시점(같은 날 일괄 등록)에 제공된 강의만 매칭
        if (new Date(e.enrolledAt).toLocaleDateString('ko-KR') !== certDate) continue
        keys.add(refundedKey(e.courseId, e.enrolledAt))
      }
    }
  }
  return keys
}
