import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import Player from '@vimeo/player'
import { useCourses } from '../hooks/useCourses'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ui/Toast'
import { calcTotalDuration } from '../utils/format'
import { getLessonAttachments, getAttachmentDownloadUrl } from '../hooks/useCourses'
import { logAccess } from '../utils/accessLog'
import { getMyInquiries, getCertificateAgreementByEnrollment } from '../utils/storage'
import { refundRecords, isEnrollmentRefunded, type RefundRecord } from '../lib/refundStatus'
import type { LessonAtt } from '../hooks/useCourses'

export default function LessonPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { getCourse, addReview, hasReviewed } = useCourses()
  const { user, loading: authLoading, isEnrolled, getEnrollment, completeLesson, updateLessonWatch, logAttachmentDownload, refreshUser } = useAuth()
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

  // 환불 처리 내역 로드 — 환불된 수강건은 직접 URL 접근도 차단하기 위함
  const [refundRecs, setRefundRecs] = useState<RefundRecord[]>([])
  useEffect(() => {
    if (!user) { setRefundRecs([]); return }
    getMyInquiries(user.uid).then(qs => setRefundRecs(refundRecords(qs))).catch(() => {})
  }, [user?.uid])

  // 자격증 동의서 서명 여부 로드 — 묶음 강의(미서명 자격증) 직접 접근 차단용
  const [certSignedMap, setCertSignedMap] = useState<Record<string, boolean>>({})
  const [certSignedLoaded, setCertSignedLoaded] = useState(false)
  useEffect(() => {
    if (!user) { setCertSignedMap({}); setCertSignedLoaded(false); return }
    const certEnrs = (user.enrollments || []).filter(en => getCourse(en.courseId)?.level === '자격증')
    if (certEnrs.length === 0) { setCertSignedMap({}); setCertSignedLoaded(true); return }
    setCertSignedLoaded(false)
    Promise.all(certEnrs.map(async en => {
      const a = await getCertificateAgreementByEnrollment(user.uid, en.courseId, en.assignedInstructorId)
      return [`${en.courseId}:${en.assignedInstructorId || ''}`, !!a] as const
    })).then(rs => {
      const m: Record<string, boolean> = {}
      rs.forEach(([k, v]) => { m[k] = v })
      setCertSignedMap(m)
      setCertSignedLoaded(true)
    }).catch(() => setCertSignedLoaded(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

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
  const watchSaveWarnedRef = useRef(false)  // 진도 저장 실패 경고 1회만

  const courseId = params.get('course') || ''
  const lessonId = params.get('lesson') || ''
  const course = getCourse(courseId)

  useEffect(() => {
    if (course) document.title = `${course.title} — JUMCLASS`
    return () => { document.title = 'JUMCLASS' }
  }, [course])

  // 접속 로그 — 강의 진입 (lesson 단위, IP/기기는 서버에서 수집)
  // 결제자='lesson_view'(강의 수강), 비결제자 무료 미리보기='lesson_preview'.
  // (비결제자가 잠긴 강의를 실제 재생하는 비정상 접근은 handleWatchProgress에서 'lesson_breach'로 별도 기록)
  useEffect(() => {
    if (!course) return
    const all = course.curriculum.flatMap(s => s.items)
    const free = all.find(l => l.status === 'free')
    let lesson = lessonId ? all.find(l => l.id === lessonId) : free || all[0]
    const enr = isEnrolled(course.id)
    if (!enr && lesson?.status === 'locked') lesson = free   // 비결제자는 무료 강의로 게이팅됨 → 실제 보게 될 강의 기준
    const event = enr ? 'lesson_view' : 'lesson_preview'
    logAccess({ event, courseId: course.id, courseTitle: course.title, lessonId: lesson?.id, lessonTitle: lesson?.title, userId: user?.uid, userName: user?.name, userEmail: user?.email })
  }, [course?.id, user?.uid, lessonId])

  // 자격증 과정은 강의 시청 페이지가 없음 — 직접 URL 접근 시 강의실로 리디렉트
  useEffect(() => {
    if (course && course.level === '자격증') navigate('/classroom', { replace: true })
  }, [course, navigate])

  // 묶음 강의 잠금 — 미서명 자격증에 묶인 무료 인터넷강의는 동의서 작성 전 시청 불가
  useEffect(() => {
    if (!certSignedLoaded || !course || !user) return
    const gated = (user.enrollments || []).some(en =>
      getCourse(en.courseId)?.level === '자격증' &&
      certSignedMap[`${en.courseId}:${en.assignedInstructorId || ''}`] !== true &&
      (en.bundled || []).some(b => b.courseId === course.id))
    if (gated) {
      toast('먼저 자격증 과정 수강 동의서를 작성해주세요.', 'err')
      navigate('/classroom', { replace: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certSignedLoaded, course?.id, user?.uid])

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

  const enrollment = getEnrollment(courseId)
  // 환불 처리된 수강건은 접근 차단 (직접 URL 포함) — isEnrolled는 환불을 모르므로 별도 판정
  const refunded = !!enrollment && isEnrollmentRefunded(courseId, enrollment.enrolledAt, refundRecs)
  const enrolled = isEnrolled(courseId) && !refunded
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

  // 순차 학습 — 현재 강의 완료(90% 시청 or 완료표시) 전에는 다음 강의로 못 넘어감.
  // frontierIdx = 첫 미완료 강의 위치(=지금 풀린 마지막 지점). 이전 완료 강의는 자유 이동.
  const firstIncomplete = allLessons.findIndex(l => !done.includes(l.id))
  const frontierIdx = firstIncomplete === -1 ? allLessons.length - 1 : firstIncomplete
  const isSeqLocked = (targetIdx: number) => enrolled && targetIdx > frontierIdx

  function goTo(id: string) {
    const ti = allLessons.findIndex(l => l.id === id)
    if (isSeqLocked(ti)) {
      toast('현재 강의를 완료(90% 이상 시청)해야 다음 강의로 넘어갈 수 있어요.', 'info')
      return
    }
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

  // 영상 시청률 반영 — 시청 시간에 비례해 진도 게이지가 참. (수강생만)
  async function handleWatchProgress(id: string, pct: number) {
    // 보안 — 비결제자가 잠긴(유료) 강의를 실제 재생 중이면 비정상 접근으로 기록.
    // 정상 게이팅이면 비결제자는 무료 강의만 재생되므로 0건이어야 함. (이 이벤트 발생 = 구조적 결함/우회)
    const lesson = allLessons.find(l => l.id === id)
    if (!enrolled && lesson && lesson.status !== 'free') {
      logAccess({ event: 'lesson_breach', courseId, courseTitle: course?.title, lessonId: id, lessonTitle: lesson.title, userId: user?.uid, userName: user?.name, userEmail: user?.email })
      return
    }
    if (!enrolled) return
    const res = await updateLessonWatch(courseId, id, pct)
    if (!res.ok && res.error && !watchSaveWarnedRef.current) {
      watchSaveWarnedRef.current = true
      toast(`진도 저장 실패: ${res.error}`, 'err')
    }
    // 90% 이상 시청으로 전체 강의가 완료되면 리뷰 모달
    if (pct >= 90) {
      const updatedDone = new Set([...done, id])
      if (allLessons.every(l => updatedDone.has(l.id)) && user && !hasReviewed(courseId, user.uid)) {
        setTimeout(() => setReviewModal(true), 600)
      }
    }
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setReviewSubmitting(true)
    const already = hasReviewed(courseId, user.uid)
    const result = await addReview(courseId, user.uid, user.name, user.avatar, reviewRating, reviewText, 'user')
    setReviewSubmitting(false)
    if (result) {
      toast('리뷰가 등록되었습니다! 감사합니다 ✦', 'ok')
      setReviewModal(false)
    } else if (already) {
      toast('이미 리뷰를 작성했습니다.', 'info')
      setReviewModal(false)
    } else {
      toast('리뷰 등록에 실패했습니다. 잠시 후 다시 시도해주세요.', 'err')
    }
  }

  return (
    <div className="lesson-wrap" style={{ marginTop: 'var(--nav-h)' }}>
      {/* 메인 콘텐츠 */}
      <div className="lesson-main">
        <LessonVideo vimeo={cur.vimeo} onProgress={pct => handleWatchProgress(cur!.id, pct)} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--gold)', marginBottom: '5px' }}>
              {course.title}
            </div>
            <h2 className="lesson-title">{cur.title}</h2>
          </div>
          {enrolled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '.74rem', color: 'var(--t3)', whiteSpace: 'nowrap' }}>
                이 영상 <strong style={{ color: 'var(--purple-2)' }}>{enrollment?.lessonWatch?.[cur.id] ?? 0}%</strong> 시청
                <span style={{ margin: '0 6px', opacity: .4 }}>·</span>
                전체 진도 <strong style={{ color: 'var(--gold-2)' }}>{enrollment?.progress ?? 0}%</strong>
              </span>
              <button className={`btn btn-sm ${isDone ? 'btn-ghost' : 'btn-primary'}`} onClick={() => markDone(cur!.id)}>
                {isDone ? '✓ 완료됨' : '완료로 표시'}
              </button>
            </div>
          )}
        </div>

        <p className="lesson-sub">강의를 충분히 살펴보며 학습하세요. 첨부된 학습 자료를 활용하면 이해를 더 깊게 할 수 있습니다.</p>

        {/* 강의별 첨부 파일 — 커리큘럼에 박힌 첨부 우선(Supabase 동기화), 없으면 레거시 캐시 폴백 */}
        {(() => {
          const lessonAtts: LessonAtt[] = (cur.attachments && cur.attachments.length > 0)
            ? cur.attachments
            : getLessonAttachments(cur.id)
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
            isSeqLocked(idx + 1) ? (
              <button className="btn btn-ghost" style={{ opacity: .6 }}
                onClick={() => toast('현재 강의를 완료(90% 이상 시청)해야 다음으로 넘어갈 수 있어요.', 'info')}>
                🔒 다음 강의 (완료 필요)
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => goTo(next.id)}>다음 강의 →</button>
            )
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
              const tIdx = allLessons.findIndex(l => l.id === item.id)
              const isPreviewLock = !enrolled && item.status === 'locked'  // 비결제자 미리보기 잠금
              const isSeqLock = isSeqLocked(tIdx)                          // 순차 완료 잠금
              const isLocked = isPreviewLock || isSeqLock
              let iconClass = 'ic-idle', iconChar = '○'
              if (itemDone) { iconClass = 'ic-done'; iconChar = '✓' }
              else if (isActive) { iconClass = 'ic-play'; iconChar = '▶' }
              else if (isLocked) { iconClass = 'ic-lock'; iconChar = '🔒' }

              return (
                <div key={item.id}
                  className={`curr-sidebar-item ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                  style={{ cursor: isPreviewLock ? 'default' : 'pointer' }}
                  onClick={() => { if (isPreviewLock) return; goTo(item.id) }}
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

// 영상 플레이어 — Vimeo SDK로 시청률을 추적해 onProgress(0~100)로 보고.
// 5% 단위로만 보고(과도한 갱신 방지) + 일시정지/종료 시 현재 시청률 플러시.
function LessonVideo({ vimeo, onProgress }: { vimeo: string; onProgress: (percent: number) => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const cbRef = useRef(onProgress)
  cbRef.current = onProgress

  useEffect(() => {
    const el = iframeRef.current
    if (!el) return
    let player: Player | null = null
    let maxPct = 0
    let lastBucket = -1
    const report = (pct: number) => {
      if (pct > maxPct) maxPct = pct
      const bucket = Math.floor(maxPct / 5)
      if (bucket > lastBucket) { lastBucket = bucket; cbRef.current(maxPct) }
    }
    try {
      player = new Player(el)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pctOf = (d: any) => Math.round((d?.percent ?? 0) * 100)
      player.on('timeupdate', d => report(pctOf(d)))
      // seeked: 막대를 인위적으로 끌어 이동했을 때도 그 지점까지 진도 반영
      player.on('seeked', d => report(pctOf(d)))
      player.on('ended', () => cbRef.current(100))
      player.on('pause', () => { if (maxPct > 0) cbRef.current(maxPct) })
    } catch { /* SDK 초기화 실패는 무시 (시청은 정상) */ }
    return () => {
      if (player) { player.off('timeupdate'); player.off('ended'); player.off('pause') }
    }
  }, [vimeo])

  return (
    <div className="video-box">
      <iframe
        ref={iframeRef}
        src={`https://player.vimeo.com/video/${vimeo}?title=0&byline=0&portrait=0&color=7C6FCD`}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
