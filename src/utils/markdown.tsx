import React from 'react'

// 간단한 마크다운 렌더러 — 정책/공지 등 관리자 작성 본문 공용.
// 지원: # 제목, ## 소제목, ### 소소제목, - 목록, | 표 |, 빈 줄 간격
export function renderMarkdown(md: string): React.ReactElement[] {
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
