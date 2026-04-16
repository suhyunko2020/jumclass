import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAuthModal } from '../components/auth/AuthModal'
import { useCourses } from '../hooks/useCourses'
import { useToast } from '../components/ui/Toast'
import CourseCard from '../components/course/CourseCard'

export default function ClassroomPage() {
  const { user, getEnrollment, pauseCourse, resumeCourse } = useAuth()
  const { getPublicCourses, getCourse, hasReviewed, addReview } = useCourses()
  const { openAuth } = useAuthModal()
  const navigate = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState<'active' | 'expired'>('active')

  const [reviewModal, setReviewModal] = useState<{ courseId: string; courseTitle: string } | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  async function submitReview(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !reviewModal) return
    setReviewSubmitting(true)
    const result = await addReview(reviewModal.courseId, user.uid, user.name, user.avatar, reviewRating, reviewText, 'user')
    setReviewSubmitting(false)
    if (result) {
      toast('리뷰가 등록되었습니다! 감사합니다 ✦', 'ok')
      setReviewModal(null)
      setReviewRating(5)
      setReviewText('')
    } else {
      toast('이미 리뷰를 작성했습니다.', 'info')
      setReviewModal(null)
    }
  }

  if (!user) {
    return (
      <div className="auth-gate" style={{ paddingTop: '140px' }}>
        <div className="g-ico">🔮</div>
        <h2>강의실에 오신 것을 환영합니다</h2>
        <p>로그인하면 수강 중인 강의와 진도를 확인할 수 있습니다.</p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          <button className="btn btn-primary" onClick={() => openAuth('login')}>로그인</button>
          <button className="btn btn-ghost" onClick={() => openAuth('signup')}>무료 회원가입</button>
        </div>
      </div>
    )
  }

  const enrollments = user.enrollments || []
  const active = enrollments.filter(e => e.paused || new Date(e.expiryDate) > new Date())
  const expired = enrollments.filter(e => !e.paused && new Date(e.expiryDate) <= new Date())
  const all = getPublicCourses()
  const notEnrolled = all.filter(c => !enrollments.some(e => e.courseId === c.id)).slice(0, 2)

  async function doPause(courseId: string) {
    const c = getCourse(courseId)
    const enr = getEnrollment(courseId)
    const maxP = c?.pauseConfig?.maxPauses || 0
    const used = enr?.pauseCount || 0
    if (!confirm(`휴강을 신청하시겠습니까?\n\n• 사용한 휴강: ${used}/${maxP}회\n• 휴강 중에는 강의 시청이 불가합니다.\n• "강의 시작" 버튼으로 언제든지 해제 가능합니다.`)) return
    const ok = await pauseCourse(courseId)
    if (ok) toast('휴강이 신청되었습니다.', 'ok')
    else toast('휴강 가능 횟수를 모두 사용했습니다.', 'err')
  }

  async function doResume(courseId: string) {
    const ok = await resumeCourse(courseId)
    if (ok) toast('강의가 재개되었습니다! 🎉', 'ok')
  }

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <h1>안녕하세요, {user.name}님 ✦</h1>
          <p>오늘도 타로 여정을 이어가세요.</p>
        </div>
      </section>

      <div className="container" style={{ paddingBottom: '100px' }}>
        {/* 탭 */}
        <div className="tabs" style={{ marginTop: '28px', marginBottom: '24px' }}>
          <button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
            수강 중 ({active.length})
          </button>
          {expired.length > 0 && (
            <button className={`tab ${tab === 'expired' ? 'active' : ''}`} onClick={() => setTab('expired')}>
              수강 종료 ({expired.length})
            </button>
          )}
        </div>

        {/* 수강 중 */}
        {tab === 'active' && (
          <div className="my-list">
            {active.length > 0 ? active.map(e => {
              const c = getCourse(e.courseId)
              if (!c) return null
              const prog = e.progress || 0
              const isPaused = !!e.paused
              const daysLeft = isPaused
                ? (e.remainingDays || 0)
                : Math.ceil((new Date(e.expiryDate).getTime() - Date.now()) / 86400000)
              const maxPauses = c.pauseConfig?.maxPauses || 0
              const usedPauses = e.pauseCount || 0
              const canPause = maxPauses > 0 && usedPauses < maxPauses && !isPaused

              return (
                <div key={e.courseId} className={`my-card${isPaused ? ' paused' : ''}`}
                  onClick={() => !isPaused && navigate(`/lesson?course=${c.id}`)}>
                  <div className="my-card-thumb">{c.emoji}</div>
                  <div className="my-card-body">
                    {/* 타이틀 + 상태 뱃지 */}
                    <div className="my-card-top">
                      <div className="my-card-title">{c.title}</div>
                      {isPaused
                        ? <span className="my-card-status-warn">⏸ 휴강중</span>
                        : <span className="my-card-status-ok">● 수강중</span>}
                    </div>
                    {/* 메타 */}
                    <div className="my-card-meta">
                      {c.instructor} · {c.lessons}강 · {c.duration}
                    </div>
                    {/* 진도 */}
                    <div className="prog-wrap">
                      <div className="prog-bar">
                        <div className="prog-fill" style={{ width: `${prog}%` }} />
                      </div>
                      <div className="prog-text">
                        {prog}% 완료 · {isPaused ? `휴강 중 (잔여 ${daysLeft}일)` : `잔여 ${daysLeft}일 남음`}
                      </div>
                    </div>
                    {/* 액션 버튼 */}
                    <div className="my-card-actions">
                      {isPaused ? (
                        <button className="btn btn-primary btn-sm"
                          onClick={e2 => { e2.stopPropagation(); doResume(c.id) }}>
                          강의 재개하기 →
                        </button>
                      ) : (
                        <button className="btn btn-primary btn-sm"
                          onClick={e2 => { e2.stopPropagation(); navigate(`/lesson?course=${c.id}`) }}>
                          계속 수강하기 →
                        </button>
                      )}
                      {user && (() => {
                        const reviewed = hasReviewed(c.id, user.uid)
                        return reviewed ? (
                          <button className="btn btn-ghost btn-sm" disabled
                            style={{ fontSize: '.75rem', color: 'var(--t3)', opacity: .5, cursor: 'default' }}
                            onClick={e2 => e2.stopPropagation()}>
                            ✓ 리뷰 작성 완료
                          </button>
                        ) : (
                          <button className="btn btn-ghost btn-sm"
                            style={{ fontSize: '.75rem', color: 'var(--gold)' }}
                            onClick={e2 => { e2.stopPropagation(); setReviewModal({ courseId: c.id, courseTitle: c.title }) }}>
                            ⭐ 리뷰 작성하기
                          </button>
                        )
                      })()}
                      {canPause && (
                        <button className="btn btn-ghost btn-sm"
                          style={{ fontSize: '.75rem', color: 'var(--t3)' }}
                          onClick={e2 => { e2.stopPropagation(); doPause(c.id) }}>
                          ⏸ 휴강신청 ({usedPauses}/{maxPauses})
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            }) : (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '14px' }}>📚</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px' }}>수강 중인 강의가 없습니다</div>
                <div style={{ fontSize: '.875rem', color: 'var(--t2)', marginBottom: '20px' }}>첫 강의를 시작해보세요</div>
                <Link to="/courses" className="btn btn-primary">강의 둘러보기</Link>
              </div>
            )}
          </div>
        )}

        {/* 수강 종료 */}
        {tab === 'expired' && (
          <div className="my-list">
            {expired.map(e => {
              const c = getCourse(e.courseId)
              if (!c) return null
              return (
                <div key={e.courseId} className="my-card" style={{ opacity: .7, cursor: 'default' }}>
                  <div className="my-card-thumb" style={{ position: 'relative' }}>
                    {c.emoji}
                    <div className="expired-cover">수강 종료</div>
                  </div>
                  <div className="my-card-body">
                    <div className="my-card-top">
                      <div className="my-card-title">{c.title}</div>
                      <span style={{ flexShrink: 0, fontSize: '.68rem', fontWeight: 700, padding: '3px 9px', borderRadius: 'var(--pill)', background: 'rgba(224,82,82,.1)', color: 'var(--fail)', border: '1px solid rgba(224,82,82,.2)', whiteSpace: 'nowrap' }}>수강 종료</span>
                    </div>
                    <div className="my-card-meta">{c.instructor} · {c.lessons}강 · {c.duration}</div>
                    <div className="my-card-actions">
                      <Link to={`/checkout?course=${c.id}`} className="btn btn-primary btn-sm"
                        onClick={e2 => e2.stopPropagation()}>
                        재수강 신청 →
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 추천 강의 */}
        {active.length > 0 && notEnrolled.length > 0 && (
          <div style={{ marginTop: '64px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
              <div style={{ fontSize: '.75rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t3)' }}>
                다음 강의 추천
              </div>
              <div style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-.02em' }}>이런 강의는 어떠세요?</div>
              <Link to="/courses" style={{ fontSize: '.82rem', color: 'var(--purple-2)' }}>전체 보기 →</Link>
            </div>
            <div className="courses-grid">
              {notEnrolled.map(c => <CourseCard key={c.id} course={c} />)}
            </div>
          </div>
        )}
      </div>

      {/* 리뷰 작성 모달 */}
      {reviewModal && (
        <div className="modal-overlay" onClick={e2 => { if (e2.target === e2.currentTarget) setReviewModal(null) }}>
          <div className="modal-box" style={{ position: 'relative', maxWidth: '460px' }}>
            <button className="modal-close" onClick={() => setReviewModal(null)}>✕</button>
            <div className="modal-head" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>⭐</div>
              <h2>리뷰 작성</h2>
              <p style={{ fontSize: '.85rem', color: 'var(--t2)' }}>{reviewModal.courseTitle}</p>
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
                    onChange={e2 => setReviewText(e2.target.value)} />
                </div>
                <button type="submit" className="btn btn-gold w-full btn-lg" disabled={reviewSubmitting}>
                  {reviewSubmitting ? '등록 중...' : '리뷰 등록하기'}
                </button>
                <button type="button" className="btn btn-ghost w-full btn-sm" style={{ marginTop: '8px' }}
                  onClick={() => setReviewModal(null)}>
                  취소
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
