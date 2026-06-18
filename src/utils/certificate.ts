// 수료증 생성 — 관리자가 업로드한 A4 템플릿 이미지 위에
// 수강생 이름 / 강의명 / 수료일을 그려서 PNG로 반환·다운로드한다.
//
// 텍스트 위치는 기본 템플릿(Prime muse / CERTIFICATE OF ACHIEVEMENT) 기준의
// 이미지 비율(0~1) 좌표. 템플릿을 바꾸면 POSITIONS를 조정하면 된다.

export interface CertificateParams {
  templateUrl: string
  name: string         // 수강생 이름
  courseName: string   // 수료한 강의명
  date: string         // 수료일 (예: '2026. 06. 18.')
}

// 이미지 너비/높이 대비 비율 좌표 + 폰트 크기(높이 대비 비율)
// 템플릿의 빨간 표시 위치 기준 (PRESENTED TO 아래 이름줄 / 그 아래 강의명 / 오른쪽 DATE 위)
const POSITIONS = {
  // 큰 이름 — 가운데, 금색 줄 위 중앙 (선과 간격 확보)
  name:   { x: 0.5,   y: 0.466, size: 0.030, color: '#1e3a4c', weight: '700', family: '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif' },
  // 강의명 — 이름 아래 (작게)
  course: { x: 0.5,   y: 0.533, size: 0.016, color: '#1e3a4c', weight: '700', family: '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif' },
  // 수료일 — 오른쪽 금색 줄 위, DATE 라벨과 같은 중심(x)에 정렬
  date:   { x: 0.700, y: 0.694, size: 0.018, color: '#1e3a4c', weight: '700', family: '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif' },
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'   // Supabase public URL — 캔버스 오염 방지
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('템플릿 이미지를 불러오지 못했습니다.'))
    img.src = url
  })
}

// 너무 긴 강의명은 폰트를 줄여 한 줄에 맞춤
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, baseSize: number, weight: string, family: string): number {
  let size = baseSize
  ctx.font = `${weight} ${size}px ${family}`
  while (ctx.measureText(text).width > maxWidth && size > baseSize * 0.5) {
    size -= 1
    ctx.font = `${weight} ${size}px ${family}`
  }
  return size
}

export interface RenderedCertificate {
  dataUrl: string   // PNG dataURL (미리보기용)
  width: number     // 템플릿 픽셀 너비
  height: number    // 템플릿 픽셀 높이
}

// 템플릿 위에 텍스트를 합성해 PNG dataURL + 크기를 반환 (미리보기/PDF 공통)
export async function renderCertificate(p: CertificateParams): Promise<RenderedCertificate> {
  const img = await loadImage(p.templateUrl)
  const W = img.naturalWidth || img.width
  const H = img.naturalHeight || img.height

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스를 생성할 수 없습니다.')

  ctx.drawImage(img, 0, 0, W, H)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const items: { text: string; pos: typeof POSITIONS.name }[] = [
    { text: p.name, pos: POSITIONS.name },
    { text: p.courseName, pos: POSITIONS.course },
    { text: p.date, pos: POSITIONS.date },
  ]
  for (const { text, pos } of items) {
    if (!text) continue
    const baseSize = Math.round(H * pos.size)
    const size = fitText(ctx, text, W * 0.78, baseSize, pos.weight, pos.family)
    ctx.font = `${pos.weight} ${size}px ${pos.family}`
    ctx.fillStyle = pos.color
    ctx.fillText(text, W * pos.x, H * pos.y)
  }

  return { dataUrl: canvas.toDataURL('image/png'), width: W, height: H }
}

// PDF로 저장 — 템플릿 비율 그대로(A4 너비 210mm 기준 단일 페이지, 왜곡 없음)
export async function downloadCertificatePdf(cert: RenderedCertificate, filename: string): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const wMm = 210
  const hMm = Math.round((210 * cert.height / cert.width) * 100) / 100
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [wMm, hMm] })
  doc.addImage(cert.dataUrl, 'PNG', 0, 0, wMm, hMm)
  doc.save(filename)
}
