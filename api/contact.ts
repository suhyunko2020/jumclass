// Vercel Edge Runtime
// 홈페이지 문의 폼 접수 — 비로그인 방문자도 사용하므로 service role로 inquiries에 저장(RLS 우회).
// 저장된 문의는 관리자 '문의 관리'에서 type='contact'로 노출되며, 관리자가 메일로 답변한다.
//
// 요청 (POST /api/contact):
// { name: string, email: string, message: string }
//
// 응답: 성공 200 { ok: true } / 실패 400·500 { ok: false, message }
//
// 필수 환경 변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// 선택 환경 변수: CONTACT_NOTIFY_EMAIL, RESEND_API_KEY, RESEND_FROM  → 설정 시 새 문의 알림 메일 발송

export const config = { runtime: 'edge' }

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false, message: 'METHOD_NOT_ALLOWED' })

  let body: { name?: string; email?: string; message?: string }
  try { body = await req.json() } catch { return json(400, { ok: false, message: '잘못된 요청입니다.' }) }

  const name = (body.name || '').trim().slice(0, 60)
  const email = (body.email || '').trim().slice(0, 120)
  const message = (body.message || '').trim().slice(0, 4000)

  if (!name || !email || !message) {
    return json(400, { ok: false, message: '이름·이메일·문의 내용을 모두 입력해주세요.' })
  }
  if (!isEmail(email)) {
    return json(400, { ok: false, message: '올바른 이메일 형식이 아닙니다.' })
  }
  if (message.length < 5) {
    return json(400, { ok: false, message: '문의 내용을 조금 더 자세히 입력해주세요.' })
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json(500, { ok: false, message: '서버 설정 오류입니다. 잠시 후 다시 시도해주세요.' })
  }

  // inquiries 저장 (service role → RLS 우회). user_id는 null(비회원), type='contact'.
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/inquiries`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      user_id: null,
      user_name: name,
      user_email: email,
      subject: '홈페이지 문의',
      message,
      type: 'contact',
    }),
  })
  if (!insertRes.ok) {
    const msg = await insertRes.text().catch(() => '')
    return json(500, { ok: false, message: '문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.', detail: msg })
  }

  // 관리자에게 새 문의 알림(문자) — 같은 배포의 notify-admin 엔드포인트 호출. 실패해도 접수는 성공.
  try {
    const origin = new URL(req.url).origin
    await fetch(`${origin}/api/notify-admin`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'inquiry', customerName: name, subject: '홈페이지 문의', content: message }),
    })
  } catch { /* 알림 실패는 접수에 영향 없음 */ }

  // (선택) 관리자에게 새 문의 알림 메일 — 관련 env가 모두 설정된 경우에만 발송. 실패해도 접수는 성공 처리.
  const NOTIFY = process.env.CONTACT_NOTIFY_EMAIL
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const RESEND_FROM = process.env.RESEND_FROM
  if (NOTIFY && RESEND_API_KEY && RESEND_FROM) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: NOTIFY,
          reply_to: email,
          subject: `[점클래스 문의] ${name}님의 문의가 접수되었습니다`,
          text: `이름: ${name}\n이메일: ${email}\n\n${message}\n\n— 관리자 문의 관리에서도 확인할 수 있습니다.`,
        }),
      })
    } catch { /* 알림 메일 실패는 접수에 영향 없음 */ }
  }

  return json(200, { ok: true })
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
