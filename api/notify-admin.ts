// Vercel Edge Runtime
// 관리자 알림 — 결제/문의 발생 시 관리자 휴대폰으로 문자(LMS) 발송.
// 카카오 알림톡은 관리자용 승인 템플릿이 필요하므로(승인 지연), 우선 문자로 발송한다.
// 추후 관리자용 알림톡 템플릿이 승인되면 type을 ATA로 바꿔 업그레이드 가능.
//
// 요청 (POST /api/notify-admin):
//  결제: { kind: 'payment', customerName, courseTitle, amount }
//  문의: { kind: 'inquiry', customerName, subject, content }   // content는 최대 2줄 노출
//
// 수신 번호: 관리자 설정(admin_config.adminNotifyPhone) 우선, 없으면 환경변수 ADMIN_NOTIFY_PHONE.
// 필수 환경 변수: SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER
//             (+ admin_config 조회용 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

export const config = { runtime: 'edge' }

// 관리자 알림 수신 번호 — admin_config 테이블(서버 전용) 우선, 환경변수 폴백
async function resolveAdminPhone(): Promise<string> {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (SUPABASE_URL && SERVICE_KEY) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/admin_config?id=eq.main&select=data`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      })
      if (res.ok) {
        const rows = await res.json().catch(() => [])
        const phone = Array.isArray(rows) && rows[0]?.data?.adminNotifyPhone
        if (phone && String(phone).trim()) return String(phone)
      }
    } catch { /* 조회 실패 시 환경변수로 폴백 */ }
  }
  return process.env.ADMIN_NOTIFY_PHONE || ''
}

const SOLAPI_SEND_URL = 'https://api.solapi.com/messages/v4/send'

// 카카오 채널(플러스친구) pfId — 기존 알림톡과 동일 채널
const PF_ID = 'KA01PF260616051226226tvtVw4A32cI'
// 관리자용 알림톡 템플릿 ID — 2026-06-19 카카오 승인 완료. 비밀값 아님(pfId처럼 공개 식별자).
// 코드에 직접 명시. 필요 시 Vercel 환경변수로 덮어쓸 수 있음.
// 알림톡(ATA) 발송 + 실패 시 SMS 자동대체(disableSms:false).
const ADMIN_PAYMENT_TEMPLATE_ID = process.env.ADMIN_PAYMENT_TEMPLATE_ID || 'KA01TP260619080840282rhuhXnZqdcp'
const ADMIN_INQUIRY_TEMPLATE_ID = process.env.ADMIN_INQUIRY_TEMPLATE_ID || 'KA01TP2606190809294840uEnsEcBhPr'

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('')
}
async function buildAuth(apiKey: string, apiSecret: string): Promise<string> {
  const date = new Date().toISOString()
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(apiSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(date + salt))
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${bytesToHex(new Uint8Array(sig))}`
}
function normPhone(p: string): string {
  const d = p.replace(/\D/g, '')
  return d.startsWith('82') ? '0' + d.slice(2) : d
}
// 2줄까지만 노출(각 줄 60자 제한)
function clip2lines(s: string): string {
  return s.replace(/\r/g, '').split('\n').filter(Boolean).slice(0, 2).map(l => l.slice(0, 60)).join('\n')
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false })
  let b: Record<string, string>
  try { b = await req.json() } catch { return json(400, { ok: false }) }

  const ADMIN = await resolveAdminPhone()
  const KEY = process.env.SOLAPI_API_KEY
  const SECRET = process.env.SOLAPI_API_SECRET
  const SENDER = process.env.SOLAPI_SENDER
  // 설정이 없으면 조용히 skip (알림은 부가기능 — 본 흐름에 영향 없음)
  if (!ADMIN || !KEY || !SECRET || !SENDER) return json(200, { ok: false, reason: 'not-configured' })

  // 템플릿 변수 + 본문(text). text는 SMS 대체발송용이자 LMS 본문이며, 등록 템플릿과 동일 구성.
  let text = ''
  let templateId: string | undefined
  let variables: Record<string, string> = {}

  if (b.kind === 'payment') {
    const name = b.customerName || '-'
    const courseTitle = b.courseTitle || '-'
    const amount = b.amount || '-'
    text = `[점클래스] 새 결제 알림\n\n▶ 고객명: ${name}\n▶ 강의: ${courseTitle}\n▶ 결제금액: ${amount}\n\n관리자 페이지에서 자세한 내용을 확인하세요.`
    templateId = ADMIN_PAYMENT_TEMPLATE_ID
    variables = { '#{고객명}': name, '#{강의명}': courseTitle, '#{결제금액}': amount }
  } else if (b.kind === 'inquiry') {
    const name = b.customerName || '-'
    const subject = b.subject || '문의'
    const content = clip2lines(b.content || '') || '-'
    text = `[점클래스] 새 문의 접수\n\n▶ 고객명: ${name}\n▶ 제목: ${subject}\n▶ 내용: ${content}\n\n관리자 페이지에서 답변을 등록해주세요.`
    templateId = ADMIN_INQUIRY_TEMPLATE_ID
    variables = { '#{고객명}': name, '#{제목}': subject, '#{내용}': content }
  } else {
    return json(400, { ok: false, reason: 'unknown-kind' })
  }

  // 템플릿ID가 있으면 알림톡(ATA, 실패 시 SMS 자동대체), 없으면 문자(LMS)
  const buildMessage = (to: string) => templateId
    ? { to, from: SENDER, type: 'ATA', text, kakaoOptions: { pfId: PF_ID, templateId, variables, disableSms: false } }
    : { to, from: SENDER, type: 'LMS', subject: '점클래스 알림', text }

  const recipients = ADMIN.split(',').map(s => normPhone(s.trim())).filter(Boolean)
  try {
    const auth = await buildAuth(KEY, SECRET)
    // 여러 관리자에게 발송
    await Promise.all(recipients.map(to =>
      fetch(SOLAPI_SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': auth },
        body: JSON.stringify({ message: buildMessage(to) }),
      }).catch(() => null)
    ))
    return json(200, { ok: true, sent: recipients.length, channel: templateId ? 'ata' : 'lms' })
  } catch (e) {
    return json(200, { ok: false, reason: e instanceof Error ? e.message : 'send-error' })
  }
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
