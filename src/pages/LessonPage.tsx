import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useCourses } from '../hooks/useCourses'
import { useAuth } from '../hooks/useAuth'
import { useAuthModal } from '../components/auth/AuthModal'
import { useToast } from '../components/ui/Toast'

export default function LessonPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { getCourse } = useCourses()
  const { isEnrolled, getEnrollment, completeLesson } = useAuth()
  const { openAuth } = useAuthModal()
  const toast = useToast()

  const courseId = params.get('course') || ''
  const lessonId = params.get('lesson') || ''
  const course = getCourse(courseId)

  useEffect(() => {
    if (course) document.title = `${course.title} — JUMCLASS`
    return () => { document.title = 'JUMCLASS' }
  }, [course])

  if (!course) {
    return (
      <div className="auth-gate" style={{ paddingTop: '140px' }}>
        <div className="g-ico">🌙</div>
        <h2>강의를 찾을 수 없습니다</h2>
        <button className="btn btn-primary" onClick={() => navigate('/courses')}>강의 목록으로</button>
      </div>
    )
  }

  const enrolled = isEnrolled(courseId)
  const enrollment = getEnrollment(courseId)
  const done = enrollment?.completedLessons || []
  const allLessons = course.curriculum.flatMap(s => s.items)
  const firstFree = allLessons.find(l => l.status === 'free')

  let cur = lessonId ? allLessons.find(l => l.id === lessonId) : firstFree || allLessons[0]

  if (!enrolled && cur?.status === 'locked') {
    if (!firstFree) {
      return (
        <div className="auth-gate" style={{ paddingTop: '140px' }}>
          <div className="g-ico">🔒</div>
          <h2>수강신청이 필요합니다</h2>
          <p>이 강의는 수강신청 후 이용 가능합니다.</p>
          <button className="btn btn-gold mt-16" onClick={() => navigate(`/checkout?course=${courseId}`)}>
            수강신청하기
          </button>
        </div>
      )
    }
    cur = firstFree
  }

  if (!cur) {
    return (
      <div className="auth-gate" style={{ paddingTop: '140px' }}>
        <div className="g-ico">😕</div>
        <h2>강의를 찾을 수 없습니다</h2>
      </div>
    )
  }

  const idx = allLessons.findIndex(l => l.id === cur!.id)
  const prev = idx > 0 ? allLessons[idx - 1] : null
  const next = idx < allLessons.length - 1 ? allLessons[idx + 1] : null
  const isDone = done.includes(cur.id)

  function goTo(id: string) {
    navigate(`/lesson?course=${courseId}&lesson=${id}`)
  }

  function markDone(id: string) {
    completeLesson(courseId, id)
    toast('완료 처리됐습니다! ✦', 'ok')
  }

  return (
    <div className="lesson-wrap" style={{ marginTop: 'var(--nav-h)' }}>
      {/* 메인 콘텐츠 */}
      <div className="lesson-main">
        <div className="video-box">
          <iframe
            src={`https://player.vimeo.com/video/${cur.vimeo}?title=0&byline=0&portrait=0&color=7C6FCD`}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--gold)', marginBottom: '5px' }}>
              {course.title}
            </div>
            <h2 className="lesson-title">{cur.title}</h2>
          </div>
          {enrolled && (
            <button className={`btn btn-sm ${isDone ? 'btn-ghost' : 'btn-primary'}`} onClick={() => markDone(cur!.id)}>
              {isDone ? '✓ 완료됨' : '완료로 표시'}
            </button>
          )}
        </div>

        <p className="lesson-sub">강의를 충분히 살펴보며 학습하세요. 첨부된 학습 자료를 활용하면 이해를 더 깊게 할 수 있습니다.</p>

        {/* 첨부 파일 */}
        {course.attachments && course.attachments.length > 0 && (
          <div className="attach-list">
            <div className="attach-head">📎 학습 자료</div>
            {course.attachments.map((a, i) => (
              <div key={i} className="attach-item">
                <span>{a.ext === 'pdf' ? '📄' : '🖼'}</span>
                <span>{a.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: '.72rem', color: 'var(--t3)', textTransform: 'uppercase' }}>{a.ext}</span>
              </div>
            ))}
          </div>
        )}

        {/* 네비게이션 */}
        <div className="lesson-nav">
          {prev ? (
            <button className="btn btn-ghost" onClick={() => goTo(prev.id)}>← 이전 강의</button>
          ) : <div />}
          {next ? (
            <button className="btn btn-primary" onClick={() => goTo(next.id)}>다음 강의 →</button>
          ) : (
            <button className="btn btn-gold" onClick={() => navigate('/classroom')}>✓ 강의 완료!</button>
          )}
        </div>

        {/* 미수강자 CTA */}
        {!enrolled && (
          <div style={{ marginTop: '24px', padding: '20px 24px', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 'var(--r3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '.9rem', fontWeight: 700, marginBottom: '3px' }}>전체 강의 수강하기</div>
              <div style={{ fontSize: '.82rem', color: 'var(--t2)' }}>총 {course.lessons}강 · {course.duration} · 학습 자료 포함</div>
            </div>
            <button className="btn btn-gold btn-lg" onClick={() => navigate(`/checkout?course=${courseId}`)}>
              수강신청
            </button>
          </div>
        )}
      </div>

      {/* 사이드바 */}
      <div className="lesson-sidebar">
        <div className="side-head">강의 목차 ({allLessons.length}강)</div>
        {course.curriculum.map((sec, si) => (
          <div key={si} className="curr-sidebar-section">
            <div className="curr-sidebar-head">{sec.section}</div>
            {sec.items.map(item => {
              const isActive = item.id === cur!.id
              const itemDone = done.includes(item.id)
              const isLocked = !enrolled && item.status === 'locked'
              let iconClass = 'ic-idle', iconChar = '○'
              if (itemDone) { iconClass = 'ic-done'; iconChar = '✓' }
              else if (isActive) { iconClass = 'ic-play'; iconChar = '▶' }
              else if (isLocked) { iconClass = 'ic-lock'; iconChar = '🔒' }

              return (
                <div key={item.id}
                  className={`curr-sidebar-item ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                  onClick={() => isLocked ? openAuth('login') : goTo(item.id)}
                >
                  <div className={`s-icon ${iconClass}`}>{iconChar}</div>
                  <span className="s-title">{item.title}</span>
                  <span className="s-dur">{item.duration}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
