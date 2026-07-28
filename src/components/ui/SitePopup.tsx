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

// 저장값은 "다시 노출해도 되는 시각(ms)" 또는 'forever'.
// 과거 버전에서 저장한 'YYYY-M-D'(오늘 하루 보지 않기) 형식도 그대로 인식한다.
const FOREVER = 'forever'

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

// 저장된 값 기준으로 지금 팝업을 숨겨야 하는지 판단
function isDismissed(raw: string | null): boolean {
  if (!raw) return false
  if (raw === FOREVER) return true
  if (raw === todayStr()) return true          // 구버전 호환
  const until = Number(raw)
  return Number.isFinite(until) && Date.now() < until
}

export default function SitePopup() {
  const { get } = useSiteSettings()
  const navigate = useNavigate()
  const popup = get().popup
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!popup?.enabled) return
    if (!popup.title && !popup.body && !popup.imageUrl) return
    // '다시 보지 않기 / N일간 보지 않기'를 누른 상태면 노출 생략
    try {
      if (isDismissed(localStorage.getItem(popupKey(popup)))) return
    } catch { /* 무시 */ }
    // 첫 페인트 직후 노출 (살짝 지연으로 깜빡임 방지)
    const t = setTimeout(() => setOpen(true), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup?.enabled])

  if (!open || !popup) return null

  function close() { setOpen(false) }

  // 관리자가 설정한 재노출 정책에 따라 숨김 기간을 저장
  function dismiss() {
    const mode = popup.dismissMode || 'daily'
    let value = ''
    if (mode === 'forever') value = FOREVER
    else if (mode === 'days') {
      const days = Math.max(1, popup.dismissDays || 7)
      value = String(Date.now() + days * 86400000)
    } else {
      // daily — 오늘 자정까지
      const end = new Date(); end.setHours(23, 59, 59, 999)
      value = String(end.getTime())
    }
    try { localStorage.setItem(popupKey(popup), value) } catch { /* 무시 */ }
    setOpen(false)
  }

  const dismissLabel =
    popup.dismissMode === 'forever' ? '다시 보지 않기'
    : popup.dismissMode === 'days' ? `${Math.max(1, popup.dismissDays || 7)}일 동안 보지 않기`
    : '오늘 하루 보지 않기'

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
          {popup.dismissMode !== 'always' && (
            <button className="popup-foot-btn" onClick={dismiss}>{dismissLabel}</button>
          )}
          <button className="popup-foot-btn" onClick={close}>닫기</button>
        </div>
      </div>
    </div>
  )
}
