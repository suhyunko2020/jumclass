import { useEffect } from 'react'
import { useSiteSettings } from '../../hooks/useSiteSettings'

export default function SeoHead() {
  const { get } = useSiteSettings()
  const s = get()

  useEffect(() => {
    const setMeta = (name: string, content: string, attr = 'name') => {
      if (!content) return
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el) }
      el.content = content
    }

    document.title = s.seoTitle || 'JUMCLASS'
    setMeta('description', s.seoDescription)
    setMeta('keywords', s.seoKeywords)
    setMeta('og:title', s.seoTitle, 'property')
    setMeta('og:description', s.seoDescription, 'property')
    setMeta('og:type', 'website', 'property')
    if (s.ogImage) setMeta('og:image', s.ogImage, 'property')
    setMeta('twitter:card', 'summary_large_image', 'name')
    setMeta('twitter:title', s.seoTitle)
    setMeta('twitter:description', s.seoDescription)

    document.documentElement.lang = 'ko'
  }, [s])

  return null
}
