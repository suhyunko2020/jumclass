// 관리자 알림(문자) — 결제/문의 발생 시 /api/notify-admin 호출. fire-and-forget, 실패 무시.
type AdminNotify =
  | { kind: 'payment'; customerName: string; courseTitle: string; amount: string }
  | { kind: 'inquiry'; customerName: string; subject?: string; content: string }

export function notifyAdmin(payload: AdminNotify): void {
  try {
    if (import.meta.env.DEV) return  // 로컬은 /api 없음
    fetch('/api/notify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => { /* 무시 */ })
  } catch { /* 무시 */ }
}
