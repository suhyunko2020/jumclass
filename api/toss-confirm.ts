// Vercel Edge Runtime
// 토스페이먼츠 결제 승인 API
//
// 요청 (POST /api/toss-confirm):
// {
//   paymentKey: string        // Toss에서 successUrl로 전달된 paymentKey
//   orderId: string           // CheckoutPage에서 생성한 주문 ID
//   amount: number            // 결제 금액 (원)
//   secretKey: string         // 토스 Secret Key (관리자 설정, localStorage 저장)
// }
//
// 응답:
// 성공: 200 { ok: true, payment: { /* Toss 응답 원본 */ } }
// 실패: 400/500 { ok: false, code: string, message: string }
//
// 주의: Secret Key는 클라이언트에서 body로 전달됨 — HTTPS 전송이지만 서버 env var 대비
// 네트워크 노출 면적이 조금 더 큼. 관리자 UI 편의를 위해 의도적으로 이 구조를 채택.

export const config = { runtime: 'edge' }

interface ConfirmBody {
  paymentKey?: string
  orderId?: string
  amount?: number
  secretKey?: string
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

  const { paymentKey, orderId, amount, secretKey } = body
  if (!paymentKey || !orderId || typeof amount !== 'number' || !secretKey) {
    return json(400, {
      ok: false,
      code: 'MISSING_PARAMS',
      message: 'paymentKey, orderId, amount, secretKey는 모두 필수입니다.',
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
