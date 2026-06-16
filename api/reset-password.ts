// Vercel Edge Runtime
// 비밀번호 재설정 — 이메일 인증번호 검증 후 새 비밀번호로 변경
//
// 요청 (POST /api/reset-password):
// { email: string, code: string, newPassword: string }
//
// 응답:
// 성공: 200 { ok: true }
// 실패: 400/410/500 { ok: false, code, message }
//
// 필수 환경 변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

export const config = { runtime: 'edge' }

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false, code: 'METHOD_NOT_ALLOWED' })

  let body: { email?: string; code?: string; newPassword?: string }
  try { body = await req.json() } catch { return json(400, { ok: false, code: 'INVALID_JSON' }) }

  const email = normalizeEmail(body.email || '')
  const code = (body.code || '').trim()
  const newPassword = body.newPassword || ''

  if (!email || !code || !newPassword) {
    return json(400, { ok: false, code: 'MISSING_PARAMS', message: 'email, code, newPassword가 모두 필요합니다.' })
  }
  if (!/^\d{6}$/.test(code)) {
    return json(400, { ok: false, code: 'INVALID_CODE_FORMAT', message: '인증번호는 6자리 숫자입니다.' })
  }
  if (newPassword.length < 6) {
    return json(400, { ok: false, code: 'WEAK_PASSWORD', message: '비밀번호는 6자 이상이어야 합니다.' })
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json(500, { ok: false, code: 'SUPABASE_MISSING_ENV' })
  }
  const authHeaders = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }

  // 1) 인증번호 검증 — 해당 이메일의 최근 미사용 코드
  const lookupRes = await fetch(
    `${SUPABASE_URL}/rest/v1/email_verifications?email=eq.${encodeURIComponent(email)}&verified_at=is.null&order=created_at.desc&limit=1&select=id,code_hash,expires_at`,
    { headers: authHeaders }
  )
  if (!lookupRes.ok) return json(500, { ok: false, code: 'DB_LOOKUP_FAILED' })
  const rows = await lookupRes.json().catch(() => [])
  if (!Array.isArray(rows) || rows.length === 0) {
    return json(400, { ok: false, code: 'NO_PENDING_CODE', message: '인증번호를 먼저 요청해주세요.' })
  }
  const row = rows[0]
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return json(410, { ok: false, code: 'EXPIRED', message: '인증번호가 만료되었습니다. 다시 요청해주세요.' })
  }
  const expectedHash = await sha256Hex(code + ':' + email)
  if (expectedHash !== row.code_hash) {
    return json(400, { ok: false, code: 'CODE_MISMATCH', message: '인증번호가 일치하지 않습니다.' })
  }

  // 2) 이메일 → userId (profiles.id = auth.users.id)
  const profRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
    { headers: authHeaders }
  )
  if (!profRes.ok) return json(500, { ok: false, code: 'PROFILE_LOOKUP_FAILED' })
  const profRows = await profRes.json().catch(() => [])
  if (!Array.isArray(profRows) || profRows.length === 0) {
    return json(400, { ok: false, code: 'USER_NOT_FOUND', message: '가입된 계정을 찾을 수 없습니다.' })
  }
  const userId = profRows[0].id

  // 3) Supabase Admin API로 비밀번호 변경
  const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: newPassword }),
  })
  if (!updateRes.ok) {
    const msg = await updateRes.text().catch(() => '')
    return json(500, { ok: false, code: 'PASSWORD_UPDATE_FAILED', message: `비밀번호 변경 실패: ${msg}` })
  }

  // 4) 사용한 인증번호 소비 (verified_at 기록)
  await fetch(`${SUPABASE_URL}/rest/v1/email_verifications?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { ...authHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ verified_at: new Date().toISOString() }),
  }).catch(() => { /* 소비 실패는 치명적이지 않음 */ })

  return json(200, { ok: true })
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
