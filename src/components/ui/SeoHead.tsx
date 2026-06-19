import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useSiteSettings } from '../../hooks/useSiteSettings'

const SITE_URL = 'https://jumclass.com'
const SITE_NAME = '점클래스'
const DEFAULT_OG = `${SITE_URL}/og.png`

// 페이지에서 넘기는 SEO 오버라이드
export interface PageSeo {
  title?: string
  description?: string
  image?: string
  type?: string          // og:type (기본 website)
  noindex?: boolean
  jsonLd?: object         // 페이지 단위 구조화 데이터(JSON-LD)
}

const SeoContext = createContext<(s: PageSeo | null) => void>(() => {})

// 페이지 컴포넌트에서 호출 → 해당 페이지가 떠 있는 동안만 SEO를 덮어씀(언마운트 시 자동 해제).
export function usePageSeo(seo: PageSeo | null) {
  const setSeo = useContext(SeoContext)
  const key = JSON.stringify(seo)
  useEffect(() => {
    setSeo(seo)
    return () => setSeo(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

// ── DOM 헬퍼 ──
function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  const el = document.head.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null
  if (!content) { if (el) el.remove(); return }
  if (el) { el.content = content; return }
  const m = document.createElement('meta'); m.setAttribute(attr, name); m.content = content; document.head.appendChild(m)
}
function setCanonical(href: string) {
  let el = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
  if (!el) { el = document.createElement('link'); el.rel = 'canonical'; document.head.appendChild(el) }
  el.href = href
}
function setJsonLd(obj: object | null) {
  const id = 'page-jsonld'
  let el = document.getElementById(id) as HTMLScriptElement | null
  if (!obj) { if (el) el.remove(); return }
  if (!el) { el = document.createElement('script'); el.id = id; el.type = 'application/ld+json'; document.head.appendChild(el) }
  el.textContent = JSON.stringify(obj)
}

// SEO를 실제로 <head>에 반영하는 단일 작성자(Provider 내부에서만 렌더)
function SeoWriter({ override }: { override: PageSeo | null }) {
  const { get } = useSiteSettings()
  const s = get()
  const { pathname } = useLocation()

  useEffect(() => {
    const title = override?.title || s.seoTitle || `${SITE_NAME} | 타로 온라인 강의 · 타로 자격증`
    const description = override?.description || s.seoDescription || ''
    const image = override?.image || s.ogImage || DEFAULT_OG
    const url = SITE_URL + pathname
    const type = override?.type || 'website'

    document.title = title
    document.documentElement.lang = 'ko'

    setMeta('description', description)
    setMeta('keywords', s.seoKeywords)
    setMeta('robots', override?.noindex ? 'noindex, nofollow' : 'index, follow')
    setCanonical(url)

    setMeta('og:site_name', SITE_NAME, 'property')
    setMeta('og:locale', 'ko_KR', 'property')
    setMeta('og:type', type, 'property')
    setMeta('og:title', title, 'property')
    setMeta('og:description', description, 'property')
    setMeta('og:url', url, 'property')
    setMeta('og:image', image, 'property')

    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', title)
    setMeta('twitter:description', description)
    setMeta('twitter:image', image)

    setJsonLd(override?.jsonLd || null)
  }, [s, override, pathname])

  return null
}

// App 최상단을 감싸는 Provider. 내부에 SeoWriter를 1개만 둔다.
export function SeoProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<PageSeo | null>(null)
  return (
    <SeoContext.Provider value={setOverride}>
      <SeoWriter override={override} />
      {children}
    </SeoContext.Provider>
  )
}

export const SEO_SITE_URL = SITE_URL
export const SEO_SITE_NAME = SITE_NAME
