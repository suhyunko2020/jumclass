// Vercel Edge Runtime
// 카카오 알림톡(친구톡 아님) 발송 — SOLAPI REST API 직접 호출
// (SDK 대신 fetch + Web Crypto API로 HMAC-SHA256 서명 → Edge 호환)
//
// 요청 (POST /api/send-kakao):
// {
//   type: string,                       // 아래 TEMPLATE_IDS 키 중 하나 (payment_complete 등)
//   to: string,                         // 수신자 휴대폰 (01012345678 / 010-1234-5678 모두 허용)
//   variables?: Record<string,string>,  // 템플릿 변수 — 키는 '고객명' 또는 '#{고객명}' 둘 다 허용
//   buttons?: Array<Record<string,unknown>>,  // (선택) 변수 URL 버튼 — 보통 진도관리만 사용
//   disableSms?: boolean,               // (선택) 알림톡 실패 시 SMS 대체발송 끄기
//   smsText?: string,                   // (선택) 대체발송 SMS 본문
// }
//
// 응답:
// 성공: 200 { ok: true, groupId? }
// 실패: 4xx/5xx { ok: false, code, message, ... }
//
// 필수 환경변수: SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER
// 정보성 알림은 SMS 대체발송 없이 알림톡만 보냄(비용 절감) — 본문에서 sms 미지정.

export const config = { runtime: 'edge' }

const SOLAPI_SEND_URL = 'https://api.solapi.com/messages/v4/send'

// 점클래스 카카오 채널 ID (발신 프로필)
const PF_ID = 'KA01PF260616051226226tvtVw4A32cI'

// type → 승인된 알림톡 템플릿 ID 매핑
const TEMPLATE_IDS: Record<string, string> = {
  payment_complete:    'KA01TP260616052339492mSicTXP33yR', // 결제완료 (고객)
  inquiry_received:    'KA01TP260616052542452Grdc5bjVImF', // 문의접수 (고객)
  inquiry_answered:    'KA01TP260616052700319rYAkqV6dIwV', // 문의답변 (고객)
  refund_complete:     'KA01TP2606160528305900G3xA2JTTep', // 환불완료 (고객)
  instructor_progress: 'KA01TP260616053234505aiHM1OivhTU', // 진도관리 안내 (강사)
  course_start:        'KA01TP260616053958315R5IUfrcIxMf', // 수강시작 안내 (수강생)
  expiry_soon:         'KA01TP260616054141837KOH9Th4gkVo', // 수강 만료임박 (고객)
  course_complete:     'KA01TP2606160544351613aHhtOYMimG', // 수료완료 (고객)
  welcome:             'KA01TP260616054539822uA2GqRsXokB', // 회원가입 환영 (고객)
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('82')) return '0' + digits.slice(2)
  return digits
}

