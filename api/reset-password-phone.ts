// Vercel Edge Runtime
// 비밀번호 재설정 (휴대폰 인증 기반) — 알림톡/SMS OTP로 본인 확인 후 새 비밀번호로 변경
//
// 플로우:
//  1) /api/sms-otp-send   { phone }            → 알림톡(ATA, 실패 시 SMS) 인증번호 발송
//  2) /api/sms-otp-verify { phone, code }      → 인증번호 검증 (phone_verifications.verified_at 기록)
//  3) /api/reset-password-phone { phone, newPassword }
//       → 최근(15분 내) 인증 완료된 휴대폰인지 확인 후 비밀번호 변경
//
// 응답:
//  성공: 200 { ok: true }
//  실패: 400/410/500 { ok: false, code, message }
//
// 필수 환경 변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

export const config = { runtime: 'edge' }

// 인증 완료 후 비밀번호 변경까지 허용되는 시간 (새 비밀번호 입력은 보통 수 초 내)
const VERIFY_WINDOW_MS = 15 * 60 * 1000

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('82')) return '0' + digits.slice(2)
  return digits
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false, code: 'METHOD_NOT_ALLOWED' })

  let body: { phone?: string; newPassword?: string }
  try { body = await req.json() } catch { return json(400, { ok: false, code: 'INVALID_JSON' }) }

  const phone = normalizePhone(body.phone || '')
  const newPassword = body.newPassword || ''

  if (!phone || !newPassword) {
    return json(400, { ok: false, code: 'MISSING_PARAMS', message: 'phone, newPassword가 모두 필요합니다.' })
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

  // 1) 최근 인증 완료된 휴대폰인지 확인 — verified_at 이 채워진 최신 레코드
  const vRes = await fetch(
    `${SUPABASE_URL}/rest/v1/phone_verifications?phone=eq.${phone}&verified_at=not.is.null&order=verified_at.desc&limit=1&select=id,verified_at`,
    { headers: authHeaders }
  )
  if (!vRes.ok) return json(500, { ok: false, code: 'DB_LOOKUP_FAILED' })
  const vRows = await vRes.json().catch(() => [])
  if (!Array.isArray(vRows) || vRows.length === 0) {
    return json(400, { ok: false, code: 'NOT_VERIFIED', message: '휴대폰 인증을 먼저 완료해주세요.' })
  }
  const verifiedAt = new Date(vRows[0].verified_at).getTime()
  if (Date.now() - verifiedAt > VERIFY_WINDOW_MS) {
    return json(410, { ok: false, code: 'VERIFY_EXPIRED', message: '인증 유효시간이 지났습니다. 처음부터 다시 진행해주세요.' })
  }

  // 2) 휴대폰 → userId (profiles.phone)
  const profRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?phone=eq.${phone}&select=id&limit=1`,
    { headers: authHeaders }
  )
  if (!profRes.ok) return json(500, { ok: false, code: 'PROFILE_LOOKUP_FAILED' })
  const profRows = await profRes.json().catch(() => [])
  if (!Array.isArray(profRows) || profRows.length === 0) {
    return json(400, { ok: false, code: 'USER_NOT_FOUND', message: '이 번호로 가입된 계정을 찾을 수 없습니다.' })
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

  // 4) 재사용 방지 — 사용한 인증 레코드 소비 (verified_at 을 과거로 밀어 윈도우 차단)
  await fetch(`${SUPABASE_URL}/rest/v1/phone_verifications?id=eq.${vRows[0].id}`, {
    method: 'PATCH',
    headers: { ...authHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ verified_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }),
  }).catch(() => { /* 소비 실패는 치명적이지 않음 */ })

  return json(200, { ok: true })
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
