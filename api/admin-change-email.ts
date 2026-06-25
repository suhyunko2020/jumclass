// Vercel Edge Runtime
// 관리자 — 회원 이메일(로그인 ID) 변경.
// 이메일은 Supabase Auth 인증 정보라 service_role Admin API로만 바꿀 수 있다.
// 호출자가 admin_users에 등록된 관리자인지 access token으로 검증한 뒤,
// auth.users + profiles 이메일을 함께 변경한다. (확인 메일 없이 즉시 — email_confirm)
//
// 요청 (POST /api/admin-change-email):
//   헤더: Authorization: Bearer <관리자 access token>
//   바디: { userId, email }
//
// 필수 환경 변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

export const config = { runtime: 'edge' }

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method-not-allowed' })

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { ok: false, error: '서버 설정 누락' })
  const svcHeaders = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }

  // 1) 호출자 관리자 검증 — Authorization 토큰의 주인이 admin_users에 있는지 확인
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json(401, { ok: false, error: '인증 토큰이 없습니다.' })

  const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${token}` },
  })
  if (!meRes.ok) return json(401, { ok: false, error: '유효하지 않은 세션입니다.' })
  const me = await meRes.json().catch(() => null)
  const adminUid = me?.id
  if (!adminUid) return json(401, { ok: false, error: '유효하지 않은 세션입니다.' })

  const chkRes = await fetch(`${SUPABASE_URL}/rest/v1/admin_users?user_id=eq.${adminUid}&select=user_id`, { headers: svcHeaders })
  const chkRows = await chkRes.json().catch(() => [])
  if (!Array.isArray(chkRows) || chkRows.length === 0) return json(403, { ok: false, error: '관리자 권한이 없습니다.' })

  // 2) 입력 검증
  let body: { userId?: string; email?: string }
  try { body = await req.json() } catch { return json(400, { ok: false, error: '잘못된 요청' }) }
  const userId = String(body.userId || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  if (!userId) return json(400, { ok: false, error: '대상 회원이 지정되지 않았습니다.' })
  if (!EMAIL_RE.test(email)) return json(400, { ok: false, error: '이메일 형식이 올바르지 않습니다.' })

  // 3) auth.users 이메일 변경 (확인 메일 없이 즉시 확정)
  const updRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: { ...svcHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, email_confirm: true }),
  })
  if (!updRes.ok) {
    const e = await updRes.json().catch(() => ({})) as Record<string, string>
    const msg = e?.msg || e?.error_description || e?.message || ''
    // 이미 사용 중인 이메일 등
    return json(400, { ok: false, error: msg.includes('registered') || msg.includes('exists') ? '이미 사용 중인 이메일입니다.' : (msg || '이메일 변경 실패') })
  }

  // 4) profiles 이메일도 동기화 (어드민 목록/표시용)
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { ...svcHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ email }),
  }).catch(() => { /* 프로필 동기화 실패는 치명적이지 않음 */ })

  return json(200, { ok: true })
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
