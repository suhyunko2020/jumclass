import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useCourses } from '../hooks/useCourses'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ui/Toast'
import { calcTotalDuration } from '../utils/format'
import { getLessonAttachments, getAttachmentDownloadUrl } from '../hooks/useCourses'
import type { LessonAtt } from '../hooks/useCourses'

export default function LessonPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { getCourse, addReview, hasReviewed } = useCourses()
  const { user, loading: authLoading, isEnrolled, getEnrollment, completeLesson, logAttachmentDownload, refreshUser } = useAuth()
  const toast = useToast()

  // 로그아웃/비로그인 시 홈으로 리디렉트 — 강의 시청 페이지는 공유 차단 필수
  useEffect(() => {
    if (authLoading) return
    if (!user) navigate('/', { replace: true })
  }, [user, authLoading, navigate])

  // 진입 시 최신 수강 상태 강제 새로고침 — 캐시된 만료된 수강권으로 접근 차단
  useEffect(() => {
    if (user) refreshUser()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [reviewModal, setReviewModal] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  // 첨부파일 다운로드 동의 모달 — att는 LessonAtt (path 또는 url 보유)
  const [downloadModal, setDownloadModal] = useState<{
    att: LessonAtt; filename: string; name: string; lessonId: string;
  } | null>(null)
  const [downloadAgreed, setDownloadAgreed] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const courseId = params.get('course') || ''
  const lessonId = params.get('lesson') || ''
  const course = getCourse(courseId)

  useEffect(() => {
    if (course) document.title = `${course.title} — JUMCLASS`
    return () => { document.title = 'JUMCLASS' }
  }, [course])

  if (authLoading) {
    return (
      <div className="loading" style={{ paddingTop: '140px' }}>
        <div className="spinner" />
      </div>
    )
  }

  // 리디렉트 대기
  if (!user) return null

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
          const downloadHistory = enrollment?.attachmentDownloads ?? []
          const hasDownloaded = (filename: string) =>
            downloadHistory.some(d => d.lessonId === cur!.id && d.attachmentName === filename)

          // 이미 동의/다운로드한 항목은 모달 없이 즉시 다운로드 (수강 기간 내에서만)
          async function directDownload(att: LessonAtt) {
            if (!enrolled) { toast('수강 신청 후 자료를 다운로드할 수 있습니다.', 'err'); return }
            const filename = `${att.name}.${att.ext}`
            try {
              const url = await getAttachmentDownloadUrl(att)
              if (!url) { toast('다운로드 링크를 생성할 수 없습니다.', 'err'); return }
              await logAttachmentDownload(courseId, cur!.id, filename)
              const link = document.createElement('a')
              link.href = url
              link.download = filename
              link.target = '_blank'
              link.rel = 'noopener noreferrer'
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
            } catch {
              toast('다운로드 처리 중 오류가 발생했습니다.', 'err')
            }
          }

          return lessonAtts.length > 0 ? (
            <div className="attach-list">
              <div className="attach-head">학습 자료</div>
              {lessonAtts.map((a, i) => {
                const filename = `${a.name}.${a.ext}`
                const already = hasDownloaded(filename)
                return (
                  <button
                    key={i}
                    type="button"
                    className="attach-item"
                    style={{ cursor: 'pointer', textAlign: 'left', width: '100%', background: 'transparent', border: 'none', font: 'inherit', color: 'inherit' }}
                    onClick={() => {
                      if (!enrolled) { toast('수강 신청 후 자료를 다운로드할 수 있습니다.', 'err'); return }
                      if (already) {
                        directDownload(a)
                        return
                      }
                      setDownloadAgreed(false)
                      setDownloadModal({
                        att: a,
                        filename,
                        name: a.name,
                        lessonId: cur!.id,
                      })
                    }}
                  >
                    <span>{a.ext === 'pdf' ? '📄' : '📎'}</span>
                    <span>{a.name}</span>
                    <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      {already && (
                        <span style={{ fontSize: '.68rem', color: 'var(--ok)', background: 'rgba(52,196,124,.1)', padding: '2px 7px', borderRadius: 'var(--pill)', fontWeight: 600 }}>
                          ✓ 동의함
                        </span>
                      )}
                      <span style={{ fontSize: '.72rem', color: 'var(--purple-2)', fontWeight: 600 }}>다운로드</span>
                    </span>
                  </button>
                )
              })}
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

      {/* 첨부파일 다운로드 동의 모달 */}
      {downloadModal && (
        <div className="modal-overlay" onClick={() => !downloading && setDownloadModal(null)}>
          <div className="modal-box" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => !downloading && setDownloadModal(null)}>✕</button>
            <div className="modal-head" style={{ paddingBottom: '14px' }}>
              <h2 style={{ fontSize: '1.05rem' }}>학습 자료 다운로드 안내</h2>
              <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(124,111,205,.06)', border: '1px solid rgba(124,111,205,.18)', borderRadius: 'var(--r2)', fontSize: '.84rem', color: 'var(--t1)' }}>
                <span style={{ color: 'var(--t3)', marginRight: '6px' }}>교재명 :</span>
                <strong>{downloadModal.name}</strong>
              </div>
            </div>
            <div className="modal-body" style={{ paddingBottom: '24px' }}>
              <div style={{ fontSize: '.86rem', color: 'var(--t1)', lineHeight: 1.7, padding: '16px 18px', background: 'rgba(232,156,56,.06)', border: '1px solid rgba(232,156,56,.2)', borderRadius: 'var(--r2)', marginBottom: '16px' }}>
                <div style={{ fontWeight: 700, color: 'var(--warn)', marginBottom: '10px' }}>다운로드 시 유의사항</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--t2)', fontSize: '.84rem', lineHeight: 1.65 }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ color: 'var(--t3)', flexShrink: 0 }}>-</span>
                    <span>이 학습 자료를 다운로드하면 <strong style={{ color: 'var(--t1)' }}>해당 강의가 자동으로 수강 완료 처리</strong>됩니다.</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ color: 'var(--t3)', flexShrink: 0 }}>-</span>
                    <span>교재(첨부파일)는 강의 콘텐츠의 일부로, 한 번 다운로드된 강의는 환불 시 <strong style={{ color: 'var(--t1)' }}>수강 분으로 차감</strong>됩니다.</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ color: 'var(--t3)', flexShrink: 0 }}>-</span>
                    <span>본 교재(첨부파일)의 저작권은 <strong style={{ color: 'var(--t1)' }}>(주)골든에이지</strong>에 있으며 수강생 본인에게만 제공하는 자료입니다. 타인에게 양도, 재판매 등은 저작권 위반으로 민형사상 처벌을 받을 수 있습니다.</span>
                  </div>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '12px 14px', background: 'rgba(6,7,15,.5)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 'var(--r2)' }}>
                <input
                  type="checkbox"
                  checked={downloadAgreed}
                  onChange={e => setDownloadAgreed(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--purple-2)', cursor: 'pointer', flexShrink: 0 }}
                  disabled={downloading}
                />
                <span style={{ fontSize: '.86rem', color: 'var(--t1)' }}>
                  <span style={{ color: 'var(--fail)', fontWeight: 700, marginRight: '4px' }}>(필수)</span>
                  위 안내를 확인했으며 다운로드에 동의합니다.
                </span>
              </label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-ghost w-full"
                  onClick={() => setDownloadModal(null)}
                  disabled={downloading}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  disabled={!downloadAgreed || downloading}
                  onClick={async () => {
                    if (!downloadAgreed || !downloadModal) return
                    setDownloading(true)
                    try {
                      const url = await getAttachmentDownloadUrl(downloadModal.att)
                      if (!url) { toast('다운로드 링크를 생성할 수 없습니다.', 'err'); return }
                      await logAttachmentDownload(courseId, downloadModal.lessonId, downloadModal.filename)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = downloadModal.filename
                      a.target = '_blank'
                      a.rel = 'noopener noreferrer'
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                      toast('다운로드를 시작합니다. 해당 강의가 수강 완료로 처리되었습니다.', 'ok')
                      setDownloadModal(null)
                    } catch {
                      toast('다운로드 처리 중 오류가 발생했습니다.', 'err')
                    } finally {
                      setDownloading(false)
                    }
                  }}
                >
                  {downloading ? '처리 중…' : '동의하고 다운로드'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
