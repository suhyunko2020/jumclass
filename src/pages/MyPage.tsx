import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCourses } from '../hooks/useCourses'
import { useInstructors } from '../hooks/useInstructors'
import { useToast } from '../components/ui/Toast'
import { formatPrice, calcRefund, consumedFraction } from '../utils/format'
import {
  getMyInquiries, addInquiry, editInquiry as editInquiryStorage, addInquiryReply,
  editInquiryReply, deleteInquiryReply,
  getProgressPageByEnrollment,
} from '../utils/storage'
import type { Inquiry, InquiryMessage, InstructorProgressPage } from '../data/types'
import { refundRecords, isEnrollmentRefunded } from '../lib/refundStatus'
import { sendInquiryReceived } from '../utils/alimtalk'
import { notifyAdmin } from '../utils/notifyAdmin'

const certKey = (courseId: string, instructorId?: string | null) =>
  `${courseId}:${instructorId || ''}`

type MyTab = 'payments' | 'inquiries'

interface InquiryForm {
  id: string
  type: string
  subject: string
  message: string
  metadata?: Inquiry['metadata']
}

const emptyForm: InquiryForm = { id: '', type: 'general', subject: '', message: '' }

export default function MyPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, logout, loading: authLoading } = useAuth()
  const { getCourse } = useCourses()
  const { getInstructor } = useInstructors()
  const toast = useToast()

  const [tab, setTab] = useState<MyTab>((searchParams.get('tab') as MyTab) || 'payments')
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({})
  const [replyingId, setReplyingId] = useState<string | null>(null)
  const [editKey, setEditKey] = useState<string | null>(null)   // `${inquiryId}:${at}` 편집 중인 댓글
  const [editText, setEditText] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('문의 작성')
  const [form, setForm] = useState<InquiryForm>(emptyForm)
  const [openBodies, setOpenBodies] = useState<Record<string, boolean>>({})
  // 자격증 강의 강사 진도 맵 — 수강 완료 뱃지 판단용
  const [certProgressMap, setCertProgressMap] = useState<Record<string, InstructorProgressPage | null>>({})

  useEffect(() => {
    document.title = '마이페이지 — JUMCLASS'
  }, [])

  useEffect(() => {
    const urlTab = searchParams.get('tab') as MyTab
    if (urlTab === 'payments' || urlTab === 'inquiries') setTab(urlTab)
  }, [searchParams])

  useEffect(() => {
    if (user) loadInquiries()
  }, [user])

  // 로그아웃 시 홈으로 리디렉트
  useEffect(() => {
    if (authLoading) return
    if (!user) navigate('/', { replace: true })
  }, [user, authLoading, navigate])

  // 자격증 enrollment별(강사별) 진도 일괄 조회 — 수강 완료 판단용
  useEffect(() => {
    if (!user) { setCertProgressMap({}); return }
    const certEnrollments = (user.enrollments || [])
      .filter(e => getCourse(e.courseId)?.level === '자격증')
    if (certEnrollments.length === 0) { setCertProgressMap({}); return }
    Promise.all(certEnrollments.map(async e => {
      const p = await getProgressPageByEnrollment(user.uid, e.courseId, e.assignedInstructorId)
      return [certKey(e.courseId, e.assignedInstructorId), p] as const
    })).then(results => {
      const map: Record<string, InstructorProgressPage | null> = {}
      results.forEach(([key, p]) => { map[key] = p })
      setCertProgressMap(map)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, (user?.enrollments || []).length])

  // 환불 내역 로드 완료 여부 — 로드 전엔 결제/환불 목록을 그리지 않아 깜빡임 방지
  const [inquiriesLoaded, setInquiriesLoaded] = useState(false)
  async function loadInquiries() {
    if (!user) return
    try {
      const data = await getMyInquiries(user.uid)
      setInquiries(data)
    } finally {
      setInquiriesLoaded(true)
    }
  }

  // 환불 요청 모달 상태 — early return(authLoading/!user)보다 위에 둬야 Hook 순서 안정 (rules-of-hooks)
  const [refundModal, setRefundModal] = useState<{
    courseId: string; courseTitle: string; orderDate: string;
    refundable: boolean; refundAmount: number; penalty: number; reason: string;
    price: number; badge: string;
    completedCount: number; totalLessons: number; progress: number;
    daysSinceEnroll: number; totalDays: number;
    isCert: boolean;
    includedDeduction: number; includedLines: { title: string; amount: number }[];
  } | null>(null)
  const [refundReason, setRefundReason] = useState('')
  const [refundConfirmed, setRefundConfirmed] = useState(false)
  // 결제/환불 내역 서브탭
  const [paymentSubTab, setPaymentSubTab] = useState<'active' | 'refunded'>('active')

  if (authLoading) {
    return (
      <div className="loading" style={{ paddingTop: '140px' }}>
        <div className="spinner" />
      </div>
    )
  }

  // 리디렉트 대기 — useEffect가 navigate('/') 실행하는 짧은 순간 빈 화면
  if (!user) return null

  // 환불 내역 로드 전엔 결제 목록을 그리지 않음 — 환불 강의 깜빡임 방지
  if (!inquiriesLoaded) {
    return (
      <div className="loading" style={{ paddingTop: '140px' }}>
        <div className="spinner" />
      </div>
    )
  }

  const enrollments = [...(user.enrollments || [])].sort(
    (a, b) => new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime()
  )
  // 결제내역(수강중) — 환불 처리된 결제건은 제외 (환불 후 재결제분은 enrolled_at이 갱신돼 다시 노출됨)
  const refunds = refundRecords(inquiries)
  const activeEnrollments = enrollments.filter(e => !isEnrollmentRefunded(e.courseId, e.enrolledAt, refunds))
  // 환불 중복 접수 방지 — 처리되지 않은(접수중) 환불 문의가 이미 있으면 재접수 불가
  const hasPendingRefund = (courseId: string, orderDate: string) =>
    inquiries.some(q => q.type === 'refund' && !q.refundedAt && q.metadata?.courseId === courseId && q.metadata?.orderDate === orderDate)
  // 환불내역 — 환불 문의(영구 보존) 기반. 재결제로 enrollment가 갱신/재사용돼도 환불 기록은 그대로 유지된다.
  const refundHistory = inquiries
    .filter(q => q.type === 'refund' && q.refundedAt && q.metadata?.courseId)
    .map(q => {
      const c = getCourse(q.metadata!.courseId!)
      const m = q.message?.match(/환불[^:]*금액:\s*([^\n]+)/)
      return { id: q.id, course: c, orderDate: q.metadata!.orderDate ?? '', refundedAt: q.refundedAt!, amount: m ? m[1].trim() : '' }
    })
    .sort((a, b) => new Date(b.refundedAt).getTime() - new Date(a.refundedAt).getTime())

  function openNewInquiry() {
    setForm(emptyForm)
    setModalTitle('새 문의 작성')
    setModalOpen(true)
  }

  async function openRefundRequest(courseId: string, orderDate: string, assignedInstructorId?: string) {
    // 중복 접수 차단 — 이미 접수중인 환불이 있으면 안내만 하고 종료
    if (hasPendingRefund(courseId, orderDate)) {
      toast('이미 환불 접수 중입니다. 처리 결과를 기다려 주세요.', 'info')
      return
    }
    const course = getCourse(courseId)
    if (!course) return
    const enrollment = assignedInstructorId
      ? user!.enrollments.find(e => e.courseId === courseId && e.assignedInstructorId === assignedInstructorId)
      : user!.enrollments.find(e => e.courseId === courseId)
    if (!enrollment) return
    const isCert = course.level === '자격증'
    // 자격증: 해당 강사의 진도 페이지 체크리스트 기반
    let certChecked = 0
    let certTotal = 0
    if (isCert) {
      const pp = await getProgressPageByEnrollment(user!.uid, courseId, assignedInstructorId)
      if (pp) {
        certChecked = pp.checklist.filter(i => i.checked).length
        certTotal = pp.checklist.length
      }
    }
    const totalLessons = isCert
      ? certTotal
      : course.curriculum.reduce((s, sec) => s + sec.items.length, 0)
    const completedCount = isCert ? certChecked : (enrollment.completedLessons?.length ?? 0)
    const progress = isCert
      ? (certTotal > 0 ? Math.round((certChecked / certTotal) * 100) : 0)
      : (enrollment.progress || 0)

    // 자격증 — 함께 무료 묶어 등록한 인터넷강의의 실제 시청분을 위약금 형태로 공제.
    // 대상: 그 수강건에 기록된 bundled(건별 자유선택). 없으면 강의의 includedCourseIds로 폴백.
    // 차감액 = (묶을 때 선택한 기간의 티어 가격) × 실제 시청 분량. (일반 강의 환불 공제와 동일 기준)
    let includedDeduction = 0
    const includedLines: { title: string; amount: number }[] = []
    if (isCert) {
      const bundled = (enrollment.bundled && enrollment.bundled.length)
        ? enrollment.bundled
        : (course.includedCourseIds || []).map(id => ({ courseId: id, days: 0 }))
      for (const b of bundled) {
        const incCourse = getCourse(b.courseId)
        const incEnr = (user!.enrollments || []).find(en => en.courseId === b.courseId)
        if (!incCourse || !incEnr) continue
        const incTotal = incCourse.curriculum.reduce((s, sec) => s + sec.items.length, 0)
        const frac = consumedFraction(incEnr, incTotal)
        if (frac <= 0) continue
        // 가격 기준 기간: 묶을 때 선택한 days, 없으면 실제 등록 기간
        const incDays = b.days || Math.round((new Date(incEnr.expiryDate).getTime() - new Date(incEnr.enrolledAt).getTime()) / 86400000)
        const tiers = incCourse.pricingTiers || []
        const tier = tiers.length
          ? tiers.slice().sort((a, b2) => Math.abs(a.days - incDays) - Math.abs(b2.days - incDays))[0]
          : null
        const tierPrice = tier?.price ?? incCourse.price
        const deduct = Math.round(tierPrice * frac)
        if (deduct > 0) { includedDeduction += deduct; includedLines.push({ title: incCourse.title, amount: deduct }) }
      }
    }

    const result = calcRefund(
      course,
      enrollment,
      totalLessons,
      isCert ? completedCount : undefined,
      includedDeduction,
    )
    // 자정 기준으로 일수 계산 — 어제 등록하면 시각과 무관하게 "1일 경과"
    const enrolledMidnight = new Date(enrollment.enrolledAt); enrolledMidnight.setHours(0, 0, 0, 0)
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0)
    const expiryMidnight = new Date(enrollment.expiryDate); expiryMidnight.setHours(0, 0, 0, 0)
    const daysSinceEnroll = Math.max(0, Math.round((todayMidnight.getTime() - enrolledMidnight.getTime()) / 86400000))
    const totalDays = Math.max(1, Math.round((expiryMidnight.getTime() - enrolledMidnight.getTime()) / 86400000))
    setRefundModal({
      courseId, courseTitle: course.title, orderDate,
      ...result, price: course.price, badge: course.badge,
      completedCount, totalLessons, progress,
      daysSinceEnroll, totalDays, isCert,
      includedDeduction, includedLines,
    })
    setRefundReason('')
    setRefundConfirmed(false)
  }

  async function submitRefund() {
    if (!refundModal || !refundReason.trim() || !refundConfirmed) return
    // 안전장치 — 모달을 띄운 사이 다른 경로로 접수됐을 수 있으니 한 번 더 확인
    if (hasPendingRefund(refundModal.courseId, refundModal.orderDate)) {
      toast('이미 환불 접수 중입니다. 처리 결과를 기다려 주세요.', 'info')
      setRefundModal(null)
      return
    }
    const unit = refundModal.isCert ? '회' : '강'
    const incLine = refundModal.includedDeduction > 0
      ? `\n기본 제공 강의 공제: -${formatPrice(refundModal.includedDeduction)}${refundModal.includedLines.length ? ` (${refundModal.includedLines.map(l => `${l.title} ${formatPrice(l.amount)}`).join(', ')})` : ''}`
      : ''
    const msg = `결제일: ${refundModal.orderDate}\n강의: ${refundModal.courseTitle}\n수강 진도: ${refundModal.completedCount}/${refundModal.totalLessons}${unit} (${refundModal.progress}%)${incLine}\n환불 예상 금액: ${formatPrice(refundModal.refundAmount)}\n\n환불 사유: ${refundReason}`
    await addInquiry(user!.uid, user!.name, user!.email, '결제 환불 요청합니다.', msg, 'refund', { courseId: refundModal.courseId, orderDate: refundModal.orderDate })
    sendInquiryReceived({ phone: user!.phone, userId: user!.uid, customerName: user!.name, title: '결제 환불 요청합니다.' }).catch(() => {})
    notifyAdmin({ kind: 'inquiry', customerName: user!.name, subject: '환불 요청', content: `${refundModal.courseTitle}\n환불 예상: ${formatPrice(refundModal.refundAmount)}` })
    toast('환불 요청이 접수되었습니다.', 'ok')
    setRefundModal(null)
    setTab('inquiries')
    await loadInquiries()
  }

  function openEditInquiry(q: Inquiry) {
    setForm({ id: q.id, type: q.type, subject: q.subject, message: q.message })
    setModalTitle('문의 수정')
    setModalOpen(true)
  }

  // 글 본문(message) 이후의 댓글 목록 — 첫 답변(answer) + 스레드
  function commentsOf(q: Inquiry): InquiryMessage[] {
    const msgs: InquiryMessage[] = q.answer ? [{ sender: 'admin', body: q.answer, at: q.answeredAt || q.date }] : []
    return msgs.concat(q.thread ?? [])
  }

  async function submitUserReply(q: Inquiry) {
    const body = (replyDraft[q.id] || '').trim()
    if (!body) return
    setReplyingId(q.id)
    const res = await addInquiryReply(q.id, 'user', body)
    setReplyingId(null)
    if (!res.ok) { toast(res.error || '전송에 실패했습니다.', 'err'); return }
    setReplyDraft(d => ({ ...d, [q.id]: '' }))
    // 관리자에게 새 답글 알림
    notifyAdmin({ kind: 'inquiry', customerName: user!.name, subject: `[답글] ${q.subject}`, content: body })
    toast('댓글이 등록되었습니다.', 'ok')
    await loadInquiries()
  }

  async function saveEditComment(inquiryId: string, at: string) {
    const res = await editInquiryReply(inquiryId, at, editText, 'user')
    if (!res.ok) { toast(res.error || '수정 실패', 'err'); return }
    setEditKey(null); setEditText('')
    toast('댓글을 수정했습니다.', 'ok')
    await loadInquiries()
  }

  async function removeComment(inquiryId: string, at: string) {
    if (!confirm('이 댓글을 삭제하시겠습니까?')) return
    const res = await deleteInquiryReply(inquiryId, at, 'user')
    if (!res.ok) { toast(res.error || '삭제 실패', 'err'); return }
    toast('댓글을 삭제했습니다.', 'ok')
    await loadInquiries()
  }

  async function submitInquiry(e: React.FormEvent) {
    e.preventDefault()
    if (form.id) {
      await editInquiryStorage(form.id, form.subject, form.message)
      toast('성공적으로 수정되었습니다.', 'ok')
    } else {
      await addInquiry(user!.uid, user!.name, user!.email, form.subject, form.message, form.type, form.metadata)
      sendInquiryReceived({ phone: user!.phone, userId: user!.uid, customerName: user!.name, title: form.subject }).catch(() => {})
      notifyAdmin({ kind: 'inquiry', customerName: user!.name, subject: form.subject, content: form.message })
      toast('문의가 등록되었습니다.', 'ok')
    }
    setModalOpen(false)
    await loadInquiries()
  }

  function toggleBody(id: string) {
    setOpenBodies(p => ({ ...p, [id]: !p[id] }))
  }

  const NAV_ITEMS: { id: MyTab; icon: string; label: string }[] = [
    { id: 'payments',  icon: '💳', label: '결제/환불 내역' },
    { id: 'inquiries', icon: '💬', label: '1:1 문의내역' },
  ]

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <h1 style={{ marginTop: 0 }}>마이페이지 ✦</h1>
          <p>내 활동 내역과 결제 정보를 확인하세요.</p>
        </div>
      </section>

      <div className="container" style={{ paddingTop: '40px', paddingBottom: '100px' }}>
        <div className="mypage-layout">

          {/* ── 사이드 메뉴 ── */}
          <aside className="mypage-side">
            {/* 프로필 */}
            <div className="mypage-profile">
              <div className="mypage-avatar">{user.avatar}</div>
              <div className="mypage-profile-name">{user.name}</div>
              <div className="mypage-profile-email">{user.email}</div>
            </div>

            {/* 메뉴 */}
            <nav className="mypage-nav">
              {NAV_ITEMS.map(t => (
                <button key={t.id}
                  className={`mypage-nav-item ${tab === t.id ? 'active' : ''}`}
                  onClick={() => setTab(t.id)}>
                  <span className="mypage-nav-icon">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="mypage-side-footer">
              <button className="btn btn-ghost w-full btn-sm"
                onClick={() => { logout(); navigate('/') }}>
                로그아웃
              </button>
            </div>
          </aside>

          {/* ── 메인 콘텐츠 ── */}
          <main className="mypage-content" key={tab}>

            {/* ════ 결제/환불 내역 ════ */}
            {tab === 'payments' && (
              <div>
                <div className="mypage-section-header">
                  <h2 className="mypage-section-title">결제/환불 내역</h2>
                </div>

                {/* 결제내역 | 환불내역 서브탭 — 언더라인 스타일 */}
                <div style={{ display: 'flex', gap: '26px', borderBottom: '1px solid var(--line)', marginBottom: '24px' }}>
                  {([['active', '결제내역', activeEnrollments.length], ['refunded', '환불내역', refundHistory.length]] as const).map(([key, label, count]) => {
                    const on = paymentSubTab === key
                    return (
                      <button key={key} type="button" onClick={() => setPaymentSubTab(key)}
                        style={{ padding: '0 2px 12px', background: 'none', border: 'none', borderBottom: `2px solid ${on ? 'var(--purple)' : 'transparent'}`, marginBottom: '-1px', cursor: 'pointer', color: on ? 'var(--t1)' : 'var(--t3)', fontSize: '.9rem', fontWeight: on ? 700 : 500, display: 'flex', alignItems: 'center', gap: '7px', transition: 'color .2s' }}>
                        {label}
                        <span style={{ fontSize: '.72rem', fontWeight: 700, padding: '1px 8px', borderRadius: 'var(--pill)', background: on ? 'rgba(124,111,205,.16)' : 'var(--glass-1)', color: on ? 'var(--purple-2)' : 'var(--t3)' }}>{count}</span>
                      </button>
                    )
                  })}
                </div>

                {paymentSubTab === 'refunded' ? (
                  // ─── 환불내역 — 환불 문의(영구 보존) 기반. 재결제와 무관하게 환불 기록 표시 ───
                  refundHistory.length === 0 ? (
                    <div className="mypage-empty">
                      <div className="mypage-empty-text">환불 내역이 없습니다.</div>
                    </div>
                  ) : (
                    <div className="payment-list">
                      {refundHistory.map(r => (
                        <div key={r.id} className="payment-item" style={{ opacity: .6, filter: 'grayscale(.4)' }}>
                          <div className="payment-item-thumb">{r.course?.emoji ?? '📘'}</div>
                          <div className="payment-item-body">
                            <div className="payment-item-top">
                              <div className="payment-item-title">{r.course?.title ?? '삭제된 강의'}</div>
                              <span style={{ fontSize: '.72rem', fontWeight: 700, padding: '3px 9px', borderRadius: 'var(--pill)', background: 'rgba(224,82,82,.12)', color: 'var(--fail)', flexShrink: 0 }}>환불 완료</span>
                            </div>
                            <div className="payment-item-meta">
                              결제일 {r.orderDate} &nbsp;·&nbsp; 환불 처리 {new Date(r.refundedAt).toLocaleDateString('ko-KR')}
                            </div>
                            {r.amount && (
                              <div className="payment-item-bottom">
                                <span className="payment-item-price">{r.amount}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : activeEnrollments.length === 0 ? (
                  <div className="mypage-empty">
                    <div className="mypage-empty-text">결제 내역이 없습니다.</div>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/courses')}>강의 둘러보기</button>
                  </div>
                ) : (
                  <div className="payment-list">
                    {activeEnrollments.map(e => {
                      const c = getCourse(e.courseId)
                      if (!c) return null
                      const date = new Date(e.enrolledAt).toLocaleDateString('ko-KR')
                      const expiry = new Date(e.expiryDate)
                      const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / 86400000)
                      const isExpired = !e.paused && expiry <= new Date()
                      const isUnlimited = daysLeft > 3000
                      // 수강 완료 판단 — 자격증은 모든 회차 체크 (강사별 독립), 일반은 progress 100%
                      const isCert = c.level === '자격증'
                      const certPage = isCert ? certProgressMap[certKey(e.courseId, e.assignedInstructorId)] : null
                      const certChecked = certPage?.checklist.filter(i => i.checked).length ?? 0
                      const certTotal = certPage?.checklist.length ?? 0
                      const isComplete = isCert
                        ? (certTotal > 0 && certChecked === certTotal)
                        : (e.progress || 0) >= 100
                      // 자격증 담당 강사명 (중복 결제 구분용)
                      const certInstructor = isCert && e.assignedInstructorId
                        ? getInstructor(e.assignedInstructorId)
                        : null
                      const itemKey = `${e.courseId}:${e.assignedInstructorId || 'none'}:${e.enrolledAt}`

                      return (
                        <div key={itemKey} className="payment-item">
                          <div className="payment-item-thumb">{c.emoji}</div>
                          <div className="payment-item-body">
                            <div className="payment-item-top">
                              <div className="payment-item-title">
                                {c.title}
                                {certInstructor && (
                                  <span style={{ marginLeft: '8px', fontSize: '.78rem', fontWeight: 500, color: 'var(--purple-2)' }}>
                                    · {certInstructor.name} 강사
                                  </span>
                                )}
                              </div>
                              {e.type === 'manual'
                                ? <span className="badge-manual">수동 등록</span>
                                : isExpired
                                ? <span className="badge-expired">만료</span>
                                : isComplete
                                ? <span className="badge-complete">수강 완료</span>
                                : <span className="badge-active">수강중</span>}
                            </div>
                            <div className="payment-item-meta">
                              결제일 {date} &nbsp;·&nbsp; {c.level} &nbsp;·&nbsp;
                              {isUnlimited ? ' 무제한 시청' : isExpired ? ' 만료됨' : ` 잔여 ${daysLeft}일`}
                            </div>
                            <div className="payment-item-bottom">
                              <span className="payment-item-price">{formatPrice(c.price)}</span>
                              {(e.type !== 'manual' || isCert) && !isExpired && (
                                hasPendingRefund(c.id, date) ? (
                                  <button className="btn btn-ghost btn-sm" disabled
                                    style={{ opacity: .55, cursor: 'default' }}>
                                    환불 접수 중
                                  </button>
                                ) : (
                                  <button className="btn btn-ghost btn-sm"
                                    onClick={() => openRefundRequest(c.id, date, e.assignedInstructorId)}>
                                    환불 요청
                                  </button>
                                )
                              )}
                              {isExpired && (
                                <button className="btn btn-ghost btn-sm"
                                  onClick={() => navigate(`/checkout?course=${c.id}`)}>
                                  재수강 신청
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ════ 1:1 문의 ════ */}
            {tab === 'inquiries' && (
              <div>
                <div className="mypage-section-header">
                  <h2 className="mypage-section-title">1:1 문의내역</h2>
                  <button className="btn btn-primary btn-sm" onClick={openNewInquiry}>
                    + 새 문의 작성
                  </button>
                </div>

                {inquiries.length === 0 ? (
                  <div className="mypage-empty">
                    <div className="mypage-empty-text">작성한 문의가 없습니다.</div>
                    <button className="btn btn-primary btn-sm" onClick={openNewInquiry}>문의하기</button>
                  </div>
                ) : (
                  <div className="inquiry-list">
                    {inquiries.map(q => {
                      const resolved = !!q.resolvedAt
                      const isAns = q.status === 'answered'
                      const statusLabel = resolved ? '완료' : isAns ? '답변 도착' : '답변 대기'
                      const d = new Date(q.date).toLocaleDateString('ko-KR')
                      const isOpen = openBodies[q.id]
                      const comments = commentsOf(q)
                      const canEdit = !isAns && (q.thread?.length ?? 0) === 0
                      // 턴 — 관리자가 마지막으로 답변한 뒤에만 사용자가 댓글 가능
                      const lastSender = (q.thread && q.thread.length) ? q.thread[q.thread.length - 1].sender : (q.answer ? 'admin' : 'user')
                      const userTurn = lastSender === 'admin'
                      return (
                        <div key={q.id} className={`inquiry-item ${isOpen ? 'open' : ''}`}>
                          {/* 헤더 */}
                          <div className="inquiry-header" onClick={() => toggleBody(q.id)}>
                            <div className="inquiry-header-left">
                              <span className={`inquiry-status ${resolved || isAns ? 'answered' : 'pending'}`}>
                                {statusLabel}
                              </span>
                              <span className="inquiry-subject">
                                {q.type === 'refund' && <span className="inquiry-refund-tag">환불</span>}
                                {q.subject}
                              </span>
                            </div>
                            <div className="inquiry-header-right">
                              <span className="inquiry-date">{d}</span>
                              <span className="inquiry-chevron">{isOpen ? '▲' : '▼'}</span>
                            </div>
                          </div>

                          {/* 본문 — 게시판 글 + 댓글 */}
                          {isOpen && (
                            <div className="inquiry-body">
                              <div className="qa-post">{q.message}</div>

                              {comments.length > 0 && (
                                <>
                                  <div className="qa-comments-title">댓글 {comments.length}</div>
                                  {comments.map((c, i) => {
                                    const k = `${q.id}:${c.at}`
                                    const editing = editKey === k
                                    const mine = c.sender === 'user'
                                    return (
                                    <div key={i} className="qa-comment">
                                      <div className={`qa-comment-ava ${c.sender}`}>{c.sender === 'admin' ? <img src="/favicon.png" alt="점클래스" /> : '나'}</div>
                                      <div className="qa-comment-main">
                                        <div className="qa-comment-meta">
                                          <span className="qa-comment-author">{c.sender === 'admin' ? '점클래스' : '나'}</span>
                                          {c.sender === 'admin' && <span className="qa-badge-admin">운영자</span>}
                                          <span className="qa-comment-time">{new Date(c.at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}{c.editedAt ? ' (수정됨)' : ''}</span>
                                          {mine && !resolved && !editing && (
                                            <span style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                                              <button className="qa-link" onClick={() => { setEditKey(k); setEditText(c.body) }}>수정</button>
                                              <button className="qa-link danger" onClick={() => removeComment(q.id, c.at)}>삭제</button>
                                            </span>
                                          )}
                                        </div>
                                        {editing ? (
                                          <div className="qa-write">
                                            <textarea className="form-input" rows={2} value={editText} onChange={e => setEditText(e.target.value)} style={{ resize: 'vertical' }} />
                                            <div className="qa-write-actions">
                                              <button className="btn btn-ghost btn-sm" onClick={() => { setEditKey(null); setEditText('') }}>취소</button>
                                              <button className="btn btn-primary btn-sm" disabled={!editText.trim()} onClick={() => saveEditComment(q.id, c.at)}>저장</button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="qa-comment-body">{c.body}</div>
                                        )}
                                      </div>
                                    </div>
                                  ) })}
                                </>
                              )}

                              {resolved ? (
                                <div className="qa-closed">✓ 완료 처리된 문의입니다.</div>
                              ) : userTurn ? (
                                <div className="qa-write">
                                  <textarea className="form-input" rows={2} placeholder="댓글을 입력하세요" value={replyDraft[q.id] || ''}
                                    onChange={e => setReplyDraft(d => ({ ...d, [q.id]: e.target.value }))} style={{ resize: 'vertical' }} />
                                  <div className="qa-write-actions">
                                    <button className="btn btn-primary btn-sm" disabled={replyingId === q.id || !(replyDraft[q.id] || '').trim()}
                                      onClick={() => submitUserReply(q)}>
                                      {replyingId === q.id ? '등록 중…' : '댓글 등록'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="qa-closed" style={{ background: 'transparent', textAlign: 'left' }}>
                                  {canEdit ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                      <span>관리자 답변을 기다리고 있어요.</span>
                                      <button className="btn btn-ghost btn-sm" onClick={() => openEditInquiry(q)}>문의 수정</button>
                                    </div>
                                  ) : '관리자 답변이 등록되면 이어서 댓글을 남길 수 있어요.'}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

          </main>
        </div>
      </div>

      {/* ── 문의 작성/수정 모달 ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div className="modal-box" style={{ position: 'relative' }}>
            <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            <div className="modal-head">
              <h2>{modalTitle}</h2>
            </div>
            <div className="modal-body">
              <form onSubmit={submitInquiry}>
                <div className="form-group mt-16">
                  <label className="form-label">제목</label>
                  <input className="form-input" type="text" placeholder="어떤 점이 궁금하신가요?" required
                    value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">내용</label>
                  <textarea className="form-input" rows={5} placeholder="상세 내용을 적어주세요." required
                    value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} />
                </div>
                <button type="submit" className="btn btn-primary w-full mt-16">등록하기</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── 환불 요청 모달 ── */}
      {refundModal && (() => {
        const fullyWatched = refundModal.progress >= 100
        return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setRefundModal(null) }}>
          <div className="modal-box" style={{ position: 'relative', maxWidth: '520px' }}>
            <button className="modal-close" onClick={() => setRefundModal(null)}>✕</button>
            <div className="modal-head">
              <h2>환불 요청</h2>
              <p style={{ fontSize: '.85rem', color: 'var(--t2)' }}>{refundModal.courseTitle}</p>
            </div>
            <div className="modal-body">
              {/* 수강 현황 */}
              <div style={{ padding: '14px 16px', borderRadius: 'var(--r2)', background: 'rgba(255,255,255,.03)', border: '1px solid var(--line)', marginBottom: '14px' }}>
                <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--t1)', marginBottom: '10px' }}>수강 현황</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ fontSize: '.8rem', color: 'var(--t3)' }}>수강 진도</div>
                  <div style={{ fontSize: '.8rem', fontWeight: 600, textAlign: 'right' }}>{refundModal.completedCount}/{refundModal.totalLessons}{refundModal.isCert ? '회' : '강'} ({refundModal.progress}%)</div>
                  <div style={{ fontSize: '.8rem', color: 'var(--t3)' }}>수강 경과일</div>
                  <div style={{ fontSize: '.8rem', fontWeight: 600, textAlign: 'right' }}>{refundModal.daysSinceEnroll}일 / 총 {refundModal.totalDays}일</div>
                  <div style={{ fontSize: '.8rem', color: 'var(--t3)' }}>결제 금액</div>
                  <div style={{ fontSize: '.8rem', fontWeight: 700, textAlign: 'right', color: 'var(--t1)' }}>{formatPrice(refundModal.price)}</div>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <div style={{ height: '4px', borderRadius: '99px', background: 'rgba(255,255,255,.1)', overflow: 'hidden' }}>
                    <div style={{ width: `${refundModal.progress}%`, height: '100%', background: refundModal.progress >= 100 ? 'var(--fail)' : 'var(--purple)', borderRadius: '99px' }} />
                  </div>
                </div>
              </div>

              {/* 환불 정책 */}
              <div style={{ padding: '14px 16px', borderRadius: 'var(--r2)', background: 'rgba(124,111,205,.06)', border: '1px solid rgba(124,111,205,.15)', marginBottom: '14px' }}>
                <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--purple-2)', marginBottom: '10px' }}>
                  {refundModal.badge === '자격증' ? '* 자격증 과정 환불 정책' : '* 인터넷 강의 환불 정책'}
                </div>
                {refundModal.badge === '자격증' ? (
                  <table style={{ width: '100%', fontSize: '.75rem', color: 'var(--t2)', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                      <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 600 }}>시점</th>
                      <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 600 }}>환불 기준</th>
                    </tr></thead>
                    <tbody>
                      <tr><td style={{ padding: '4px 0' }}>강습 시작 전</td><td style={{ textAlign: 'right', padding: '4px 0' }}>전액 (위약금 10% 별도)</td></tr>
                      <tr><td style={{ padding: '4px 0' }}>기간 1/3 경과 전</td><td style={{ textAlign: 'right', padding: '4px 0' }}>수강료 2/3 (위약금 10%)</td></tr>
                      <tr><td style={{ padding: '4px 0' }}>기간 1/2 경과 전</td><td style={{ textAlign: 'right', padding: '4px 0' }}>수강료 1/2 (위약금 10%)</td></tr>
                      <tr style={{ color: 'var(--fail)' }}><td style={{ padding: '4px 0' }}>기간 1/2 경과 후</td><td style={{ textAlign: 'right', padding: '4px 0' }}>환불 불가</td></tr>
                    </tbody>
                  </table>
                ) : (
                  <table style={{ width: '100%', fontSize: '.75rem', color: 'var(--t2)', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                      <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 600 }}>시점</th>
                      <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 600 }}>환불 기준</th>
                    </tr></thead>
                    <tbody>
                      <tr><td style={{ padding: '4px 0' }}>수강 시작 전</td><td style={{ textAlign: 'right', padding: '4px 0' }}>전액 (위약금 10% 별도)</td></tr>
                      <tr><td style={{ padding: '4px 0' }}>7일 이내 / 2강 이하</td><td style={{ textAlign: 'right', padding: '4px 0' }}>90% (위약금 10%)</td></tr>
                      <tr><td style={{ padding: '4px 0' }}>7일 이후 / 기간 1/2 이하</td><td style={{ textAlign: 'right', padding: '4px 0' }}>수강분 공제 후 환불</td></tr>
                      <tr style={{ color: 'var(--fail)' }}><td style={{ padding: '4px 0' }}>기간 1/2 초과</td><td style={{ textAlign: 'right', padding: '4px 0' }}>환불 불가</td></tr>
                    </tbody>
                  </table>
                )}
                <div style={{ marginTop: '8px', fontSize: '.75rem', color: 'var(--purple-2)', fontWeight: 600 }}>
                  현재 적용: {refundModal.reason}
                </div>
              </div>

              {/* 환불 금액 */}
              <div style={{ padding: '14px 16px', borderRadius: 'var(--r2)', background: fullyWatched ? 'rgba(224,82,82,.06)' : refundModal.refundable ? 'rgba(52,196,124,.06)' : 'rgba(224,82,82,.06)', border: `1px solid ${fullyWatched ? 'rgba(224,82,82,.15)' : refundModal.refundable ? 'rgba(52,196,124,.15)' : 'rgba(224,82,82,.15)'}`, marginBottom: '16px' }}>
                {fullyWatched ? (
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <div style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--fail)', marginBottom: '4px' }}>환불 불가</div>
                    <div style={{ fontSize: '.8rem', color: 'var(--t2)' }}>
                      {refundModal.isCert ? '모든 회차 수강을 완료하여 환불이 불가능합니다.' : '이미 수강을 완료하여 환불이 불가능합니다.'}
                    </div>
                  </div>
                ) : refundModal.refundable ? (() => {
                  const baseRefund = refundModal.refundAmount + refundModal.penalty + refundModal.includedDeduction
                  const policyRatio = refundModal.price > 0 ? Math.round((baseRefund / refundModal.price) * 100) : 0
                  const policyLabel = policyRatio === 100
                    ? '전액 기준'
                    : `정책 적용 (${policyRatio}%)`
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '.82rem' }}>
                        <span style={{ color: 'var(--t2)' }}>결제 금액</span>
                        <span style={{ fontWeight: 700 }}>{formatPrice(refundModal.price)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '.82rem' }}>
                        <span style={{ color: 'var(--t2)' }}>환불 기준 금액 <span style={{ fontSize: '.72rem', color: 'var(--t3)' }}>({policyLabel})</span></span>
                        <span style={{ fontWeight: 700 }}>{formatPrice(baseRefund)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '.82rem' }}>
                        <span style={{ color: 'var(--t2)' }}>위약금 <span style={{ fontSize: '.72rem', color: 'var(--t3)' }}>(계약대금 10% 별도)</span></span>
                        <span style={{ color: 'var(--fail)' }}>-{formatPrice(refundModal.penalty)}</span>
                      </div>
                      {refundModal.includedDeduction > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '.82rem' }}>
                          <span style={{ color: 'var(--t2)' }}>기본 제공 강의 공제 <span style={{ fontSize: '.72rem', color: 'var(--t3)' }}>(시청분, 위약금 형태)</span></span>
                          <span style={{ color: 'var(--fail)' }}>-{formatPrice(refundModal.includedDeduction)}</span>
                        </div>
                      )}
                      <div style={{ borderTop: '1px solid var(--line)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '.9rem' }}>
                        <span style={{ fontWeight: 700 }}>환불 예상 금액</span>
                        <span style={{ fontWeight: 800, color: 'var(--ok)' }}>{formatPrice(refundModal.refundAmount)}</span>
                      </div>
                    </>
                  )
                })() : (
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <div style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--fail)', marginBottom: '4px' }}>환불 불가</div>
                    <div style={{ fontSize: '.8rem', color: 'var(--t2)' }}>수강 기간의 1/2을 초과하여 환불이 불가능합니다.</div>
                  </div>
                )}
              </div>

              {!fullyWatched && refundModal.refundable ? (
                <>
                  <div className="form-group">
                    <label className="form-label">환불 사유</label>
                    <textarea className="form-input" rows={3} placeholder="환불 사유를 입력해주세요." required
                      value={refundReason} onChange={e => setRefundReason(e.target.value)} />
                  </div>
                  <label style={{
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    padding: '12px 14px', borderRadius: 'var(--r2)',
                    background: refundConfirmed ? 'rgba(124,111,205,.08)' : 'rgba(255,255,255,.03)',
                    border: `1px solid ${refundConfirmed ? 'rgba(124,111,205,.3)' : 'var(--line)'}`,
                    cursor: 'pointer', marginBottom: '14px', transition: 'all .15s',
                  }}>
                    <input
                      type="checkbox" checked={refundConfirmed}
                      onChange={e => setRefundConfirmed(e.target.checked)}
                      style={{ marginTop: '2px', accentColor: 'var(--purple)', flexShrink: 0, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '.82rem', color: 'var(--t1)', lineHeight: 1.55 }}>
                      환불 예상 금액 <strong style={{ color: 'var(--ok)' }}>{formatPrice(refundModal.refundAmount)}</strong>을 확인하였으며, 해당 금액으로 환불을 요청합니다.
                    </span>
                  </label>
                  <button className="btn btn-primary w-full" onClick={submitRefund}
                    disabled={!refundReason.trim() || !refundConfirmed}>
                    환불 요청하기
                  </button>
                </>
              ) : (
                <button className="btn btn-ghost w-full" onClick={() => setRefundModal(null)}>닫기</button>
              )}
            </div>
          </div>
        </div>
        )
      })()}
    </>
  )
}
