// Vimeo 영상 식별자 파싱 유틸.
//
// 관리자에서 붙여넣는 값은 형태가 제각각이라(전체 URL / 임베드 코드 / ID?h=해시 / 숫자 ID)
// 저장·재생 시점에 항상 여기를 거쳐 { id, hash }로 정규화한다.
//
// 특히 "비공개 링크(Unlisted/Private link)" 영상은 숫자 ID만으로는 재생되지 않고
// 반드시 프라이버시 해시(h=...)가 함께 있어야 하므로, 해시를 잃지 않는 것이 중요하다.

export interface VimeoRef {
  id: string     // 숫자 영상 ID
  hash: string   // 프라이버시 해시(없으면 '')
}

// 다양한 입력에서 영상 ID와 프라이버시 해시를 뽑아낸다.
// 지원 형태:
//   123456789
//   123456789?h=abc123 / 123456789/abc123
//   https://vimeo.com/123456789
//   https://vimeo.com/123456789/abc123        (비공개 링크)
//   https://vimeo.com/123456789?h=abc123
//   https://player.vimeo.com/video/123456789?h=abc123
//   <iframe src="https://player.vimeo.com/video/123456789?h=abc123" ...>  (임베드 코드)
export function parseVimeo(input: string): VimeoRef {
  const raw = (input || '').trim()
  if (!raw) return { id: '', hash: '' }

  // 임베드 코드(iframe)면 src 값만 먼저 뽑아낸다
  const srcMatch = raw.match(/src=["']([^"']+)["']/i)
  const text = srcMatch ? srcMatch[1] : raw

  // 숫자만 있는 순수 ID
  if (/^\d+$/.test(text)) return { id: text, hash: '' }

  // 영상 ID: player.vimeo.com/video/{id} 또는 vimeo.com/{id} 또는 선두 숫자
  const idMatch =
    text.match(/(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/i) || text.match(/^(\d+)/)
  const id = idMatch ? idMatch[1] : ''
  if (!id) return { id: '', hash: '' }

  // 해시: ?h=xxxx 또는 /{id}/xxxx 경로 형태
  const hashMatch =
    text.match(/[?&]h=([a-zA-Z0-9]+)/) ||
    text.match(new RegExp(`(?:vimeo\\.com/(?:video/)?)?${id}/([a-zA-Z0-9]+)`))
  return { id, hash: hashMatch ? hashMatch[1] : '' }
}

// 저장용 정규화 값. 해시가 있으면 "id?h=해시", 없으면 "id".
// (기존에 저장된 순수 숫자 ID와 호환되는 형식)
export function normalizeVimeo(input: string): string {
  const { id, hash } = parseVimeo(input)
  if (!id) return ''
  return hash ? `${id}?h=${hash}` : id
}

// 플레이어 임베드 URL. 비공개 링크 영상은 h 파라미터가 있어야 재생된다.
export function vimeoEmbedUrl(input: string): string {
  const { id, hash } = parseVimeo(input)
  if (!id) return ''
  const params = new URLSearchParams({ title: '0', byline: '0', portrait: '0', color: '7C6FCD' })
  if (hash) params.set('h', hash)
  return `https://player.vimeo.com/video/${id}?${params.toString()}`
}

// oEmbed 조회용 URL(썸네일·길이). 비공개 링크 영상도 해시를 붙이면 조회된다.
export function vimeoOembedTarget(input: string): string {
  const { id, hash } = parseVimeo(input)
  if (!id) return ''
  return hash ? `https://vimeo.com/${id}/${hash}` : `https://vimeo.com/${id}`
}
