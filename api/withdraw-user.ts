// Vercel Edge Runtime
// 회원 탈퇴 — 계정 삭제 + 개인정보 익명화 + 재가입 차단.
//
// 전자상거래법상 보존 의무(대금결제·계약 5년, 소비자분쟁 3년)가 있으므로
// 수강(enrollments)·문의(inquiries)·동의서(certificate_agreements) 레코드 자체는 남기고,
// 그 안의 개인정보 컬럼만 익명화한다. 로그인 계정(auth.users)은 삭제한다.
//
// 요청 (POST /api/withdraw-user):
//   헤더: Authorization: Bearer <access token>
//   바디: { userId? }  — 관리자가 타인을 탈퇴시킬 때만 userId 지정. 없으면 본인 탈퇴.
//
// 필수 환경 변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method-not-allowed' })

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { ok: false, error: '서버 설정 누락' })
  const svc = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  const svcJson = { ...svc, 'Content-Type': 'application/json' }

  // 1) 호출자 확인
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json(401, { ok: false, error: '인증 토큰이 없습니다.' })

  const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${token}` },
  })
  if (!meRes.ok) return json(401, { ok: false, error: '유효하지 않은 세션입니다.' })
  const me = await meRes.json().catch(() => null)
  const callerUid: string | undefined = me?.id
  if (!callerUid) return json(401, { ok: false, error: '유효하지 않은 세션입니다.' })

  let body: { userId?: string } = {}
  try { body = await req.json() } catch { /* 본인 탈퇴는 바디가 없을 수 있음 */ }
  const requested = String(body.userId || '').trim()

  // 2) 대상 결정 — 타인을 탈퇴시키려면 관리자여야 함
  let targetUid = callerUid
  if (requested && requested !== callerUid) {
    const chk = await fetch(`${SUPABASE_URL}/rest/v1/admin_users?user_id=eq.${callerUid}&select=user_id`, { headers: svc })
    const rows = await chk.json().catch(() => [])
    if (!Array.isArray(rows) || rows.length === 0) return json(403, { ok: false, error: '관리자 권한이 없습니다.' })
    targetUid = requested
  }

  // 관리자 계정은 탈퇴 불가 (실수로 본인/동료 관리자 삭제 방지)
  const tgtAdmin = await fetch(`${SUPABASE_URL}/rest/v1/admin_users?user_id=eq.${targetUid}&select=user_id`, { headers: svc })
  const tgtAdminRows = await tgtAdmin.json().catch(() => [])
  if (Array.isArray(tgtAdminRows) && tgtAdminRows.length > 0) {
    return json(400, { ok: false, error: '관리자 계정은 탈퇴 처리할 수 없습니다.' })
  }

  // 3) 대상 이메일 확보 (재가입 차단 목록에 기록)
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${targetUid}`, { headers: svc })
  if (!userRes.ok) return json(404, { ok: false, error: '대상 회원을 찾을 수 없습니다.' })
  const userRow = await userRes.json().catch(() => null)
  const email = String(userRow?.email || '').trim().toLowerCase()

  // 4) 재가입 차단 목록 등록 (이메일이 있는 계정만)
  if (email) {
    await fetch(`${SUPABASE_URL}/rest/v1/withdrawn_emails`, {
      method: 'POST',
      headers: { ...svcJson, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ email, user_id: targetUid, note: requested ? '관리자 처리' : '본인 요청' }),
    }).catch(() => { /* 기록 실패해도 탈퇴는 계속 */ })
  }

  // 5) 개인정보 익명화 — 거래 기록은 보존하되 식별정보만 제거
  const anonEmail = `withdrawn+${targetUid.slice(0, 8)}@deleted.invalid`

  // profiles — 이름/이메일/전화 제거
  await patch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${targetUid}`, svcJson, {
    name: '탈퇴회원', email: anonEmail, phone: null, avatar: '탈',
  })
  // inquiries — 문의 작성자 정보
  await patch(`${SUPABASE_URL}/rest/v1/inquiries?user_id=eq.${targetUid}`, svcJson, {
    user_name: '탈퇴회원', user_email: anonEmail,
  })
  // certificate_agreements — 서명자 개인정보 (서명 이미지 포함)
  await patch(`${SUPABASE_URL}/rest/v1/certificate_agreements?user_id=eq.${targetUid}`, svcJson, {
    signer_name: '탈퇴회원', signer_phone: null, signer_birthdate: null, signature_url: null,
  })
  // access_logs — 접속 로그의 식별정보
  await patch(`${SUPABASE_URL}/rest/v1/access_logs?user_id=eq.${targetUid}`, svcJson, {
    user_name: '탈퇴회원', user_email: anonEmail,
  })

  // 6) 로그인 계정 삭제 — 이후 재가입은 트리거가 차단
  const delRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${targetUid}`, {
    method: 'DELETE', headers: svc,
  })
  if (!delRes.ok) {
    const e = await delRes.json().catch(() => ({})) as Record<string, string>
    return json(500, { ok: false, error: e?.msg || e?.message || '계정 삭제에 실패했습니다.' })
  }

  return json(200, { ok: true, email })
}

// 일부 테이블은 컬럼 구성이 달라 실패할 수 있으나 탈퇴 전체를 막지는 않는다.
async function patch(url: string, headers: Record<string, string>, payload: unknown) {
  try {
    await fetch(url, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify(payload),
    })
  } catch { /* 무시 */ }
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
