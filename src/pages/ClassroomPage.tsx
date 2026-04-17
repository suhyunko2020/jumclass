import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAuthModal } from '../components/auth/AuthModal'
import { useCourses } from '../hooks/useCourses'
import { useToast } from '../components/ui/Toast'
import CourseCard from '../components/course/CourseCard'
import { calcTotalDuration } from '../utils/format'
import {
  getProgressPageByEnrollment,
  getCertificateAgreementByEnrollment,
  type CertificateAgreementRecord,
} from '../utils/storage'
import { CERTIFICATE_AGREEMENT } from '../data/certificateAgreement'
import type { InstructorProgressPage } from '../data/types'

export default function ClassroomPage() {
  const { user, loading: authLoading, getEnrollment, pauseCourse, resumeCourse } = useAuth()
  const { getPublicCourses, getCourse, hasReviewed, addReview } = useCourses()
  const { openAuth } = useAuthModal()
  const navigate = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState<'active' | 'expired'>('active')

  const [reviewModal, setReviewModal] = useState<{ courseId: string; courseTitle: string } | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  // 자격증 과정 — 강사 진도 페이지 캐시 (체크리스트 + 진행률)
  const [certProgressMap, setCertProgressMap] = useState<Record<string, InstructorProgressPage | null>>({})
  // 진도 확인 모달
  const [progressViewModal, setProgressViewModal] = useState<{ courseId: string; courseTitle: string } | null>(null)
  // 약관 보기 모달
  const [agreementModal, setAgreementModal] = useState<{ courseId: string; courseTitle: string } | null>(null)
  const [agreementRecord, setAgreementRecord] = useState<CertificateAgreementRecord | null>(null)
  const [agreementLoading, setAgreementLoading] = useState(false)

  // 자격증 강의들의 진도 페이지를 일괄 조회 (enrollments 로드 후)
  useEffect(() => {
    if (!user) return
    const certIds = (user.enrollments || [])
      .filter(e => getCourse(e.courseId)?.level === '자격증')
      .map(e => e.courseId)
    if (certIds.length === 0) { setCertProgressMap({}); return }
    Promise.all(certIds.map(async id => {
      const page = await getProgressPageByEnrollment(user.uid, id)
      return [id, page] as const
    })).then(results => {
      const map: Record<string, InstructorProgressPage | null> = {}
      results.forEach(([id, p]) => { map[id] = p })
      setCertProgressMap(map)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, (user?.enrollments || []).length])

  // 약관 모달 열릴 때 서명 정보 로드
  useEffect(() => {
    if (!agreementModal || !user) { setAgreementRecord(null); return }
    setAgreementLoading(true)
    getCertificateAgreementByEnrollment(user.uid, agreementModal.courseId).then(rec => {
      setAgreementRecord(rec)
      setAgreementLoading(false)
    })
  }, [agreementModal, user])

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

  if (authLoading) {
    return (
      <div className="loading" style={{ paddingTop: '140px' }}>
        <div className="spinner" />
      </div>
    )
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
              const isCert = c.level === '자격증'
              const isPaused = !!e.paused
              const daysLeft = isPaused
                ? (e.remainingDays || 0)
                : Math.ceil((new Date(e.expiryDate).getTime() - Date.now()) / 86400000)
              const maxPauses = c.pauseConfig?.maxPauses || 0
              const usedPauses = e.pauseCount || 0
              const canPause = !isCert && maxPauses > 0 && usedPauses < maxPauses && !isPaused

              // 자격증: 강사 체크 진도 기반, 일반: enrollment.progress
              const certPage = isCert ? certProgressMap[c.id] : null
              const certChecked = certPage?.checklist.filter(i => i.checked).length ?? 0
              const certTotal = certPage?.checklist.length ?? 0
              const prog = isCert
                ? (certTotal > 0 ? Math.round((certChecked / certTotal) * 100) : 0)
                : (e.progress || 0)

              return (
                <div key={e.courseId} className={`my-card${isPaused ? ' paused' : ''}`}
                  style={{ cursor: isCert ? 'default' : undefined }}
                  onClick={() => !isPaused && !isCert && navigate(`/lesson?course=${c.id}`)}>
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
                      {c.instructor} · {isCert ? `${certTotal}회차 과정` : `${c.lessons}강 · ${calcTotalDuration(c.curriculum)}`}
                    </div>
                    {/* 진도 */}
                    <div className="prog-wrap">
                      <div className="prog-bar">
                        <div className="prog-fill" style={{ width: `${prog}%` }} />
                      </div>
                      <div className="prog-text">
                        {isCert
                          ? `${certChecked}/${certTotal}회차 완료${certTotal > 0 ? ` (${prog}%)` : ''} · 잔여 ${daysLeft}일 남음`
                          : `${prog}% 완료 · ${isPaused ? `휴강 중 (잔여 ${daysLeft}일)` : `잔여 ${daysLeft}일 남음`}`}
                      </div>
                    </div>
                    {/* 액션 버튼 */}
                    <div className="my-card-actions">
                      {isCert ? (
                        <>
                          <button className="btn btn-primary btn-sm"
                            onClick={e2 => { e2.stopPropagation(); setProgressViewModal({ courseId: c.id, courseTitle: c.title }) }}>
                            진도 확인
                          </button>
                          <button className="btn btn-ghost btn-sm"
                            style={{ fontSize: '.75rem', color: 'var(--t2)' }}
                            onClick={e2 => { e2.stopPropagation(); setAgreementModal({ courseId: c.id, courseTitle: c.title }) }}>
                            📄 약관 보기
                          </button>
                        </>
                      ) : isPaused ? (
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
                    <div className="my-card-meta">{c.instructor} · {c.lessons}강 · {calcTotalDuration(c.curriculum)}</div>
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

      {/* 진도 확인 모달 (자격증) — 읽기 전용 · 메모 숨김 */}
      {progressViewModal && (() => {
        const cp = certProgressMap[progressViewModal.courseId]
        const checked = cp?.checklist.filter(i => i.checked).length ?? 0
        const total = cp?.checklist.length ?? 0
        const pct = total > 0 ? Math.round((checked / total) * 100) : 0
        return (
          <div className="modal-overlay" onClick={e2 => { if (e2.target === e2.currentTarget) setProgressViewModal(null) }}>
            <div className="modal-box" style={{ maxWidth: '520px' }}>
              <button className="modal-close" onClick={() => setProgressViewModal(null)}>✕</button>
              <div className="modal-head" style={{ textAlign: 'left' }}>
                <h2 style={{ fontSize: '1.05rem' }}>진도 확인</h2>
                <p style={{ fontSize: '.82rem', color: 'var(--t3)', margin: '4px 0 0' }}>
                  {progressViewModal.courseTitle}
                </p>
              </div>
              <div className="modal-body">
                {!cp ? (
                  <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--t3)', fontSize: '.86rem' }}>
                    아직 진도 정보가 없습니다.<br />
                    담당 강사가 진도 체크를 시작하면 여기에서 확인할 수 있습니다.
                  </div>
                ) : (
                  <>
                    <div style={{ padding: '12px 14px', borderRadius: 'var(--r2)', background: 'rgba(124,111,205,.06)', border: '1px solid rgba(124,111,205,.18)', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--t2)' }}>진행률</span>
                        <span style={{ fontWeight: 700 }}>{checked}/{total}회차 ({pct}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,.06)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? 'var(--ok)' : 'var(--purple)', borderRadius: '99px' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {cp.checklist.map((item, i) => (
                        <div key={item.id} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 12px',
                          background: item.checked ? 'rgba(52,196,124,.06)' : 'rgba(255,255,255,.02)',
                          border: `1px solid ${item.checked ? 'rgba(52,196,124,.2)' : 'var(--line)'}`,
                          borderRadius: 'var(--r2)',
                        }}>
                          <div style={{
                            flexShrink: 0, width: '22px', height: '22px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: '50%',
                            background: item.checked ? 'var(--ok)' : 'rgba(255,255,255,.06)',
                            color: item.checked ? '#fff' : 'var(--t3)',
                            fontSize: '.72rem', fontWeight: 700,
                          }}>
                            {item.checked ? '✓' : i + 1}
                          </div>
                          <span style={{
                            flex: 1, fontSize: '.88rem',
                            color: item.checked ? 'var(--t3)' : 'var(--t1)',
                            textDecoration: item.checked ? 'line-through' : 'none',
                          }}>
                            {item.title}
                          </span>
                          {item.checked && item.checkedAt && (
                            <span style={{ flexShrink: 0, fontSize: '.7rem', color: 'var(--t3)' }}>
                              {new Date(item.checkedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: '14px', fontSize: '.72rem', color: 'var(--t3)', textAlign: 'center' }}>
                      진도 체크는 담당 강사가 관리하며, 본 화면에서는 확인만 가능합니다.
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* 약관 보기 모달 (자격증) */}
      {agreementModal && (
        <div className="modal-overlay" onClick={e2 => { if (e2.target === e2.currentTarget) setAgreementModal(null) }}>
          <div className="modal-box" style={{ maxWidth: '640px' }}>
            <button className="modal-close" onClick={() => setAgreementModal(null)}>✕</button>
            <div className="modal-head" style={{ textAlign: 'left' }}>
              <h2 style={{ fontSize: '1.05rem' }}>수강 동의서</h2>
              <p style={{ fontSize: '.82rem', color: 'var(--t3)', margin: '4px 0 0' }}>
                {agreementModal.courseTitle}
              </p>
            </div>
            <div className="modal-body">
              {agreementLoading ? (
                <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--t3)' }}>
                  불러오는 중…
                </div>
              ) : !agreementRecord ? (
                <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--t3)', fontSize: '.86rem' }}>
                  서명 기록이 없습니다.<br />
                  운영자에게 문의해주세요.
                </div>
              ) : (
                <>
                  {/* 서명자 정보 */}
                  <div style={{ padding: '12px 14px', borderRadius: 'var(--r2)', background: 'rgba(61,189,132,.06)', border: '1px solid rgba(61,189,132,.2)', marginBottom: '14px' }}>
                    <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--ok)', marginBottom: '8px' }}>
                      본인 서명 정보
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '4px 10px', fontSize: '.78rem' }}>
                      <div style={{ color: 'var(--t3)' }}>성명</div>
                      <div style={{ color: 'var(--t1)', fontWeight: 600 }}>{agreementRecord.signerName}</div>
                      <div style={{ color: 'var(--t3)' }}>생년월일</div>
                      <div style={{ color: 'var(--t1)' }}>{agreementRecord.signerBirthdate}</div>
                      <div style={{ color: 'var(--t3)' }}>연락처</div>
                      <div style={{ color: 'var(--t1)' }}>{agreementRecord.signerPhone}</div>
                      <div style={{ color: 'var(--t3)' }}>서명 시각</div>
                      <div style={{ color: 'var(--t2)', fontSize: '.74rem' }}>
                        {new Date(agreementRecord.signedAt).toLocaleString('ko-KR')}
                      </div>
                      <div style={{ color: 'var(--t3)' }}>약관 버전</div>
                      <div style={{ color: 'var(--t2)', fontSize: '.74rem' }}>{agreementRecord.agreementVersion}</div>
                    </div>
                    <div style={{ marginTop: '10px', padding: '6px', background: '#fff', borderRadius: 'var(--r1)' }}>
                      <img src={agreementRecord.signatureUrl} alt="서명"
                        style={{ display: 'block', width: '100%', maxHeight: '140px', objectFit: 'contain' }} />
                    </div>
                  </div>

                  {/* 약관 본문 */}
                  <div style={{ fontSize: '.78rem', color: 'var(--t2)', lineHeight: 1.7 }}>
                    <div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: '.92rem', marginBottom: '8px' }}>
                      {CERTIFICATE_AGREEMENT.title}
                    </div>
                    <p style={{ marginBottom: '12px' }}>{CERTIFICATE_AGREEMENT.preamble}</p>
                    {CERTIFICATE_AGREEMENT.chapters.map((ch, ci) => (
                      <div key={ci} style={{ marginBottom: '14px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--t1)', margin: '10px 0 6px' }}>
                          {ch.title}
                        </div>
                        {ch.articles.map((art, ai) => (
                          <div key={ai} style={{ marginBottom: '10px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--t1)', marginBottom: '3px' }}>
                              {art.number} [{art.subject}]
                            </div>
                            {art.paragraphs.map((p, pi) => (
                              <p key={pi} style={{ whiteSpace: 'pre-wrap', margin: '2px 0' }}>{p}</p>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                    {CERTIFICATE_AGREEMENT.closing.map((c, i) => (
                      <p key={i} style={{ margin: '8px 0' }}>{c}</p>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
