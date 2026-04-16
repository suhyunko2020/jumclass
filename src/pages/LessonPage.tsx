import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useCourses } from '../hooks/useCourses'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ui/Toast'
import { calcTotalDuration } from '../utils/format'
import { getLessonAttachments } from '../hooks/useCourses'

export default function LessonPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { getCourse, addReview, hasReviewed } = useCourses()
  const { user, isEnrolled, getEnrollment, completeLesson } = useAuth()
  const toast = useToast()

  const [reviewModal, setReviewModal] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

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

  async function markDone(id: string) {
    await completeLesson(courseId, id)
    toast('완료 처리됐습니다! ✦', 'ok')

    const updatedDone = new Set([...done, id])
    const allComplete = allLessons.every(l => updatedDone.has(l.id))
    if (allComplete && user && !hasReviewed(courseId, user.uid)) {
      setTimeout(() => setReviewModal(true), 600)
    }
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setReviewSubmitting(true)
    const result = await addReview(courseId, user.uid, user.name, user.avatar, reviewRating, reviewText, 'user')
    setReviewSubmitting(false)
    if (result) {
      toast('리뷰가 등록되었습니다! 감사합니다 ✦', 'ok')
      setReviewModal(false)
    } else {
      toast('이미 리뷰를 작성했습니다.', 'info')
      setReviewModal(false)
    }
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

        {/* 강의별 첨부 파일 */}
        {(() => {
          const lessonAtts = getLessonAttachments(cur.id)
          return lessonAtts.length > 0 ? (
            <div className="attach-list">
              <div className="attach-head">학습 자료</div>
              {lessonAtts.map((a, i) => (
                <a key={i} href={a.url} download={`${a.name}.${a.ext}`} target="_blank" rel="noopener noreferrer" className="attach-item" style={{ cursor: 'pointer' }}>
                  <span>{a.ext === 'pdf' ? '📄' : '📎'}</span>
                  <span>{a.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '.72rem', color: 'var(--purple-2)', fontWeight: 600 }}>다운로드</span>
                </a>
              ))}
            </div>
          ) : null
        })()}

        {/* 강의 전체 첨부 파일 */}
        {course.attachments && course.attachments.length > 0 && (
          <div className="attach-list">
            <div className="attach-head">강의 자료</div>
            {course.attachments.map((a, i) => (
              <div key={i} className="attach-item">
                <span>{a.ext === 'pdf' ? '📄' : '📎'}</span>
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
              <div style={{ fontSize: '.82rem', color: 'var(--t2)' }}>총 {course.lessons}강 · {calcTotalDuration(course.curriculum)} · 학습 자료 포함</div>
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
                  style={{ cursor: isLocked ? 'default' : 'pointer' }}
                  onClick={() => { if (!isLocked) goTo(item.id) }}
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

      {/* 리뷰 작성 모달 */}
      {reviewModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setReviewModal(false) }}>
          <div className="modal-box" style={{ position: 'relative', maxWidth: '460px' }}>
            <button className="modal-close" onClick={() => setReviewModal(false)}>✕</button>
            <div className="modal-head" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎉</div>
              <h2>강의를 완료했습니다!</h2>
              <p style={{ fontSize: '.85rem', color: 'var(--t2)' }}>수강 경험을 공유해주세요.</p>
            </div>
            <div className="modal-body">
              <form onSubmit={submitReview}>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{ fontSize: '.8rem', color: 'var(--t3)', marginBottom: '8px' }}>별점을 선택하세요</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} type="button"
                        onClick={() => setReviewRating(n)}
                        style={{
                          fontSize: '1.8rem', cursor: 'pointer', transition: 'transform .15s',
                          transform: reviewRating >= n ? 'scale(1.1)' : 'scale(1)',
                          filter: reviewRating >= n ? 'none' : 'grayscale(1) opacity(.3)',
                        }}
                      >★</button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <textarea className="form-input" rows={4}
                    placeholder="어떤 점이 좋았나요? 다른 수강생에게 도움이 될 리뷰를 남겨주세요."
                    required value={reviewText}
                    onChange={e => setReviewText(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-gold w-full btn-lg" disabled={reviewSubmitting}>
                  {reviewSubmitting ? '등록 중...' : '리뷰 등록하기'}
                </button>
                <button type="button" className="btn btn-ghost w-full btn-sm" style={{ marginTop: '8px' }}
                  onClick={() => setReviewModal(false)}>
                  나중에 작성하기
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
