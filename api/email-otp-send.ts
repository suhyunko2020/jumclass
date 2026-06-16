// Vercel Edge Runtime
// 비밀번호 재설정 — 이메일로 6자리 인증번호 발송 (Resend REST API)
//
// 요청 (POST /api/email-otp-send):
// { email: string }
//
// 응답:
// 성공: 200 { ok: true, sentAt, devCode? }
//   - 가입되지 않은 이메일이어도 200 { ok: true }로 응답 (계정 존재 여부 노출 방지)
// 실패: 400/429/500 { ok: false, code, message }
//
// 필수 환경 변수:
// - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  → profiles 조회 + email_verifications 저장
// - RESEND_API_KEY                            → Resend API Key
// - RESEND_FROM (선택)                        → 발신 주소 (예: "JUMCLASS <noreply@primemuse.com>")
// - DEV_OTP_ECHO (선택)                       → "true"면 응답에 devCode 포함

export const config = { runtime: 'edge' }

const CODE_TTL_MS = 5 * 60 * 1000       // 5분
const RESEND_COOLDOWN_MS = 60 * 1000    // 60초 재전송 쿨다운
const RESEND_SEND_URL = 'https://api.resend.com/emails'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function gen6DigitCode(): string {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return String(100000 + (buf[0] % 900000))
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return bytesToHex(new Uint8Array(buf))
}

function buildEmailHtml(code: string): string {
  return `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a2e">
    <h2 style="font-size:20px;margin:0 0 8px">비밀번호 재설정 인증번호</h2>
    <p style="color:#555;line-height:1.6;margin:0 0 24px">
      아래 인증번호를 입력해 비밀번호를 재설정해주세요.<br/>인증번호는 5분간 유효합니다.
    </p>
    <div style="font-size:32px;font-weight:800;letter-spacing:8px;text-align:center;
                background:#f4f3fb;border-radius:12px;padding:20px;color:#5742c9">
      ${code}
    </div>
    <p style="color:#999;font-size:13px;margin:24px 0 0;line-height:1.6">
      본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.<br/>— JUMCLASS
    </p>
  </div>`
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false, code: 'METHOD_NOT_ALLOWED' })

  let body: { email?: string }
  try { body = await req.json() } catch { return json(400, { ok: false, code: 'INVALID_JSON' }) }

  const rawEmail = (body.email || '').trim()
  if (!rawEmail || !isValidEmail(rawEmail)) {
    return json(400, { ok: false, code: 'INVALID_EMAIL', message: '올바른 이메일 형식이 아닙니다.' })
  }
  const email = normalizeEmail(rawEmail)

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json(500, { ok: false, code: 'SUPABASE_MISSING_ENV', message: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.' })
  }

  // 1) 가입된 이메일인지 확인 — 미가입이면 발송하지 않되, 응답은 동일하게 200 (열거 방지)
  let isMember = false
  try {
    const lookupRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    )
    if (lookupRes.ok) {
      const rows = await lookupRes.json().catch(() => [])
      isMember = Array.isArray(rows) && rows.length > 0
    }
  } catch { /* 조회 실패 시 아래에서 발송 안 됨 */ }

  if (!isMember) {
    // 계정 존재 여부를 숨기기 위해 성공처럼 응답 (실제 발송은 안 함)
    return json(200, { ok: true, sentAt: new Date().toISOString() })
  }

  // 2) Rate limit — 같은 이메일로 60초 내 재요청 차단
  try {
    const recentRes = await fetch(
      `${SUPABASE_URL}/rest/v1/email_verifications?email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1&select=created_at`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    )
    if (recentRes.ok) {
      const rows = await recentRes.json().catch(() => [])
      if (Array.isArray(rows) && rows.length > 0) {
        const delta = Date.now() - new Date(rows[0].created_at).getTime()
        if (delta < RESEND_COOLDOWN_MS) {
          const wait = Math.ceil((RESEND_COOLDOWN_MS - delta) / 1000)
          return json(429, { ok: false, code: 'TOO_SOON', message: `${wait}초 후 다시 시도해주세요.` })
        }
      }
    }
  } catch { /* rate limit 조회 실패는 무시 */ }

  // 3) 코드 생성 및 해시 저장
  const code = gen6DigitCode()
  const codeHash = await sha256Hex(code + ':' + email)
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString()

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/email_verifications`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ email, code_hash: codeHash, expires_at: expiresAt }),
  })
  if (!insertRes.ok) {
    const msg = await insertRes.text().catch(() => '')
    return json(500, { ok: false, code: 'INSERT_FAILED', message: `DB 저장 실패: ${msg}` })
  }

  // 4) Resend로 이메일 발송
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const RESEND_FROM = process.env.RESEND_FROM || 'JUMCLASS <onboarding@resend.dev>'
  const DEV_OTP_ECHO = process.env.DEV_OTP_ECHO === 'true'

  if (!RESEND_API_KEY) {
    if (DEV_OTP_ECHO) {
      return json(200, { ok: true, sentAt: new Date().toISOString(), devCode: code, warning: 'RESEND_API_KEY 미설정 — 개발 모드로 코드 응답 포함.' })
    }
    return json(503, { ok: false, code: 'RESEND_NOT_CONFIGURED', message: 'RESEND_API_KEY 환경변수가 필요합니다.' })
  }

  try {
    const sendRes = await fetch(RESEND_SEND_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [email],
        subject: '[JUMCLASS] 비밀번호 재설정 인증번호',
        html: buildEmailHtml(code),
      }),
    })
    const data = await sendRes.json().catch(() => null)
    if (!sendRes.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any
      return json(502, {
        ok: false,
        code: 'RESEND_SEND_FAILED',
        message: d?.message || '인증 메일 발송에 실패했습니다.',
        resendStatus: sendRes.status,
        rawData: d,
        ...(DEV_OTP_ECHO ? { devCode: code } : {}),
      })
    }
    return json(200, { ok: true, sentAt: new Date().toISOString(), ...(DEV_OTP_ECHO ? { devCode: code } : {}) })
  } catch (err) {
    return json(502, {
      ok: false,
      code: 'RESEND_NETWORK',
      message: err instanceof Error ? err.message : '네트워크 오류',
      ...(DEV_OTP_ECHO ? { devCode: code } : {}),
    })
  }
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
