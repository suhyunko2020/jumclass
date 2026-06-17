// Vercel Edge Runtime
// 토스페이먼츠 결제 승인 API
//
// 요청 (POST /api/toss-confirm):
// {
//   paymentKey: string        // Toss에서 successUrl로 전달된 paymentKey
//   orderId: string           // CheckoutPage에서 생성한 주문 ID
//   amount: number            // 결제 금액 (원)
// }
//
// 응답:
// 성공: 200 { ok: true, payment: { /* Toss 응답 원본 */ } }
// 실패: 400/500 { ok: false, code: string, message: string }
//
// 시크릿 키는 더 이상 클라이언트에서 받지 않는다. 서버가 Supabase payment_secret
// 테이블(service_role)에서 직접 읽어 사용 → 고객 브라우저에 절대 노출되지 않음.
// 필수 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

export const config = { runtime: 'edge' }

interface ConfirmBody {
  paymentKey?: string
  orderId?: string
  amount?: number
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json(405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'POST만 허용됩니다.' })
  }

  let body: ConfirmBody
  try {
    body = await req.json()
  } catch {
    return json(400, { ok: false, code: 'INVALID_JSON', message: '요청 본문이 유효한 JSON이 아닙니다.' })
  }

  const { paymentKey, orderId, amount } = body
  if (!paymentKey || !orderId || typeof amount !== 'number') {
    return json(400, {
      ok: false,
      code: 'MISSING_PARAMS',
      message: 'paymentKey, orderId, amount는 모두 필수입니다.',
    })
  }

  // 시크릿 키 — Supabase payment_secret 테이블에서 서버측 조회 (service_role, RLS 우회)
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json(500, { ok: false, code: 'SUPABASE_MISSING_ENV', message: '서버 결제 설정이 누락되었습니다.' })
  }
  let secretKey = ''
  try {
    const secRes = await fetch(
      `${SUPABASE_URL}/rest/v1/payment_secret?id=eq.main&select=secret_key&limit=1`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    )
    const rows = await secRes.json().catch(() => [])
    secretKey = Array.isArray(rows) && rows[0]?.secret_key ? String(rows[0].secret_key) : ''
  } catch {
    return json(502, { ok: false, code: 'SECRET_FETCH_FAILED', message: '결제 키 조회에 실패했습니다.' })
  }
  if (!secretKey) {
    return json(400, {
      ok: false, code: 'SECRET_NOT_CONFIGURED',
      message: '결제 승인 키가 설정되지 않았습니다. 관리자에서 시크릿 키를 저장해주세요.',
    })
  }

  // Toss Confirm API 호출 — Basic 인증 (secretKey + ':' base64)
  const basicToken = base64Encode(secretKey + ':')

  let tossRes: Response
  try {
    tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })
  } catch (err) {
    return json(502, {
      ok: false,
      code: 'TOSS_NETWORK_ERROR',
      message: err instanceof Error ? err.message : '토스 API 호출 실패',
    })
  }

  const tossBody = await tossRes.json().catch(() => ({}))

  if (!tossRes.ok) {
    // Toss 에러 응답 형식: { code: string, message: string }
    return json(tossRes.status, {
      ok: false,
      code: tossBody?.code || 'TOSS_ERROR',
      message: tossBody?.message || '토스 결제 승인에 실패했습니다.',
      rawData: tossBody,
    })
  }

  return json(200, { ok: true, payment: tossBody })
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

// Edge Runtime: btoa는 UTF-8 호환 문자열에만 안전 (Secret Key는 ASCII라 OK)
function base64Encode(s: string): string {
  if (typeof btoa === 'function') return btoa(s)
  // 폴백 (혹시 btoa 미지원 환경일 때)
  return Buffer.from(s, 'utf-8').toString('base64')
}
