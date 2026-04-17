// Vercel Edge Runtime
// 비즈엠 알림톡 API를 호출하는 서버리스 함수
//
// 요청 형식 (POST /api/send-alimtalk):
// {
//   phone: string            // 수신자 전화번호 (01012345678 또는 821012345678)
//   instructorName: string   // 강사명
//   studentName: string      // 수강생명
//   courseName: string       // 자격증 과정명
//   coursePeriod: string     // 수강 기간 (예: "3개월")
//   token: string            // 진도 관리 페이지 토큰 (URL: /i/:token)
// }

export const config = { runtime: 'edge' }

const BIZM_API_ENDPOINT = 'https://alimtalk-api.bizmsg.kr/v2/sender/send'

interface SendPayload {
  phone: string
  instructorName: string
  studentName: string
  courseName: string
  coursePeriod: string
  token: string
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('82')) return digits
  if (digits.startsWith('0')) return '82' + digits.slice(1)
  return digits
}

function buildMessage(p: SendPayload): string {
  return [
    '[JUMCLASS] 자격증 과정 진도 관리 페이지',
    '',
    `${p.instructorName}님, ${p.studentName}님의 진도 관리 페이지가 생성되었습니다.`,
    '아래 링크로 접속해 진도를 관리해주세요.',
    '',
    `과정: ${p.courseName}`,
    `수강 기간: ${p.coursePeriod}`,
    '',
    '(만료일: 수강 종료 +7일)',
  ].join('\n')
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    })
  }

  const BIZM_USERID = process.env.BIZM_USERID
  const BIZM_PROFILE = process.env.BIZM_PROFILE
  const BIZM_TEMPLATE_ID = process.env.BIZM_TEMPLATE_ID
  const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://jumclass.vercel.app'

  if (!BIZM_USERID || !BIZM_PROFILE || !BIZM_TEMPLATE_ID) {
    return new Response(JSON.stringify({
      ok: false,
      reason: 'not-configured',
      message: '비즈엠 환경변수가 설정되지 않았습니다 (BIZM_USERID / BIZM_PROFILE / BIZM_TEMPLATE_ID).',
    }), { status: 503, headers: { 'Content-Type': 'application/json' } })
  }

  let payload: SendPayload
  try {
    payload = await request.json() as SendPayload
  } catch {
    return new Response(JSON.stringify({ ok: false, reason: 'invalid-json' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  const { phone, instructorName, studentName, courseName, coursePeriod, token } = payload
  if (!phone || !instructorName || !studentName || !courseName || !coursePeriod || !token) {
    return new Response(JSON.stringify({ ok: false, reason: 'missing-fields' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  const url = `${SITE_ORIGIN}/i/${token}`
  const msg = buildMessage(payload)

  // 승인된 템플릿(jum_checklist)의 버튼 설정과 100% 일치해야 발송 성공.
  // - 이름: '페이지 바로가기'
  // - 타입: WL (웹링크)
  // - Mobile URL: 승인본의 변수 자리를 포함한 URL 패턴과 일치시키기 위해 실제 토큰으로 치환해서 전달
  // - PC URL: 승인본에서 "PC(선택)"로 비어있음 → 빈 문자열로 필드 자체는 포함 (필드 누락 시 구조 불일치 가능)
  const body = [{
    message_type: 'AT',
    phn: normalizePhone(phone),
    profile: BIZM_PROFILE,
    tmplId: BIZM_TEMPLATE_ID,
    msg,
    button1: {
      name: '페이지 바로가기',
      type: 'WL',
      url_mobile: url,
      url_pc: '',
    },
    reserveDt: '00000000000000',
  }]

  try {
    const res = await fetch(BIZM_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        userid: BIZM_USERID,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    // 비즈엠은 HTTP 200이어도 응답 body 내부에 실패 코드가 있을 수 있으므로
    // 첫 항목의 code 값까지 확인해 실제 성공 여부를 판별.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = Array.isArray(data) ? (data[0] as any) : (data as any)
    const bizmCode = first?.code
    const bizmData = first?.data ?? first?.message ?? null
    const isBizmSuccess = bizmCode === 'success'
      || bizmCode === 'SUCCESS'
      || bizmCode === '7000'
      || bizmCode === 0
    if (!res.ok || !isBizmSuccess) {
      return new Response(JSON.stringify({
        ok: false,
        reason: !res.ok ? 'bizm-error' : 'bizm-failed',
        status: res.status,
        bizmCode,
        bizmMessage: bizmData,
        data,
        sentPayload: body,
      }), { status: 502, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false, reason: 'fetch-failed',
      message: err instanceof Error ? err.message : String(err),
    }), { status: 502, headers: { 'Content-Type': 'application/json' } })
  }
}
