// Vercel Edge Runtime
// 휴대폰 인증번호 발송 — Bizm 알림톡(OTP 전용 템플릿)을 사용
//
// 요청 (POST /api/sms-otp-send):
// { phone: string }  // 01012345678 또는 010-1234-5678
//
// 응답:
// 성공: 200 { ok: true, sentAt: ISOString, devCode?: "123456" }  // devCode는 DEV_OTP_ECHO=true일 때만
// 실패: 400/429/500 { ok: false, code, message }
//
// 환경 변수:
// - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  → phone_verifications 테이블 접근
// - BIZM_USERID, BIZM_PROFILE                → 기존 알림톡과 동일 자격증명
// - BIZM_OTP_TEMPLATE_ID                     → OTP 전용 알림톡 템플릿 ID (Bizm 심사 필요, 변수 #{authCode})
// - DEV_OTP_ECHO                             → "true"면 응답에 devCode 포함 (템플릿 승인 전 테스트용)

export const config = { runtime: 'edge' }

const CODE_TTL_MS = 5 * 60 * 1000       // 5분
const RESEND_COOLDOWN_MS = 60 * 1000    // 60초 재전송 방지
const BIZM_API_ENDPOINT = 'https://alimtalk-api.bizmsg.kr/v2/sender/send'

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('82')) return digits
  if (digits.startsWith('0')) return '82' + digits.slice(1)
  return digits
}

function isValidKrMobile(phone: string): boolean {
  const d = phone.replace(/\D/g, '')
  // 01X-XXXX-XXXX (국내) 또는 82-10-XXXX-XXXX
  return /^(010|011|016|017|018|019)\d{7,8}$/.test(d) || /^82(10|11|16|17|18|19)\d{7,8}$/.test(d)
}

function gen6DigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
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
    return json(500, { ok: false, code: 'SUPABASE_MISSING_ENV', message: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정해주세요.' })
  }

  // 1) Rate limit — 같은 번호로 60초 내 재요청 차단
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

  // 2) 코드 생성 및 해시 저장
  const code = gen6DigitCode()
  const codeHash = await sha256Hex(code + ':' + phone)   // 단순 해시 + phone salt
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

  // 3) Bizm 알림톡으로 코드 발송 (OTP 전용 템플릿 — 심사 완료 후 BIZM_OTP_TEMPLATE_ID 설정)
  const BIZM_USERID = process.env.BIZM_USERID
  const BIZM_PROFILE = process.env.BIZM_PROFILE
  const BIZM_OTP_TEMPLATE_ID = process.env.BIZM_OTP_TEMPLATE_ID
  const DEV_OTP_ECHO = process.env.DEV_OTP_ECHO === 'true'

  if (!BIZM_USERID || !BIZM_PROFILE || !BIZM_OTP_TEMPLATE_ID) {
    // 비즈엠 미설정 — 개발 모드면 echo, 아니면 사용자에게 안내
    if (DEV_OTP_ECHO) {
      return json(200, { ok: true, sentAt: new Date().toISOString(), devCode: code, warning: 'BIZM_OTP_TEMPLATE_ID 미설정 — 개발 모드로 코드를 응답에 포함합니다.' })
    }
    return json(503, {
      ok: false,
      code: 'BIZM_NOT_CONFIGURED',
      message: 'OTP 알림톡 템플릿이 설정되지 않았습니다. (BIZM_OTP_TEMPLATE_ID 필요 또는 DEV_OTP_ECHO=true로 테스트)',
    })
  }

  // mobile_auth 템플릿 본문 (#{shop_name}, #{auth_number} 치환)
  // Bizm은 msg 전체와 템플릿을 렌더한 결과를 바이트 비교함 — 공백/줄바꿈/구두점 하나도 달라지면 K105/M120
  const shopName = '점클래스'
  const msgBody = [
    `[${shopName}]`,
    '본인 확인을 위한 인증번호는 아래와 같습니다.',
    '인증번호란에 입력 바랍니다.',
    '',
    `인증번호 : ${code}`,
    '',
    '감사합니다.',
  ].join('\n')

  const payload = {
    message_type: 'AT',
    phn: phone,
    profile: BIZM_PROFILE,
    tmplId: BIZM_OTP_TEMPLATE_ID,
    msg: msgBody,
    reserveDt: '00000000000000',
    smsKind: 'L',
    msgSms: `[${shopName}] 인증번호 ${code} (5분 유효)`,
    smsLmsTit: `[${shopName}] 인증번호`,
    smsSender: '',
    // 일부 Bizm 계정은 치환 변수를 별도 필드로도 기대함 — 안전하게 같이 전달
    var1: shopName,
    var2: code,
    shop_name: shopName,
    auth_number: code,
  }

  try {
    const res = await fetch(BIZM_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'userid': BIZM_USERID },
      body: JSON.stringify([payload]),
    })
    const data = await res.json().catch(() => null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = Array.isArray(data) ? data[0] : (data as any)
    const bizmCode = first?.code
    const ok = bizmCode === 'success' || bizmCode === 'SUCCESS' || bizmCode === '7000' || bizmCode === 0
    if (!res.ok || !ok) {
      return json(502, {
        ok: false,
        code: 'BIZM_SEND_FAILED',
        message: `알림톡 발송 실패${first?.message ? ': ' + first.message : ''}`,
        bizmCode,
        bizmMessage: first?.message ?? null,
        rawData: first,
        // 진단용 — 실제로 보낸 msg 본문 (템플릿과 차이 비교 위해 에코)
        sentMsgPreview: msgBody,
        sentMsgCharCount: msgBody.length,
        ...(DEV_OTP_ECHO ? { devCode: code } : {}),
      })
    }
  } catch (err) {
    return json(502, {
      ok: false,
      code: 'BIZM_NETWORK',
      message: err instanceof Error ? err.message : '알림톡 전송 네트워크 오류',
      ...(DEV_OTP_ECHO ? { devCode: code } : {}),
    })
  }

  return json(200, {
    ok: true,
    sentAt: new Date().toISOString(),
    ...(DEV_OTP_ECHO ? { devCode: code } : {}),
  })
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
