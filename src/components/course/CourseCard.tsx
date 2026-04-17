import { useNavigate } from 'react-router-dom'
import type { Course } from '../../data/types'
import { formatPrice, discountRate, calcTotalDuration, getLevelColor } from '../../utils/format'

interface Props {
  course: Course
  enrolledCount?: string
}

export default function CourseCard({ course, enrolledCount }: Props) {
  const navigate = useNavigate()
  const dr = discountRate(course.originalPrice, course.price)
  const lc = getLevelColor(course.level)

  return (
    <div className="course-card" onClick={() => navigate(`/course/${course.id}`)}>
      <div className="card-thumb">
        <span style={{ fontSize: '3.5rem' }}>{course.emoji}</span>
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
