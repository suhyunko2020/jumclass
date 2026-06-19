import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSiteSettings, type PopupSettings } from '../../hooks/useSiteSettings'

// 팝업 내용으로부터 "버전 키" 생성 — 내용이 바뀌면 '오늘 하루 보지 않기'가 초기화되어 다시 노출됨
function popupKey(p: PopupSettings): string {
  const raw = `${p.title}|${p.body}|${p.imageUrl}|${p.linkType}|${p.linkAnnouncementId}|${p.linkUrl}`
  let h = 0
  for (let i = 0; i < raw.length; i++) { h = (h * 31 + raw.charCodeAt(i)) | 0 }
  return 'jum_popup_' + (h >>> 0).toString(36)
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export default function SitePopup() {
  const { get } = useSiteSettings()
  const navigate = useNavigate()
  const popup = get().popup
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!popup?.enabled) return
    if (!popup.title && !popup.body && !popup.imageUrl) return
    // '오늘 하루 보지 않기'를 누른 날이면 노출 생략
    try {
      const seen = localStorage.getItem(popupKey(popup))
      if (seen === todayStr()) return
    } catch { /* 무시 */ }
    // 첫 페인트 직후 노출 (살짝 지연으로 깜빡임 방지)
    const t = setTimeout(() => setOpen(true), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup?.enabled])

  if (!open || !popup) return null

  function close() { setOpen(false) }

  function dismissToday() {
    try { localStorage.setItem(popupKey(popup), todayStr()) } catch { /* 무시 */ }
    setOpen(false)
  }

  function goLink() {
    if (popup.linkType === 'announcement' && popup.linkAnnouncementId) {
      close(); navigate(`/notice/${popup.linkAnnouncementId}`)
    } else if (popup.linkType === 'url' && popup.linkUrl) {
      window.open(popup.linkUrl, '_blank', 'noopener,noreferrer')
      close()
    } else {
      close()
    }
  }

  const hasLink = (popup.linkType === 'announcement' && !!popup.linkAnnouncementId)
    || (popup.linkType === 'url' && !!popup.linkUrl)

  return (
    <div className="popup-overlay" onClick={e => { if (e.target === e.currentTarget) close() }}>
      <div className="popup-box">
        <button className="popup-close" onClick={close} aria-label="닫기">✕</button>

        {popup.imageUrl && (
          <div className="popup-img-wrap">
            {hasLink
              ? <button className="popup-img-btn" onClick={goLink}><img src={popup.imageUrl} alt={popup.title || '공지'} /></button>
              : <img src={popup.imageUrl} alt={popup.title || '공지'} />}
          </div>
        )}

        {(popup.title || popup.body) && (
          <div className="popup-content">
            {popup.title && <h3 className="popup-title">{popup.title}</h3>}
            {popup.body && (
              <p className="popup-body">
                {popup.body.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}
              </p>
            )}
            {hasLink && (
              <button className="btn btn-primary w-full" style={{ marginTop: '6px' }} onClick={goLink}>
                {popup.buttonText || '자세히 보기'} →
              </button>
            )}
          </div>
        )}

        <div className="popup-foot">
          <button className="popup-foot-btn" onClick={dismissToday}>오늘 하루 보지 않기</button>
          <button className="popup-foot-btn" onClick={close}>닫기</button>
        </div>
      </div>
    </div>
  )
}
