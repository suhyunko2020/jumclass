import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Course } from '../../data/types'
import { formatPrice, discountRate, calcTotalDuration, getLevelColor } from '../../utils/format'

interface Props {
  course: Course
  enrolledCount?: string
}

// Vimeo 썸네일 캐시 (vimeoId → URL, '' = 썸네일 없음). 카드 간 재요청 방지
const thumbCache = new Map<string, string>()

export default function CourseCard({ course, enrolledCount }: Props) {
  const navigate = useNavigate()
  const dr = discountRate(course.originalPrice, course.price)
  const lc = getLevelColor(course.level)

  // 썸네일: 직접 지정값 우선 → 없으면 첫 강의 Vimeo 영상의 공식 썸네일(첫 화면) 자동 사용
  const firstVimeo = course.curriculum?.flatMap(s => s.items).find(i => i.vimeo)?.vimeo
  const [thumb, setThumb] = useState<string>(
    course.thumbnail || (firstVimeo ? thumbCache.get(firstVimeo) ?? '' : ''),
  )

  useEffect(() => {
    if (course.thumbnail || !firstVimeo) return
    if (thumbCache.has(firstVimeo)) { setThumb(thumbCache.get(firstVimeo) || ''); return }
    let alive = true
    // Vimeo oEmbed — 공개 영상은 썸네일 URL, 비공개/제한 영상은 null → 이모지 폴백
    fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${firstVimeo}&width=720`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const url = (d && d.thumbnail_url) || ''
        thumbCache.set(firstVimeo, url)
        if (alive) setThumb(url)
      })
      .catch(() => { thumbCache.set(firstVimeo, ''); if (alive) setThumb('') })
    return () => { alive = false }
  }, [firstVimeo, course.thumbnail])

  const finalThumb = course.thumbnail || thumb

  return (
    <div className="course-card" onClick={() => navigate(`/course/${course.id}`)}>
      <div className="card-thumb">
        {finalThumb ? (
          <img
            src={finalThumb}
            alt={course.title}
            className="card-thumb-img"
            loading="lazy"
            onError={() => setThumb('')}
          />
        ) : (
          <span style={{ fontSize: '3.5rem' }}>{course.emoji}</span>
        )}
        {course.badge && <span className="card-badge">{course.badge}</span>}
      </div>
      <div className="card-body">
        <div style={{ fontSize: '.73rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: lc.color, marginBottom: '5px' }}>
          {course.level}
        </div>
        <div className="card-title">{course.title}</div>
        <div className="card-sub">{course.subtitle}</div>
        <div className="card-meta">
          <span>🎬 {course.lessons}강</span>
          <span>⏱ {calcTotalDuration(course.curriculum)}</span>
          {enrolledCount && <span>👥 {enrolledCount}명</span>}
        </div>
        <div className="card-footer">
          <div>
            <div className="card-orig">{formatPrice(course.originalPrice)}</div>
            <div className="card-price">{formatPrice(course.price)}</div>
          </div>
          {dr > 0 && (
            <span style={{
              fontSize: '.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--pill)',
              background: 'rgba(52,196,124,.1)', color: 'var(--ok)', border: '1px solid rgba(52,196,124,.2)',
            }}>
              {dr}% 할인
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
