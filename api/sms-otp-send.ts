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
const SOLAPI_SEND_URL = 'https://api.solapi.com/messages/v4/send'

// 단계적 발송 제한 (휴대폰 1개 기준, 자정 KST 리셋)
//  1~3회: 즉시 / 4~5회: 5분 간격 / 6회: 1시간 간격 / 7회 이상: 당일 차단
const RL_FREE_COUNT = 3                  // 텀 없이 허용하는 횟수
const RL_5MIN_MS = 5 * 60 * 1000
const RL_1HOUR_MS = 60 * 60 * 1000
const RL_DAILY_MAX = 6                   // 하루 최대 발송 횟수(이후 자정까지 차단)

// 인증번호 알림톡 (승인 템플릿) — 알림톡 우선 발송, 실패 시 SMS 자동 대체(비용 절감)
const AUTH_PF_ID = 'KA01PF260616051226226tvtVw4A32cI'
const AUTH_TEMPLATE_ID = 'KA01TP260617055554317yhFxi3oULou'

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

  let body: { phone?: string; purpose?: string }
  try { body = await req.json() } catch { return json(400, { ok: false, code: 'INVALID_JSON' }) }

  const rawPhone = (body.phone || '').trim()
  if (!rawPhone || !isValidKrMobile(rawPhone)) {
    return json(400, { ok: false, code: 'INVALID_PHONE', message: '올바른 휴대폰 번호 형식이 아닙니다.' })
  }

  const phone = normalizePhone(rawPhone)
  // purpose='signup'이면 한 휴대폰당 한 계정만 허용 — 이미 가입된 번호는 인증 발송 차단
  const purpose = (body.purpose || '').trim()

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

  // 0) 회원가입 시 휴대폰 중복 차단 — 한 휴대폰당 한 계정만 (service_role이라 RLS 우회)
  if (purpose === 'signup') {
    try {
      const dupRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?phone=eq.${phone}&select=id&limit=1`,
        { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
      )
      if (dupRes.ok) {
        const rows = await dupRes.json().catch(() => [])
        if (Array.isArray(rows) && rows.length > 0) {
          return json(409, {
            ok: false, code: 'ALREADY_REGISTERED',
            message: '이미 가입된 휴대폰 번호입니다. 로그인 또는 비밀번호 찾기를 이용해주세요.',
          })
        }
      }
    } catch {
      // 조회 실패는 치명적이지 않음 — DB 유니크 제약이 최종 방어선
    }
  }

  // 1) 단계적 발송 제한 — 오늘(자정 KST 이후) 발송 횟수 기준으로 텀을 점증
  try {
    const KST = 9 * 60 * 60 * 1000
    const now = Date.now()
    // 자정(KST) 시각을 UTC ms로 환산 → 오늘 발송분만 카운트
    const kstMidnightUtc = Math.floor((now + KST) / 86400000) * 86400000 - KST
    const since = new Date(kstMidnightUtc).toISOString()

    const recentRes = await fetch(
      `${SUPABASE_URL}/rest/v1/phone_verifications?phone=eq.${phone}&created_at=gte.${since}&order=created_at.desc&select=created_at`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    )
    if (recentRes.ok) {
      const rows = await recentRes.json().catch(() => [])
      const sentToday = Array.isArray(rows) ? rows.length : 0           // 오늘 이미 발송한 횟수
      const lastTs = sentToday > 0 ? new Date(rows[0].created_at).getTime() : 0
      const sinceLast = now - lastTs

      const fmtWait = (ms: number) => {
        const sec = Math.ceil(ms / 1000)
        const m = Math.floor(sec / 60), s = sec % 60
        return m > 0 ? `${m}분 ${s}초` : `${s}초`
      }

      if (sentToday >= RL_DAILY_MAX) {
        // 7회째 이상 — 당일 차단 (자정 지나면 리셋)
        return json(429, {
          ok: false, code: 'DAILY_LIMIT',
          message: '오늘 인증 요청 가능 횟수를 초과했습니다. 보안을 위해 내일 다시 시도해주세요.',
        })
      }
      if (sentToday === RL_DAILY_MAX - 1) {
        // 6회째 — 1시간 간격
        if (sinceLast < RL_1HOUR_MS) {
          return json(429, {
            ok: false, code: 'RATE_LIMITED',
            message: `인증 요청이 너무 많습니다. 보안을 위해 ${fmtWait(RL_1HOUR_MS - sinceLast)} 후 다시 시도해주세요.`,
          })
        }
      } else if (sentToday >= RL_FREE_COUNT) {
        // 4~5회째 — 5분 간격 + 경고
        if (sinceLast < RL_5MIN_MS) {
          return json(429, {
            ok: false, code: 'RATE_LIMITED',
            message: `짧은 시간에 인증을 너무 많이 요청했습니다. ${fmtWait(RL_5MIN_MS - sinceLast)} 후 다시 시도해주세요.`,
          })
        }
      }
      // 1~3회째 — 텀 없이 허용
    }
  } catch {
    // 제한 조회 실패는 치명적이지 않음 — 다음 단계 진행
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

  // 3) SOLAPI 발송 — 인증번호 알림톡(ATA) 우선, 실패 시 SMS 자동 대체
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

  // 알림톡 실패 시 SMS로 대체발송될 본문 (템플릿 문구와 동일 톤)
  const text = `[점클래스] 본인 인증을 위한 인증번호입니다.\n인증번호: ${code}\n5분 이내에 입력해주세요.`

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
          type: 'ATA',                          // 알림톡 우선
          text,                                 // 알림톡 실패 시 SMS 대체발송 본문
          kakaoOptions: {
            pfId: AUTH_PF_ID,
            templateId: AUTH_TEMPLATE_ID,
            variables: { '#{인증번호}': code },
            disableSms: false,                  // 카카오 미수신/실패 시 SMS 자동 대체
          },
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
