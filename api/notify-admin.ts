// Vercel Edge Runtime
// 관리자 알림 — 결제/문의 발생 시 관리자 휴대폰으로 문자(LMS) 발송.
// 카카오 알림톡은 관리자용 승인 템플릿이 필요하므로(승인 지연), 우선 문자로 발송한다.
// 추후 관리자용 알림톡 템플릿이 승인되면 type을 ATA로 바꿔 업그레이드 가능.
//
// 요청 (POST /api/notify-admin):
//  결제: { kind: 'payment', customerName, courseTitle, amount }
//  문의: { kind: 'inquiry', customerName, subject, content }   // content는 최대 2줄 노출
//
// 필수 환경 변수: ADMIN_NOTIFY_PHONE(수신 관리자 번호, 콤마로 여러 명 가능),
//                 SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER

export const config = { runtime: 'edge' }

const SOLAPI_SEND_URL = 'https://api.solapi.com/messages/v4/send'

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

  const ADMIN = process.env.ADMIN_NOTIFY_PHONE
  const KEY = process.env.SOLAPI_API_KEY
  const SECRET = process.env.SOLAPI_API_SECRET
  const SENDER = process.env.SOLAPI_SENDER
  // 설정이 없으면 조용히 skip (알림은 부가기능 — 본 흐름에 영향 없음)
  if (!ADMIN || !KEY || !SECRET || !SENDER) return json(200, { ok: false, reason: 'not-configured' })

  let text = ''
  if (b.kind === 'payment') {
    text = `[점클래스] 결제 알림\n고객: ${b.customerName || '-'}\n강의: ${b.courseTitle || '-'}\n금액: ${b.amount || '-'}\n관리자 페이지에서 확인하세요.`
  } else if (b.kind === 'inquiry') {
    const content = clip2lines(b.content || '')
    text = `[점클래스] 문의 접수\n고객: ${b.customerName || '-'}${b.subject ? `\n제목: ${b.subject}` : ''}\n${content}\n관리자 페이지에서 확인하세요.`
  } else {
    return json(400, { ok: false, reason: 'unknown-kind' })
  }

  const recipients = ADMIN.split(',').map(s => normPhone(s.trim())).filter(Boolean)
  try {
    const auth = await buildAuth(KEY, SECRET)
    // 여러 관리자에게 발송
    await Promise.all(recipients.map(to =>
      fetch(SOLAPI_SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': auth },
        body: JSON.stringify({ message: { to, from: SENDER, type: 'LMS', subject: '점클래스 알림', text } }),
      }).catch(() => null)
    ))
    return json(200, { ok: true, sent: recipients.length })
  } catch (e) {
    return json(200, { ok: false, reason: e instanceof Error ? e.message : 'send-error' })
  }
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
