import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSiteSettings } from '../hooks/useSiteSettings'
import { useCourses } from '../hooks/useCourses'

const TITLES: Record<string, string> = {
  privacy: '개인정보처리방침',
  terms: '이용약관',
  refund: '환불 정책',
  copyright: '저작권 안내',
}

function renderMarkdown(md: string) {
  const lines = md.split('\n')
  const elements: React.ReactElement[] = []
  let inTable = false
  let tableRows: string[][] = []

  function flushTable() {
    if (tableRows.length < 2) return
    const headers = tableRows[0]
    const rows = tableRows.slice(2)
    elements.push(
      <table key={elements.length} className="policy-table">
        <thead><tr>{headers.map((h, i) => <th key={i}>{h.trim()}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c.trim()}</td>)}</tr>)}</tbody>
      </table>
    )
    tableRows = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('|')) {
      inTable = true
      tableRows.push(line.split('|').filter(Boolean))
      continue
    }
    if (inTable) { inTable = false; flushTable() }
    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="policy-h1">{line.slice(2)}</h1>)
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="policy-h3">{line.slice(4)}</h3>)
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="policy-h2">{line.slice(3)}</h2>)
    } else if (line.startsWith('- ')) {
      elements.push(<li key={i} className="policy-li">{line.slice(2)}</li>)
    } else if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: '12px' }} />)
    } else {
      elements.push(<p key={i} className="policy-p">{line}</p>)
    }
  }
  if (inTable) flushTable()
  return elements
}

export default function PolicyPage() {
  const { type } = useParams<{ type: string }>()
  const { get } = useSiteSettings()
  const { getPublicCourses } = useCourses()
  const settings = get()
  const key = type as keyof typeof settings.policies
  const content = settings.policies?.[key] || ''
  const title = TITLES[key] || '정책'

  document.title = `${title} — JUMCLASS`

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

      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <span className="logo">JUMCLASS</span>
              <p>{settings.brandDescription}</p>
            </div>
            <div className="footer-col">
              <h4>강의</h4>
              {getPublicCourses().map(c => <Link key={c.id} to={`/course/${c.id}`}>{c.title}</Link>)}
            </div>
            <div className="footer-col">
              <h4>플랫폼</h4>
              <Link to="/classroom">내 강의실</Link>
              <Link to="/instructors">강사 소개</Link>
              <a href="/#contact">문의</a>
            </div>
            <div className="footer-col">
              <h4>정책</h4>
              <Link to="/policy/privacy">개인정보처리방침</Link>
              <Link to="/policy/terms">이용약관</Link>
              <Link to="/policy/refund">환불 정책</Link>
              <Link to="/policy/copyright">저작권 안내</Link>
            </div>
          </div>
          <div className="footer-bottom">
            <span>{settings.copyright}</span>
            <span>{settings.businessInfo}</span>
          </div>
        </div>
      </footer>
    </>
  )
}
