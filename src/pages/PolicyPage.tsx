import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useSiteSettings } from '../hooks/useSiteSettings'
import { renderMarkdown } from '../utils/markdown'

const TITLES: Record<string, string> = {
  privacy: '개인정보처리방침',
  terms: '이용약관',
  refund: '환불 정책',
  copyright: '저작권 안내',
}

export default function PolicyPage() {
  const { type } = useParams<{ type: string }>()
  const { get } = useSiteSettings()
  const settings = get()
  const key = type as keyof typeof settings.policies
  const content = settings.policies?.[key] || ''
  const title = TITLES[key] || '정책'

  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = `${title} — JUMCLASS`
  }, [type, title])

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <h1 style={{ marginTop: 0 }}>{title}</h1>
        </div>
      </section>

      <div className="container" style={{ paddingTop: '40px', paddingBottom: '100px', maxWidth: '780px' }}>
        <div className="policy-content">
          {content ? renderMarkdown(content) : (
            <p style={{ color: 'var(--t2)', textAlign: 'center', padding: '60px 0' }}>내용이 등록되지 않았습니다.</p>
          )}
        </div>
      </div>

    </>
  )
}
