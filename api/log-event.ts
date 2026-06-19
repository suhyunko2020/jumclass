// Vercel Edge Runtime
// 사용자 접속 로그 기록 — 서버에서 IP/위치/기기를 수집해 access_logs에 저장(service role).
// 클라이언트는 fire-and-forget로 호출하며, 실패해도 사용자 경험에 영향 없음.
//
// 요청 (POST /api/log-event):
// { event: 'login'|'signup'|'course_view'|'lesson_view'|'lesson_preview',
//   userId?, userName?, userEmail?, courseId?, courseTitle?, path? }
//
// 응답: 200 { ok: true } / 실패 시에도 가볍게 처리
//
// 필수 환경 변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

export const config = { runtime: 'edge' }

const ALLOWED_EVENTS = ['login', 'signup', 'course_view', 'lesson_view', 'lesson_preview']

// User-Agent 간이 파싱 — 기기 유형/OS/브라우저
function parseUA(ua: string): { device: string; os: string; browser: string } {
  const u = ua.toLowerCase()
  const isTablet = /ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(u)
  const isMobile = /mobile|iphone|ipod|android|blackberry|opera mini|iemobile/.test(u)
  const device = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop'

  let os = '기타'
  if (/windows nt/.test(u)) os = 'Windows'
  else if (/iphone|ipad|ipod/.test(u)) os = 'iOS'
  else if (/mac os x/.test(u)) os = 'macOS'
  else if (/android/.test(u)) os = 'Android'
  else if (/linux/.test(u)) os = 'Linux'

  let browser = '기타'
  if (/edg\//.test(u)) browser = 'Edge'
  else if (/whale/.test(u)) browser = 'Whale'
  else if (/samsungbrowser/.test(u)) browser = 'Samsung'
  else if (/kakaotalk/.test(u)) browser = 'KakaoTalk'
  else if (/naver|naver\(inapp/.test(u)) browser = 'Naver'
  else if (/chrome\//.test(u)) browser = 'Chrome'
  else if (/firefox\//.test(u)) browser = 'Firefox'
  else if (/safari\//.test(u)) browser = 'Safari'

  return { device, os, browser }
}

function decode(v: string | null): string {
  if (!v) return ''
  try { return decodeURIComponent(v) } catch { return v }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false })

  let body: Record<string, string>
  try { body = await req.json() } catch { return json(200, { ok: false }) }

  const event = (body.event || '').trim()
  if (!ALLOWED_EVENTS.includes(event)) return json(200, { ok: false })

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) return json(200, { ok: false })

  const h = req.headers
  // 클라이언트 IP — x-forwarded-for의 첫 번째가 원 IP
  const ip = (h.get('x-forwarded-for') || h.get('x-real-ip') || '').split(',')[0].trim()
  const country = decode(h.get('x-vercel-ip-country'))
  const city = decode(h.get('x-vercel-ip-city'))
  const ua = h.get('user-agent') || ''
  const { device, os, browser } = parseUA(ua)

  const row = {
    user_id: body.userId || null,
    user_name: body.userName || null,
    user_email: body.userEmail || null,
    event,
    course_id: body.courseId || null,
    course_title: body.courseTitle || null,
    path: body.path || null,
    ip: ip || null,
    country: country || null,
    city: city || null,
    device,
    os,
    browser,
    user_agent: ua.slice(0, 500) || null,
  }

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/access_logs`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(row),
    })
  } catch { /* 기록 실패는 무시 */ }

  return json(200, { ok: true })
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
