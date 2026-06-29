import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCourses } from '../hooks/useCourses'
import { useInstructors } from '../hooks/useInstructors'
import { useToast } from '../components/ui/Toast'
import CourseCard from '../components/course/CourseCard'
import { calcTotalDuration } from '../utils/format'
import {
  getProgressPageByEnrollment,
  getCertificateAgreementByEnrollment,
  getMyInquiries,
  uploadSignatureImage,
  saveCertificateAgreement,
  type CertificateAgreementRecord,
} from '../utils/storage'
import CertificateAgreementForm, { type AgreementFormValue } from '../components/course/CertificateAgreementForm'
import { CERTIFICATE_AGREEMENT } from '../data/certificateAgreement'
import type { InstructorProgressPage, Inquiry, Enrollment } from '../data/types'
import { refundRecords, buildRefundedKeys, refundedKey } from '../lib/refundStatus'
import { useSiteSettings } from '../hooks/useSiteSettings'
import { renderCertificate, downloadCertificatePdf, type RenderedCertificate } from '../utils/certificate'

// 자격증 강사별 진도 맵 캐시 키 — courseId+instructorId 조합
const certKey = (courseId: string, instructorId?: string | null) =>
  `${courseId}:${instructorId || ''}`

export default function ClassroomPage() {
  const { user, loading: authLoading, getEnrollment, pauseCourse, resumeCourse } = useAuth()
  const { getPublicCourses, getCourse, hasReviewed, addReview } = useCourses()
  const { getInstructor } = useInstructors()
  const navigate = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState<'active' | 'completed' | 'expired'>('active')

  const [reviewModal, setReviewModal] = useState<{ courseId: string; courseTitle: string } | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  // 자격증 과정 — 강사 진도 페이지 캐시 (체크리스트 + 진행률)
  const [certProgressMap, setCertProgressMap] = useState<Record<string, InstructorProgressPage | null>>({})
  // 진도 확인 모달 — 강사 id까지 함께 보관하여 강사별 진도 매핑
  const [progressViewModal, setProgressViewModal] = useState<{ courseId: string; courseTitle: string; instructorId?: string } | null>(null)
  // 약관 보기 모달
  const [agreementModal, setAgreementModal] = useState<{ courseId: string; courseTitle: string; instructorId?: string } | null>(null)
  const [agreementRecord, setAgreementRecord] = useState<CertificateAgreementRecord | null>(null)
  const [agreementLoading, setAgreementLoading] = useState(false)

  // 자격증 수강 동의서 서명 여부 맵 (certKey → 서명 완료) + 서명 작성 모달
  const [certAgreedMap, setCertAgreedMap] = useState<Record<string, boolean>>({})
  const [signModal, setSignModal] = useState<{ courseId: string; courseTitle: string; instructorId?: string } | null>(null)
  const [signValue, setSignValue] = useState<AgreementFormValue>({ name: '', birthdate: '', phone: '', phoneVerified: false, signatureDataUrl: null })
  const [signSubmitting, setSignSubmitting] = useState(false)

  async function submitSignature() {
    if (!signModal || !user) return
    const v = signValue
    if (!v.name.trim() || !v.birthdate || !v.phone.trim() || !v.phoneVerified || !v.signatureDataUrl) {
      toast('이름·생년월일·연락처 인증·서명을 모두 완료해주세요.', 'err'); return
    }
    setSignSubmitting(true)
    try {
      const signatureUrl = await uploadSignatureImage(user.uid, signModal.courseId, v.signatureDataUrl)
      if (!signatureUrl) { toast('서명 이미지 저장에 실패했습니다.', 'err'); return }
      const ok = await saveCertificateAgreement({
        userId: user.uid,
        courseId: signModal.courseId,
        signerName: v.name.trim(),
        signerBirthdate: v.birthdate,
        signerPhone: v.phone.trim(),
        signatureUrl,
        agreementVersion: CERTIFICATE_AGREEMENT.version,
        agreementSnapshot: CERTIFICATE_AGREEMENT,
        assignedInstructorId: signModal.instructorId || null,
      })
      if (!ok) { toast('수강 동의서 저장에 실패했습니다.', 'err'); return }
      setCertAgreedMap(m => ({ ...m, [certKey(signModal.courseId, signModal.instructorId)]: true }))
      toast('수강 동의서가 등록되었습니다. 이제 수강을 진행할 수 있어요.', 'ok')
      setSignModal(null)
      setSignValue({ name: '', birthdate: '', phone: '', phoneVerified: false, signatureDataUrl: null })
    } finally {
      setSignSubmitting(false)
    }
  }
  // 환불 처리된 강의 숨김용 — 본인 환불 문의 조회
  const [inquiries, setInquiries] = useState<Inquiry[]>([])

  // 수료증 발급 (인터넷강의 수료 시)
  const { get: getSiteSettings } = useSiteSettings()
  const [certModal, setCertModal] = useState<{ courseTitle: string; cert: RenderedCertificate } | null>(null)
  const [certLoading, setCertLoading] = useState(false)

  async function issueCertificate(courseTitle: string) {
    if (!user) return
    // 관리자가 업로드한 템플릿 우선, 없으면 기본 번들 템플릿(public/)
    const templateUrl = getSiteSettings().certificateTemplate || '/certificate-template.png'
    setCertLoading(true)
    try {
      const today = new Date()
      const date = `${today.getFullYear()}. ${String(today.getMonth() + 1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}.`
      const cert = await renderCertificate({ templateUrl, name: user.name, courseName: courseTitle, date })
      setCertModal({ courseTitle, cert })
    } catch (err) {
      toast(err instanceof Error ? err.message : '수료증 생성에 실패했습니다.', 'err')
    } finally {
      setCertLoading(false)
    }
  }

  // 로그아웃(또는 비로그인) 시 홈으로 리디렉트 — 보호 페이지 공통 동작
  useEffect(() => {
    if (authLoading) return
    if (!user) navigate('/', { replace: true })
  }, [user, authLoading, navigate])

  // 자격증 enrollment별(강사별) 진도 페이지를 일괄 조회
  useEffect(() => {
    if (!user) return
    const certEnrollments = (user.enrollments || [])
      .filter(e => getCourse(e.courseId)?.level === '자격증')
    if (certEnrollments.length === 0) { setCertProgressMap({}); setCertAgreedMap({}); return }
    Promise.all(certEnrollments.map(async e => {
      const [page, agreement] = await Promise.all([
        getProgressPageByEnrollment(user.uid, e.courseId, e.assignedInstructorId),
        getCertificateAgreementByEnrollment(user.uid, e.courseId, e.assignedInstructorId),
      ])
      return [certKey(e.courseId, e.assignedInstructorId), page, !!agreement] as const
    })).then(results => {
      const map: Record<string, InstructorProgressPage | null> = {}
      const amap: Record<string, boolean> = {}
      results.forEach(([key, p, signed]) => { map[key] = p; amap[key] = signed })
      setCertProgressMap(map)
      setCertAgreedMap(amap)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, (user?.enrollments || []).length])

  // 본인 환불 문의 조회 — 환불 처리된 결제건은 강의실에서 숨김.
  // 로드 완료 전까지는 목록을 렌더하지 않아 환불 강의가 깜빡이는 현상 방지.
  const [inquiriesLoaded, setInquiriesLoaded] = useState(false)
  useEffect(() => {
    if (!user) { setInquiries([]); setInquiriesLoaded(false); return }
    setInquiriesLoaded(false)
    getMyInquiries(user.uid).then(setInquiries).finally(() => setInquiriesLoaded(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  // 약관 모달 열릴 때 서명 정보 로드 (강사별 독립)
  useEffect(() => {
    if (!agreementModal || !user) { setAgreementRecord(null); return }
    setAgreementLoading(true)
    getCertificateAgreementByEnrollment(user.uid, agreementModal.courseId, agreementModal.instructorId).then(rec => {
      setAgreementRecord(rec)
      setAgreementLoading(false)
    })
  }, [agreementModal, user])

  async function submitReview(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !reviewModal) return
    setReviewSubmitting(true)
    const already = hasReviewed(reviewModal.courseId, user.uid)
    const result = await addReview(reviewModal.courseId, user.uid, user.name, user.avatar, reviewRating, reviewText, 'user')
    setReviewSubmitting(false)
    if (result) {
      toast('리뷰가 등록되었습니다! 감사합니다 ✦', 'ok')
      setReviewModal(null)
      setReviewRating(5)
      setReviewText('')
    } else if (already) {
      toast('이미 리뷰를 작성했습니다.', 'info')
      setReviewModal(null)
    } else {
      // 중복이 아닌데 실패 — 저장 오류 (네트워크/권한 등)
      toast('리뷰 등록에 실패했습니다. 잠시 후 다시 시도해주세요.', 'err')
    }
  }

  if (authLoading) {
    return (
      <div className="loading" style={{ paddingTop: '140px' }}>
        <div className="spinner" />
      </div>
    )
  }

  // 리디렉트 대기 — useEffect가 navigate('/') 실행하는 짧은 순간 빈 화면으로 대기
  if (!user) return null

  // 환불 내역 로드 전엔 목록을 그리지 않음 — 환불 강의가 잠깐 보였다 사라지는 깜빡임 방지
  if (!inquiriesLoaded) {
    return (
      <div className="loading" style={{ paddingTop: '140px' }}>
        <div className="spinner" />
      </div>
    )
  }

  // 환불 처리된 결제건은 강의실 목록에서 제외
  const refunds = refundRecords(inquiries)
  // 환불된 결제건 + 환불된 자격증에 묶인 무료 강의를 함께 제외
  const refundedKeys = buildRefundedKeys(user.enrollments || [], refunds)
  const enrollments = (user.enrollments || [])
    .filter(e => !refundedKeys.has(refundedKey(e.courseId, e.enrolledAt)))
    // 등록일(결제일) 최신순으로 정렬 — 목록이 뒤죽박죽 보이지 않도록
    .sort((a, b) => new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime())

  // 수강 완료 판정 — 자격증은 모든 회차 체크, 일반은 진도 100%
  const isEnrollmentComplete = (e: Enrollment): boolean => {
    const c = getCourse(e.courseId)
    if (!c) return false
    if (c.level === '자격증') {
      const cp = certProgressMap[certKey(e.courseId, e.assignedInstructorId)]
      const total = cp?.checklist.length ?? 0
      const checked = cp?.checklist.filter(i => i.checked).length ?? 0
      return total > 0 && checked === total
    }
    return (e.progress || 0) >= 100
  }

  const activeAll = enrollments.filter(e => e.paused || new Date(e.expiryDate) > new Date())
  const expired = enrollments.filter(e => !e.paused && new Date(e.expiryDate) <= new Date())
  // 수강 중(미완료) / 수강 완료 분리 — 휴강 중은 항상 '수강 중'으로 취급
  const inProgress = activeAll.filter(e => e.paused || !isEnrollmentComplete(e))
  const completed = activeAll.filter(e => !e.paused && isEnrollmentComplete(e))
  const all = getPublicCourses()
  const notEnrolled = all.filter(c => !enrollments.some(e => e.courseId === c.id)).slice(0, 2)

  // 자격증 수강 동의서 미서명 시, 그 자격증에 묶어 등록된 무료 인터넷강의를 잠금(대기중)
  const gatedBundledIds = new Set<string>()
  for (const ce of enrollments) {
    if (getCourse(ce.courseId)?.level !== '자격증') continue
    if (certAgreedMap[certKey(ce.courseId, ce.assignedInstructorId)] !== true) {
      for (const b of (ce.bundled || [])) gatedBundledIds.add(b.courseId)
    }
  }

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
          <p>오늘도 강의 이어서 들어보세요.</p>
        </div>
      </section>

      <div className="container" style={{ paddingBottom: '100px' }}>
        {/* 탭 */}
        <div className="tabs" style={{ marginTop: '28px', marginBottom: '24px' }}>
          <button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
            수강 중 ({inProgress.length})
          </button>
          {completed.length > 0 && (
            <button className={`tab ${tab === 'completed' ? 'active' : ''}`} onClick={() => setTab('completed')}>
              수강 완료 ({completed.length})
            </button>
          )}
          {expired.length > 0 && (
            <button className={`tab ${tab === 'expired' ? 'active' : ''}`} onClick={() => setTab('expired')}>
              수강 종료 ({expired.length})
            </button>
          )}
        </div>

        {/* 수강 중 / 수강 완료 — 같은 카드 레이아웃, 탭에 따라 목록만 다름 */}
        {(tab === 'active' || tab === 'completed') && (() => {
          const list = tab === 'completed' ? completed : inProgress
          return (
          <div className="my-list">
            {list.length > 0 ? list.map(e => {
              const c = getCourse(e.courseId)
              if (!c) return null
              const isCert = c.level === '자격증'
              // 자격증 동의서 미서명으로 잠긴 묶음 인터넷강의 (시청 불가, 대기중)
              const gated = !isCert && gatedBundledIds.has(c.id)
              const isPaused = !!e.paused
              const daysLeft = isPaused
                ? (e.remainingDays || 0)
                : Math.ceil((new Date(e.expiryDate).getTime() - Date.now()) / 86400000)
              const maxPauses = c.pauseConfig?.maxPauses || 0
              const usedPauses = e.pauseCount || 0
              const canPause = !isCert && maxPauses > 0 && usedPauses < maxPauses && !isPaused

              // 자격증: 강사 체크 진도 기반 (강사별 독립), 일반: enrollment.progress
              const certPage = isCert ? certProgressMap[certKey(c.id, e.assignedInstructorId)] : null
              const certChecked = certPage?.checklist.filter(i => i.checked).length ?? 0
              const certTotal = certPage?.checklist.length ?? 0
              const prog = isCert
                ? (certTotal > 0 ? Math.round((certChecked / certTotal) * 100) : 0)
                : (e.progress || 0)
              // 수강 완료 여부: 자격증은 모든 회차 체크, 일반은 progress 100%
              const isComplete = isCert
                ? (certTotal > 0 && certChecked === certTotal)
                : prog >= 100
              // 자격증 강사 이름 — 메타에 표시 (시각적 구분)
              const certInstructor = isCert && e.assignedInstructorId
                ? getInstructor(e.assignedInstructorId)
                : null
              const cardKey = `${e.courseId}:${e.assignedInstructorId || 'none'}`

              return (
                <div key={cardKey} className={`my-card${isPaused ? ' paused' : ''}`}
                  style={{ cursor: isCert ? 'default' : undefined }}
                  onClick={() => {
                    if (isPaused || isCert) return
                    if (gated) { toast('먼저 자격증 과정 수강 동의서를 작성해주세요.', 'err'); return }
                    navigate(`/lesson?course=${c.id}`)
                  }}>
                  <div className="my-card-thumb">{c.emoji}</div>
                  <div className="my-card-body">
                    {/* 타이틀 + 상태 뱃지 */}
                    <div className="my-card-top">
                      <div className="my-card-title">{c.title}</div>
                      {isPaused
                        ? <span className="my-card-status-warn">⏸ 휴강중</span>
                        : ((isCert && certAgreedMap[certKey(c.id, e.assignedInstructorId)] !== true) || gated)
                        ? <span className="my-card-status-warn">● 대기중</span>
                        : isComplete
                        ? <span className="my-card-status-done">✓ 수강 완료</span>
                        : <span className="my-card-status-ok">● 수강중</span>}
                    </div>
                    {/* 메타 — 자격증은 담당 강사명 + 회차 표시 (중복 결제 시각적 구분) */}
                    <div className="my-card-meta">
                      {isCert
                        ? `${certInstructor?.name ? `${certInstructor.name} · ` : ''}${certTotal || c.curriculum.reduce((s, sec) => s + sec.items.length, 0)}회차 과정`
                        : `${c.instructor} · ${c.lessons}강 · ${calcTotalDuration(c.curriculum)}`}
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
                    {/* 자격증 — 수강 동의서 미작성 시 안내 (무통장 수동등록 등) */}
                    {isCert && certAgreedMap[certKey(c.id, e.assignedInstructorId)] !== true && (
                      <div style={{ fontSize: '.78rem', color: 'var(--warn)', background: 'rgba(232,156,56,.1)', border: '1px solid rgba(232,156,56,.25)', borderRadius: 'var(--r2)', padding: '8px 11px', marginBottom: '10px', lineHeight: 1.5 }}>
                        ⚠ 수강을 시작하려면 <b>수강 동의서 작성(서명)</b>이 필요합니다.
                      </div>
                    )}
                    {/* 액션 버튼 */}
                    <div className="my-card-actions">
                      {isCert ? (
                        certAgreedMap[certKey(c.id, e.assignedInstructorId)] !== true ? (
                          <button className="btn btn-primary btn-sm"
                            onClick={e2 => { e2.stopPropagation(); setSignValue({ name: '', birthdate: '', phone: '', phoneVerified: false, signatureDataUrl: null }); setSignModal({ courseId: c.id, courseTitle: c.title, instructorId: e.assignedInstructorId }) }}>
                            📝 수강 동의서 작성
                          </button>
                        ) : (
                        <>
                          <button className="btn btn-primary btn-sm"
                            onClick={e2 => { e2.stopPropagation(); setProgressViewModal({ courseId: c.id, courseTitle: c.title, instructorId: e.assignedInstructorId }) }}>
                            진도 확인
                          </button>
                          <button className="btn btn-ghost btn-sm"
                            style={{ fontSize: '.75rem', color: 'var(--t2)' }}
                            onClick={e2 => { e2.stopPropagation(); setAgreementModal({ courseId: c.id, courseTitle: c.title, instructorId: e.assignedInstructorId }) }}>
                            📄 약관 보기
                          </button>
                        </>
                        )
                      ) : isPaused ? (
                        <button className="btn btn-primary btn-sm"
                          onClick={e2 => { e2.stopPropagation(); doResume(c.id) }}>
                          강의 재개하기 →
                        </button>
                      ) : gated ? (
                        <button className="btn btn-primary btn-sm" style={{ opacity: .5, cursor: 'not-allowed' }}
                          onClick={e2 => { e2.stopPropagation(); toast('먼저 자격증 과정 수강 동의서를 작성해주세요.', 'err') }}>
                          계속 수강하기 →
                        </button>
                      ) : (
                        <button className="btn btn-primary btn-sm"
                          onClick={e2 => { e2.stopPropagation(); navigate(`/lesson?course=${c.id}`) }}>
                          계속 수강하기 →
                        </button>
                      )}
                      {/* 인터넷강의 수료 시 — 수료증 발급 */}
                      {!isCert && isComplete && (
                        <button className="btn btn-ghost btn-sm"
                          style={{ fontSize: '.75rem', color: 'var(--purple-2)' }}
                          disabled={certLoading}
                          onClick={e2 => { e2.stopPropagation(); issueCertificate(c.title) }}>
                          🎓 수료증 발급
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
            }) : tab === 'completed' ? (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '14px' }}>🎓</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px' }}>수강 완료한 강의가 없습니다</div>
                <div style={{ fontSize: '.875rem', color: 'var(--t2)' }}>강의를 끝까지 수강하면 여기에 모입니다.</div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '14px' }}>📚</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px' }}>수강 중인 강의가 없습니다</div>
                <div style={{ fontSize: '.875rem', color: 'var(--t2)', marginBottom: '20px' }}>첫 강의를 시작해보세요</div>
                <Link to="/courses" className="btn btn-primary">강의 둘러보기</Link>
              </div>
            )}
          </div>
          )
        })()}

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
                      {/* 수료한 인터넷강의는 만료 후에도 수료증 발급 가능 */}
                      {c.level !== '자격증' && (e.progress || 0) >= 100 && (
                        <button className="btn btn-ghost btn-sm"
                          style={{ fontSize: '.75rem', color: 'var(--purple-2)' }}
                          disabled={certLoading}
                          onClick={e2 => { e2.stopPropagation(); issueCertificate(c.title) }}>
                          🎓 수료증 발급
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 추천 강의 */}
        {activeAll.length > 0 && notEnrolled.length > 0 && (
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
        const cp = certProgressMap[certKey(progressViewModal.courseId, progressViewModal.instructorId)]
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

      {/* 수강 동의서 작성 모달 (자격증 — 무통장 수동등록 등 미서명자) */}
      {signModal && (
        <div className="modal-overlay" onClick={e2 => { if (e2.target === e2.currentTarget && !signSubmitting) setSignModal(null) }}>
          <div className="modal-box" style={{ maxWidth: '640px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <button className="modal-close" onClick={() => !signSubmitting && setSignModal(null)}>✕</button>
            <div style={{ padding: '22px 24px 12px' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-.02em' }}>수강 동의서 작성</h2>
              <p style={{ fontSize: '.85rem', color: 'var(--t2)', marginTop: '4px' }}>{signModal.courseTitle}</p>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', padding: '0 24px 8px' }}>
              <CertificateAgreementForm value={signValue} onChange={setSignValue} />
            </div>
            <div style={{ padding: '14px 24px 20px', borderTop: '1px solid var(--line)', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => !signSubmitting && setSignModal(null)} disabled={signSubmitting}>취소</button>
              <button className="btn btn-primary btn-sm" onClick={submitSignature} disabled={signSubmitting}>
                {signSubmitting ? '저장 중…' : '동의서 제출'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수료증 미리보기 + 다운로드 */}
      {certModal && (
        <div className="modal-overlay" onClick={e2 => { if (e2.target === e2.currentTarget) setCertModal(null) }}>
          <div className="modal-box" style={{ maxWidth: '560px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <button className="modal-close" onClick={() => setCertModal(null)}>✕</button>
            <div style={{ padding: '22px 24px 14px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-.03em' }}>수료증</h3>
              <p style={{ fontSize: '.82rem', color: 'var(--t2)', marginTop: '4px' }}>{certModal.courseTitle}</p>
            </div>
            <div className="modal-body" style={{ padding: '0 24px', overflow: 'auto' }}>
              <img src={certModal.cert.dataUrl} alt="수료증 미리보기"
                style={{ width: '100%', borderRadius: 'var(--r2)', border: '1px solid var(--line)', boxShadow: '0 6px 24px rgba(0,0,0,.18)' }} />
            </div>
            <div style={{ padding: '16px 24px 22px', display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary w-full"
                onClick={() => downloadCertificatePdf(certModal.cert, `수료증_${certModal.courseTitle}.pdf`)}>
                PDF 다운로드
              </button>
              <button className="btn btn-ghost" onClick={() => setCertModal(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
