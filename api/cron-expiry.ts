// Vercel Cron — 수강 만료임박 알림톡 (매일 1회)
// 만료 D-3 인 수강건을 찾아 고객에게 expiry_soon 알림톡 발송.
// 매일 실행 → 각 수강건은 "남은 3일"인 날 정확히 1회만 발송됨(별도 마커 불필요).
//
// vercel.json crons에 등록. 보안: CRON_SECRET 설정 시 Authorization 헤더 검증.
// 필수 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_ORIGIN
//                + SOLAPI_* (send-kakao 경유)

export const config = { runtime: 'edge' }

const NOTIFY_DAYS_BEFORE = 3   // 만료 며칠 전에 보낼지
const DAY_MS = 86400000

export default async function handler(req: Request): Promise<Response> {
  // Cron 보안 — CRON_SECRET이 설정돼 있으면 일치해야 실행
  const CRON_SECRET = process.env.CRON_SECRET
  if (CRON_SECRET) {
    const auth = req.headers.get('authorization') || ''
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return json(401, { ok: false, code: 'UNAUTHORIZED' })
    }
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://jumclass.com'
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json(500, { ok: false, code: 'SUPABASE_MISSING_ENV' })
  }

  const sb = (path: string) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })

  // 1) 만료가 (NOTIFY_DAYS_BEFORE - 1)일 ~ NOTIFY_DAYS_BEFORE일 사이에 남은 수강건 조회
  const now = Date.now()
  const lo = new Date(now + (NOTIFY_DAYS_BEFORE - 1) * DAY_MS).toISOString()
  const hi = new Date(now + NOTIFY_DAYS_BEFORE * DAY_MS).toISOString()
  let enrollments: Array<Record<string, unknown>> = []
  try {
    const res = await sb(
      `enrollments?select=user_id,course_id,expiry_date,paused,type&paused=eq.false&expiry_date=gte.${lo}&expiry_date=lte.${hi}`,
    )
    enrollments = await res.json().catch(() => [])
  } catch {
    return json(502, { ok: false, code: 'ENROLLMENTS_QUERY_FAILED' })
  }
  if (!Array.isArray(enrollments) || enrollments.length === 0) {
    return json(200, { ok: true, sent: 0, message: '만료 임박 수강건 없음' })
  }

  // 2) 강의 제목 맵 — custom_courses.data.title (+ course_overrides.data.title 우선)
  const titleMap: Record<string, string> = {}
  try {
    const [customRes, overrideRes] = await Promise.all([
      sb('custom_courses?select=id,data'),
      sb('course_overrides?select=course_id,data'),
    ])
    const custom = await customRes.json().catch(() => [])
    const overrides = await overrideRes.json().catch(() => [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const c of (custom as any[])) {
      if (c?.id && c?.data?.title) titleMap[c.id] = c.data.title
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const o of (overrides as any[])) {
      if (o?.course_id && o?.data?.title) titleMap[o.course_id] = o.data.title
    }
  } catch { /* 제목 없으면 '수강 강의'로 폴백 */ }

  // 3) 대상 회원 프로필(이름/전화) 조회
  const userIds = [...new Set(enrollments.map(e => String(e.user_id)))]
  const profileMap: Record<string, { name: string; phone: string }> = {}
  try {
    const inList = userIds.map(id => `"${id}"`).join(',')
    const res = await sb(`profiles?select=id,name,phone&id=in.(${inList})`)
    const rows = await res.json().catch(() => [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of (rows as any[])) {
      profileMap[p.id] = { name: p.name ?? '고객', phone: p.phone ?? '' }
    }
  } catch {
    return json(502, { ok: false, code: 'PROFILES_QUERY_FAILED' })
  }

  // 4) 각 건에 대해 expiry_soon 발송 (send-kakao 경유)
  let sent = 0
  const fails: unknown[] = []
  for (const e of enrollments) {
    const prof = profileMap[String(e.user_id)]
    if (!prof?.phone) continue
    const expiryMs = new Date(String(e.expiry_date)).getTime()
    const daysLeft = Math.max(1, Math.ceil((expiryMs - now) / DAY_MS))
    const expiryDate = new Date(expiryMs).toLocaleDateString('ko-KR')
    const courseName = titleMap[String(e.course_id)] || '수강 강의'
    try {
      const r = await fetch(`${SITE_ORIGIN}/api/send-kakao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'expiry_soon',
          to: prof.phone,
          variables: { 고객명: prof.name, 남은일수: String(daysLeft), 강의명: courseName, 만료일: expiryDate },
        }),
      })
      if (r.ok) sent++
      else fails.push(await r.json().catch(() => ({ status: r.status })))
    } catch (err) {
      fails.push({ error: err instanceof Error ? err.message : String(err) })
    }
  }

  return json(200, { ok: true, sent, total: enrollments.length, fails })
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
