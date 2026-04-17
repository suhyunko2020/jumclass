// 알림톡 발송 — 서버리스 함수(/api/send-alimtalk) 호출
// 실패해도 결제/업무 플로우는 계속 진행되도록 설계 (throw 하지 않음)

export interface AlimtalkPayload {
  phone: string           // 강사 연락처 (01012345678 등)
  instructorName: string
  studentName: string
  courseName: string
  coursePeriod: string    // "3개월" / "4개월" 등
  token: string           // 진도 관리 페이지 토큰
}

export interface AlimtalkResult {
  ok: boolean
  reason?: string         // not-configured / bizm-error / bizm-failed / fetch-failed / missing-fields ...
  message?: string
  bizmCode?: string | number
  bizmMessage?: string | null
}

export async function sendInstructorAlimtalk(p: AlimtalkPayload): Promise<AlimtalkResult> {
  if (!p.phone) return { ok: false, reason: 'missing-phone' }
  try {
    const res = await fetch('/api/send-alimtalk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json().catch(() => null) as any
    if (!res.ok || data?.ok === false) {
      return {
        ok: false,
        reason: data?.reason || `http-${res.status}`,
        message: data?.message,
        bizmCode: data?.bizmCode,
        bizmMessage: data?.bizmMessage,
      }
    }
    return data ?? { ok: true }
  } catch (err) {
    return {
      ok: false,
      reason: 'network-error',
      message: err instanceof Error ? err.message : String(err),
    }
  }
}
