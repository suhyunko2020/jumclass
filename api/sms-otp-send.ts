// Vercel Edge Runtime
// 휴대폰 인증번호 발송 — SOLAPI(coolsms) REST API 직접 호출
// (SDK 대신 fetch + Web Crypto API로 HMAC-SHA256 서명 생성 → Edge 호환)
//
// 요청 (POST /api/sms-otp-send):
// { phone: string }  // 01012345678 또는 010-1234-5678
//
// 응답:
// 성공: 200 { ok: true, sentAt, devCode? }
// 실패: 400/429/500 { ok: false, code, message, solapiStatus?, rawData? }
//
// 필수 환경 변수:
// - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  → phone_verifications 테이블
// - SOLAPI_API_KEY                           → Solapi 콘솔 API Key
// - SOLAPI_API_SECRET                        → Solapi 콘솔 API Secret
// - SOLAPI_SENDER                            → 사전등록 발신번호 (01012345678)
// - DEV_OTP_ECHO (선택)                      → "true"면 응답에 devCode 포함

export const config = { runtime: 'edge' }

const CODE_TTL_MS = 5 * 60 * 1000       // 5분
const RESEND_COOLDOWN_MS = 60 * 1000    // 60초 재전송 쿨다운
const SOLAPI_SEND_URL = 'https://api.solapi.com/messages/v4/send'

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('82')) return '0' + digits.slice(2)
  return digits
}

function isValidKrMobile(phone: string): boolean {
  const d = phone.replace(/\D/g, '')
  return /^(010|011|016|017|018|019)\d{7,8}$/.test(d)
    || /^82(10|11|16|17|18|19)\d{7,8}$/.test(d)
}

function gen6DigitCode(): string {
  // Web Crypto RNG
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

// Solapi Authorization 헤더 생성 — HMAC-SHA256(date + salt, secret)
async function buildSolapiAuthHeader(apiKey: string, apiSecret: string): Promise<string> {
  const date = new Date().toISOString()

  // salt: 16바이트 랜덤 hex (32자)
  const saltBytes = new Uint8Array(16)
  crypto.getRandomValues(saltBytes)
  const salt = bytesToHex(saltBytes)

  // HMAC-SHA256(date + salt, apiSecret)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(date + salt))
  const signature = bytesToHex(new Uint8Array(sigBuf))

  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false, code: 'METHOD_NOT_ALLOWED' })

  let body: { phone?: string }
  try { body = await req.json() } catch { return json(400, { ok: false, code: 'INVALID_JSON' }) }

  const rawPhone = (body.phone || '').trim()
  if (!rawPhone || !isValidKrMobile(rawPhone)) {
    return json(400, { ok: false, code: 'INVALID_PHONE', message: '올바른 휴대폰 번호 형식이 아닙니다.' })
  }

  const phone = normalizePhone(rawPhone)

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) {
    // 어느 변수가 비어있는지 구체적으로 알려줌 (값은 노출하지 않음)
    const diag = {
      SUPABASE_URL: SUPABASE_URL ? `set (len=${SUPABASE_URL.length})` : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY ? `set (len=${SERVICE_KEY.length})` : 'MISSING',
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? 'set' : 'MISSING',
      availableEnvKeys: Object.keys(process.env).filter(k =>
        k.includes('SUPABASE') || k.includes('SOLAPI')
      ),
    }
    return json(500, {
      ok: false,
      code: 'SUPABASE_MISSING_ENV',
      message: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정해주세요.',
      diagnostic: diag,
    })
  }

  // 1) Rate limit — 같은 번호로 60초 내 재요청 차단
  try {
    const recentRes = await fetch(
      `${SUPABASE_URL}/rest/v1/phone_verifications?phone=eq.${phone}&order=created_at.desc&limit=1&select=created_at`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    )
    if (recentRes.ok) {
      const rows = await recentRes.json().catch(() => [])
      if (Array.isArray(rows) && rows.length > 0) {
        const last = new Date(rows[0].created_at).getTime()
        const delta = Date.now() - last
        if (delta < RESEND_COOLDOWN_MS) {
          const wait = Math.ceil((RESEND_COOLDOWN_MS - delta) / 1000)
          return json(429, { ok: false, code: 'TOO_SOON', message: `${wait}초 후 다시 시도해주세요.` })
        }
      }
    }
  } catch {
    // Rate limit 조회 실패는 치명적이지 않음 — 다음 단계 진행
  }

  // 2) 코드 생성 및 해시 저장
  const code = gen6DigitCode()
  const codeHash = await sha256Hex(code + ':' + phone)
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString()

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/phone_verifications`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ phone, code_hash: codeHash, expires_at: expiresAt }),
  })
  if (!insertRes.ok) {
    const msg = await insertRes.text().catch(() => '')
    return json(500, { ok: false, code: 'INSERT_FAILED', message: `DB 저장 실패: ${msg}` })
  }

  // 3) SOLAPI REST API로 SMS 발송
  const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY
  const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET
  const SOLAPI_SENDER = process.env.SOLAPI_SENDER
  const DEV_OTP_ECHO = process.env.DEV_OTP_ECHO === 'true'

  if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET || !SOLAPI_SENDER) {
    if (DEV_OTP_ECHO) {
      return json(200, {
        ok: true,
        sentAt: new Date().toISOString(),
        devCode: code,
        warning: 'SOLAPI 환경변수 미설정 — 개발 모드로 코드 응답 포함.',
      })
    }
    return json(503, {
      ok: false,
      code: 'SOLAPI_NOT_CONFIGURED',
      message: 'SOLAPI_API_KEY / SOLAPI_API_SECRET / SOLAPI_SENDER 환경변수가 필요합니다.',
    })
  }

  const text = `[점클래스] 본인 확인 인증번호: ${code}\n5분 안에 입력해주세요.`

  try {
    const authHeader = await buildSolapiAuthHeader(SOLAPI_API_KEY, SOLAPI_API_SECRET)
    const sendRes = await fetch(SOLAPI_SEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        message: {
          to: phone,
          from: SOLAPI_SENDER,
          text,
        },
      }),
    })

    const data = await sendRes.json().catch(() => null)

    // Solapi 응답: 성공 시 { groupInfo: { ... status: 'SUCCESS'... }, failedMessageList: [] }
    // 실패 시 { errorCode, errorMessage } 또는 failedMessageList에 상세
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any
    const failed = d?.failedMessageList ?? []
    const hasFailure = Array.isArray(failed) && failed.length > 0
    const hasErrorCode = d?.errorCode && d?.errorCode !== 'OK'

    if (!sendRes.ok || hasFailure || hasErrorCode) {
      return json(502, {
        ok: false,
        code: 'SOLAPI_SEND_FAILED',
        message: d?.errorMessage || failed?.[0]?.statusMessage || '문자 발송에 실패했습니다.',
        solapiStatus: sendRes.status,
        solapiErrorCode: d?.errorCode ?? failed?.[0]?.statusCode ?? null,
        rawData: d,
        ...(DEV_OTP_ECHO ? { devCode: code } : {}),
      })
    }

    return json(200, {
      ok: true,
      sentAt: new Date().toISOString(),
      sentTo: phone,
      groupId: d?.groupInfo?.groupId ?? null,
      ...(DEV_OTP_ECHO ? { devCode: code } : {}),
    })
  } catch (err) {
    return json(502, {
      ok: false,
      code: 'SOLAPI_NETWORK',
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
