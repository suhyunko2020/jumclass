// 접속 로그 클라이언트 — /api/log-event를 fire-and-forget로 호출.
// IP/위치/기기는 서버(Edge)에서 헤더로 수집하므로 여기선 식별/맥락 정보만 전달한다.
// 로깅 실패는 절대 사용자 흐름을 막지 않는다(전부 무시).

// lesson_breach = 비결제자가 잠긴 강의를 실제 재생하는 비정상 접근(구조적 결함/우회) — 정상이면 0건
type LogEvent = 'login' | 'signup' | 'course_view' | 'lesson_view' | 'lesson_preview' | 'lesson_breach'

interface LogPayload {
  event: LogEvent
  userId?: string
  userName?: string
  userEmail?: string
  courseId?: string
  courseTitle?: string
  lessonId?: string
  lessonTitle?: string
}

// 같은 강의 조회가 짧은 시간에 중복 기록되는 것을 방지(과도한 로그 억제)
const recent = new Map<string, number>()
const DEDUPE_MS = 60 * 1000

export function logAccess(payload: LogPayload): void {
  try {
    // 로컬 개발에서는 /api가 없어 동작하지 않으므로 생략
    if (import.meta.env.DEV) return

    // lesson 단위로 중복 억제 (강의별로 따로 기록되도록 lessonId 포함)
    const key = `${payload.event}|${payload.userId || 'anon'}|${payload.courseId || ''}|${payload.lessonId || ''}`
    const now = Date.now()
    const last = recent.get(key)
    if (last && now - last < DEDUPE_MS) return
    recent.set(key, now)

    // path에 쿼리스트링까지 포함 → 어느 강의(lesson)에 접근했는지 경로로도 확인 가능
    const body = JSON.stringify({ ...payload, path: window.location.pathname + window.location.search })

    // sendBeacon 우선(페이지 이탈에도 안전), 실패 시 fetch keepalive
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon('/api/log-event', new Blob([body], { type: 'application/json' }))
      if (ok) return
    }
    fetch('/api/log-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => { /* 무시 */ })
  } catch { /* 무시 */ }
}
