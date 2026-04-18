// Vercel Edge Runtime
// 휴대폰 인증번호 검증
//
// 요청 (POST /api/sms-otp-verify):
// { phone: string, code: string }
//
// 응답:
// 성공: 200 { ok: true, verified: true, verifiedAt }
// 실패: 400/410/500 { ok: false, code, message }

export const config = { runtime: 'edge' }

function normalizePhone(phone: string): string {
  // send 엔드포인트와 동일하게 국내 0-prefix 형식(01012345678)으로 정규화
  // DB의 phone 컬럼도 같은 포맷으로 저장되어 있어야 매칭됨
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('82')) return '0' + digits.slice(2)
  return digits
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false, code: 'METHOD_NOT_ALLOWED' })

  let body: { phone?: string; code?: string }
  try { body = await req.json() } catch { return json(400, { ok: false, code: 'INVALID_JSON' }) }

  const rawPhone = (body.phone || '').trim()
  const inputCode = (body.code || '').trim()
  if (!rawPhone || !inputCode) {
    return json(400, { ok: false, code: 'MISSING_PARAMS', message: 'phone, code 둘 다 필요합니다.' })
  }
  if (!/^\d{6}$/.test(inputCode)) {
    return json(400, { ok: false, code: 'INVALID_CODE_FORMAT', message: '인증번호는 6자리 숫자입니다.' })
  }

  const phone = normalizePhone(rawPhone)

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json(500, { ok: false, code: 'SUPABASE_MISSING_ENV' })
  }

  // 해당 번호의 가장 최근 미인증 레코드 조회
  const lookupRes = await fetch(
    `${SUPABASE_URL}/rest/v1/phone_verifications?phone=eq.${phone}&verified_at=is.null&order=created_at.desc&limit=1&select=id,code_hash,expires_at`,
    { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
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

  const expectedHash = await sha256Hex(inputCode + ':' + phone)
  if (expectedHash !== row.code_hash) {
    return json(400, { ok: false, code: 'CODE_MISMATCH', message: '인증번호가 일치하지 않습니다.' })
  }

  // verified_at 갱신
  const verifiedAt = new Date().toISOString()
  const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/phone_verifications?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ verified_at: verifiedAt }),
  })
  if (!updateRes.ok) return json(500, { ok: false, code: 'DB_UPDATE_FAILED' })

  return json(200, { ok: true, verified: true, verifiedAt })
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