function isValidKrMobile(phone: string): boolean {
  const d = normalizePhone(phone)
  return /^(010|011|016|017|018|019)\d{7,8}$/.test(d)
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Solapi Authorization 헤더 — HMAC-SHA256(date + salt, secret)
async function buildSolapiAuthHeader(apiKey: string, apiSecret: string): Promise<string> {
  const date = new Date().toISOString()
  const saltBytes = new Uint8Array(16)
  crypto.getRandomValues(saltBytes)
  const salt = bytesToHex(saltBytes)
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(date + salt))
  const signature = bytesToHex(new Uint8Array(sigBuf))
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

// 변수 키를 SOLAPI 형식(#{키})으로 정규화 — '고객명' / '#{고객명}' 모두 허용
function normalizeVariables(input?: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  if (!input) return out
  for (const [k, v] of Object.entries(input)) {
    const key = k.startsWith('#{') ? k : `#{${k}}`
    out[key] = v == null ? '' : String(v)
  }
  return out
}

// userId로 profiles에서 이름+휴대폰 조회 (service_role — RLS 우회)
async function resolveProfile(userId: string): Promise<{ name: string; phone: string }> {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) return { name: '', phone: '' }
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=name,phone&limit=1`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    )
    const rows = await res.json().catch(() => [])
    const r = Array.isArray(rows) ? rows[0] : null
    return { name: (r?.name ?? '') as string, phone: normalizePhone(String(r?.phone ?? '')) }
  } catch {
    return { name: '', phone: '' }
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false, code: 'METHOD_NOT_ALLOWED' })

  let body: {
    type?: string
    to?: string
    userId?: string
    variables?: Record<string, unknown>
    buttons?: Array<Record<string, unknown>>
    disableSms?: boolean
    smsText?: string
  }
  try { body = await req.json() } catch { return json(400, { ok: false, code: 'INVALID_JSON' }) }

  const type = (body.type || '').trim()
  const templateId = TEMPLATE_IDS[type]
  if (!templateId) {
    return json(400, { ok: false, code: 'UNKNOWN_TYPE', message: `알 수 없는 알림톡 유형: ${type}` })
  }

  // 수신 번호 결정 — to가 유효하면 그대로, 아니면 userId로 profiles에서 서버 조회(service_role).
  // 관리자가 타인에게 보내거나(RLS 우회), 비로그인 페이지에서 보낼 때 필요.
  const rawTo = (body.to || '').trim()
  let to = isValidKrMobile(rawTo) ? normalizePhone(rawTo) : ''
  let resolvedName = ''
  if (!to && body.userId) {
    const prof = await resolveProfile(body.userId)
    to = prof.phone
    resolvedName = prof.name
  }
  if (!to || !isValidKrMobile(to)) {
    return json(400, { ok: false, code: 'INVALID_PHONE', message: '수신자 휴대폰 번호를 찾을 수 없습니다.' })
  }

  const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY
  const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET
  const SOLAPI_SENDER = process.env.SOLAPI_SENDER
  if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET || !SOLAPI_SENDER) {
    return json(503, {
      ok: false, code: 'SOLAPI_NOT_CONFIGURED',
      message: 'SOLAPI_API_KEY / SOLAPI_API_SECRET / SOLAPI_SENDER 환경변수가 필요합니다.',
    })
  }

  const variables = normalizeVariables(body.variables)
  // 고객명이 비어있고 userId로 이름을 조회했으면 채워줌 (비로그인 페이지 발송 대응)
  if (resolvedName && !variables['#{고객명}']) variables['#{고객명}'] = resolvedName

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kakaoOptions: Record<string, any> = { pfId: PF_ID, templateId, variables }
  if (Array.isArray(body.buttons) && body.buttons.length > 0) {
    kakaoOptions.buttons = body.buttons
  }
  // 알림톡 실패 시 SMS 대체발송(친구톡 아님) — 정보성은 기본 끔(비용 절감)
  if (body.disableSms === false && body.smsText) {
    kakaoOptions.disableSms = false
  } else {
    kakaoOptions.disableSms = true
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const message: Record<string, any> = {
    to,
    from: SOLAPI_SENDER,
    type: 'ATA',          // 알림톡
    kakaoOptions,
  }
  // 대체발송용 본문(알림톡 실패 시 SMS로 전환될 때 사용)
  if (body.smsText) message.text = body.smsText

  try {
    const authHeader = await buildSolapiAuthHeader(SOLAPI_API_KEY, SOLAPI_API_SECRET)
    const sendRes = await fetch(SOLAPI_SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
      body: JSON.stringify({ message }),
    })
    const data = await sendRes.json().catch(() => null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any
    const failed = d?.failedMessageList ?? []
    const hasFailure = Array.isArray(failed) && failed.length > 0
    const hasErrorCode = d?.errorCode && d?.errorCode !== 'OK'

    if (!sendRes.ok || hasFailure || hasErrorCode) {
      return json(502, {
        ok: false,
        code: 'SOLAPI_SEND_FAILED',
        message: d?.errorMessage || failed?.[0]?.statusMessage || '알림톡 발송에 실패했습니다.',
        solapiStatus: sendRes.status,
        solapiErrorCode: d?.errorCode ?? failed?.[0]?.statusCode ?? null,
        rawData: d,
      })
    }

    return json(200, { ok: true, groupId: d?.groupInfo?.groupId ?? null })
  } catch (err) {
    return json(502, {
      ok: false, code: 'SOLAPI_NETWORK',
      message: err instanceof Error ? err.message : '네트워크 오류',
    })
  }
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
