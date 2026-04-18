// Vercel Node.js Runtime (기본)
// 휴대폰 인증번호 발송 — SOLAPI(coolsms) SDK 사용
//
// 요청 (POST /api/sms-otp-send):
// { phone: string }  // 01012345678 또는 010-1234-5678
//
// 응답:
// 성공: 200 { ok: true, sentAt: ISOString, devCode?: "123456" }
// 실패: 400/429/500 { ok: false, code, message, sentTo?, rawData? }
//
// 필수 환경 변수 (Vercel):
// - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  → phone_verifications 테이블 접근
// - SOLAPI_API_KEY                           → Solapi 콘솔 → 개발자 센터 → API Key
// - SOLAPI_API_SECRET                        → Solapi 콘솔 → 개발자 센터 → API Secret
// - SOLAPI_SENDER                            → 사전등록된 발신번호 (01012345678 형식, 하이픈 X)
// - DEV_OTP_ECHO (선택)                      → "true"면 응답에 devCode 포함 (초기 테스트용)

import { SolapiMessageService } from 'solapi'

const CODE_TTL_MS = 5 * 60 * 1000       // 5분
const RESEND_COOLDOWN_MS = 60 * 1000    // 60초 재전송 방지

// Node.js Runtime — Web Crypto 대신 node:crypto 사용
import { createHash, randomInt } from 'node:crypto'

function normalizePhone(phone: string): string {
  // Solapi는 하이픈 없는 국내 번호(01012345678) 형식을 요구
  const digits = phone.replace(/\D/g, '')
  // 82로 시작하면 국내 형식으로 역변환
  if (digits.startsWith('82')) return '0' + digits.slice(2)
  return digits
}

function isValidKrMobile(phone: string): boolean {
  const d = phone.replace(/\D/g, '')
  return /^(010|011|016|017|018|019)\d{7,8}$/.test(d)
    || /^82(10|11|16|17|18|19)\d{7,8}$/.test(d)
}

function gen6DigitCode(): string {
  return String(randomInt(100000, 1000000))
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
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
  const codeHash = sha256Hex(code + ':' + phone)
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

  // 3) SOLAPI SDK로 SMS 발송
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
        warning: 'SOLAPI 환경변수 미설정 — 개발 모드로 코드를 응답에 포함합니다.',
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
    const service = new SolapiMessageService(SOLAPI_API_KEY, SOLAPI_API_SECRET)
    const result = await service.send({
      to: phone,
      from: SOLAPI_SENDER,
      text,
    })

    // Solapi SDK는 성공 시 groupInfo/messageList를 포함한 객체 반환
    return json(200, {
      ok: true,
      sentAt: new Date().toISOString(),
      sentTo: phone,
      ...(DEV_OTP_ECHO ? { devCode: code } : {}),
      // 실패 진단용 일부 정보 (민감한 값 제외)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      groupId: (result as any)?.groupInfo?.groupId ?? null,
    })
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = err as any
    return json(502, {
      ok: false,
      code: 'SOLAPI_SEND_FAILED',
      message: e?.message || '문자 발송에 실패했습니다.',
      solapiErrorCode: e?.errorCode ?? e?.failedMessageList?.[0]?.statusCode ?? null,
      rawData: e?.response?.data ?? e?.failedMessageList ?? null,
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
