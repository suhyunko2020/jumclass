// Vercel Edge Runtime
// 오픈 전 사이트 잠금 해제 — 입력 비밀번호를 서버 환경변수와 비교
// (비밀번호를 프론트 코드에 노출하지 않기 위한 서버 검증)
//
// 요청 (POST /api/site-unlock): { password: string }
// 응답: 200 { ok: true } / 401 { ok: false } / 500 { ok: false, code }
//
// 필수 환경 변수: SITE_UNLOCK_PW

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false, code: 'METHOD_NOT_ALLOWED' })

  let body: { password?: string }
  try { body = await req.json() } catch { return json(400, { ok: false, code: 'INVALID_JSON' }) }

  const pw = (body.password || '').trim()
  const SITE_PW = process.env.SITE_UNLOCK_PW

  if (!SITE_PW) {
    return json(500, { ok: false, code: 'NOT_CONFIGURED', message: 'SITE_UNLOCK_PW 환경변수가 설정되지 않았습니다.' })
  }
  if (pw && pw === SITE_PW) {
    return json(200, { ok: true })
  }
  return json(401, { ok: false, code: 'WRONG_PASSWORD' })
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
