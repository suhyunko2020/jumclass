import { useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useSiteSettings } from '../hooks/useSiteSettings'
import { renderMarkdown } from '../utils/markdown'
import { usePageSeo } from '../components/ui/SeoHead'

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  } catch { return '' }
}

// 고정(pinned) 우선 → 최신순 정렬
function sortNotices<T extends { pinned?: boolean; createdAt: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

export default function NoticePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { get } = useSiteSettings()
  const announcements = get().announcements ?? []
  const notices = sortNotices(announcements)

  // 페이지별 SEO — 상세는 공지 제목, 목록은 공지사항
  const detailNotice = id ? announcements.find(n => n.id === id) : null
  usePageSeo(
    id
      ? (detailNotice
          ? {
              title: `${detailNotice.title} | 점클래스 공지사항`,
              description: detailNotice.body.replace(/[#*_>`~\-\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 150),
            }
          : { title: '공지사항 | 점클래스' })
      : { title: '공지사항 | 점클래스', description: '점클래스의 리뉴얼 오픈 안내 등 새 소식과 공지사항을 확인하세요.' }
  )

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  // ── 상세 보기 ──
  if (id) {
    const notice = announcements.find(n => n.id === id)
    if (!notice) {
      return (
        <>
          <section className="page-hero">
            <div className="container"><h1 style={{ marginTop: 0 }}>공지사항</h1></div>
          </section>
          <div className="container" style={{ padding: '60px 0 100px', textAlign: 'center', color: 'var(--t2)' }}>
            <p>존재하지 않거나 삭제된 공지입니다.</p>
            <Link to="/notice" className="btn btn-ghost" style={{ marginTop: '16px' }}>← 목록으로</Link>
          </div>
        </>
      )
    }
    return (
      <>
        <section className="page-hero">
          <div className="container">
            <span className="section-kicker">공지사항</span>
            <h1 style={{ marginTop: '10px' }}>{notice.title}</h1>
            <p style={{ color: 'var(--t3)' }}>{formatDate(notice.createdAt)}</p>
          </div>
        </section>
        <div className="container" style={{ paddingTop: '40px', paddingBottom: '60px', maxWidth: '780px' }}>
          <div className="policy-content">{renderMarkdown(notice.body)}</div>
          <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid var(--line)' }}>
            <button className="btn btn-ghost" onClick={() => navigate('/notice')}>← 공지 목록</button>
          </div>
        </div>
      </>
    )
  }

  // ── 목록 보기 ──
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="section-kicker">고객센터</span>
          <h1 style={{ marginTop: '10px' }}>공지사항</h1>
          <p>점클래스의 새로운 소식과 안내를 확인하세요.</p>
        </div>
      </section>

      <div className="container" style={{ paddingTop: '36px', paddingBottom: '100px', maxWidth: '820px' }}>
        {notices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--t3)' }}>
            등록된 공지사항이 없습니다.
          </div>
        ) : (
          <div className="notice-list">
            {notices.map(n => (
              <Link key={n.id} to={`/notice/${n.id}`} className="notice-item">
                <div className="notice-item-main">
                  {n.pinned && <span className="notice-pin">공지</span>}
                  <span className="notice-title">{n.title}</span>
                </div>
                <span className="notice-date">{formatDate(n.createdAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
