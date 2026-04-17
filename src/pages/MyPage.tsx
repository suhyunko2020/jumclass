import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAuthModal } from '../components/auth/AuthModal'
import { useCourses } from '../hooks/useCourses'
import { useToast } from '../components/ui/Toast'
import { formatPrice, calcRefund } from '../utils/format'
import {
  getMyInquiries, addInquiry, editInquiry as editInquiryStorage,
} from '../utils/storage'
import type { Inquiry } from '../data/types'

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
  const { openAuth } = useAuthModal()
  const { getCourse } = useCourses()
  const toast = useToast()

  const [tab, setTab] = useState<MyTab>((searchParams.get('tab') as MyTab) || 'payments')
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('문의 작성')
  const [form, setForm] = useState<InquiryForm>(emptyForm)
  const [openBodies, setOpenBodies] = useState<Record<string, boolean>>({})

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

  async function loadInquiries() {
    if (!user) return
    const data = await getMyInquiries(user.uid)
    setInquiries(data)
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
        <div className="g-ico">👤</div>
        <h2>로그인이 필요합니다</h2>
        <p>마이페이지는 로그인 후 이용 가능합니다.</p>
        <button className="btn btn-primary mt-16" onClick={() => openAuth('login')}>로그인</button>
      </div>
    )
  }

  const enrollments = [...(user.enrollments || [])].sort(
    (a, b) => new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime()
  )

  function openNewInquiry() {
    setForm(emptyForm)
    setModalTitle('새 문의 작성')
    setModalOpen(true)
  }

  const [refundModal, setRefundModal] = useState<{
    courseId: string; courseTitle: string; orderDate: string;
    refundable: boolean; refundAmount: number; penalty: number; reason: string;
    price: number; badge: string;
    completedCount: number; totalLessons: number; progress: number;
    daysSinceEnroll: number; totalDays: number;
  } | null>(null)
  const [refundReason, setRefundReason] = useState('')

  function openRefundRequest(courseId: string, orderDate: string) {
    const course = getCourse(courseId)
    if (!course) return
    const enrollment = user!.enrollments.find(e => e.courseId === courseId)
    if (!enrollment) return
    const totalLessons = course.curriculum.reduce((s, sec) => s + sec.items.length, 0)
    const result = calcRefund(course, enrollment, totalLessons)
    const completedCount = enrollment.completedLessons?.length ?? 0
    // 자정 기준으로 일수 계산 — 어제 등록하면 시각과 무관하게 "1일 경과"
    const enrolledMidnight = new Date(enrollment.enrolledAt); enrolledMidnight.setHours(0, 0, 0, 0)
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0)
    const expiryMidnight = new Date(enrollment.expiryDate); expiryMidnight.setHours(0, 0, 0, 0)
    const daysSinceEnroll = Math.max(0, Math.round((todayMidnight.getTime() - enrolledMidnight.getTime()) / 86400000))
    const totalDays = Math.max(1, Math.round((expiryMidnight.getTime() - enrolledMidnight.getTime()) / 86400000))
    setRefundModal({
      courseId, courseTitle: course.title, orderDate,
      ...result, price: course.price, badge: course.badge,
      completedCount, totalLessons, progress: enrollment.progress || 0,
      daysSinceEnroll, totalDays,
    })
    setRefundReason('')
  }

  async function submitRefund() {
    if (!refundModal || !refundReason.trim()) return
    const msg = `결제일: ${refundModal.orderDate}\n강의: ${refundModal.courseTitle}\n환불 예상 금액: ${formatPrice(refundModal.refundAmount)}\n\n환불 사유: ${refundReason}`
    await addInquiry(user!.uid, user!.name, user!.email, '결제 환불 요청합니다.', msg, 'refund', { courseId: refundModal.courseId, orderDate: refundModal.orderDate })
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

  async function submitInquiry(e: React.FormEvent) {
    e.preventDefault()
    if (form.id) {
      await editInquiryStorage(form.id, form.subject, form.message)
      toast('성공적으로 수정되었습니다.', 'ok')
    } else {
      await addInquiry(user!.uid, user!.name, user!.email, form.subject, form.message, form.type, form.metadata)
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

            {/* ════ 결제 내역 ════ */}
            {tab === 'payments' && (
              <div>
                <div className="mypage-section-header">
                  <h2 className="mypage-section-title">결제 내역</h2>
                  <span className="mypage-section-count">{enrollments.length}건</span>
                </div>

                {enrollments.length === 0 ? (
                  <div className="mypage-empty">
                    <div className="mypage-empty-ico">💳</div>
                    <div className="mypage-empty-text">결제 내역이 없습니다.</div>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/courses')}>강의 둘러보기</button>
                  </div>
                ) : (
                  <div className="payment-list">
                    {enrollments.map(e => {
                      const c = getCourse(e.courseId)
                      if (!c) return null
                      const date = new Date(e.enrolledAt).toLocaleDateString('ko-KR')
                      const expiry = new Date(e.expiryDate)
                      const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / 86400000)
                      const isExpired = !e.paused && expiry <= new Date()
                      const isUnlimited = daysLeft > 3000

                      return (
                        <div key={e.courseId} className="payment-item">
                          <div className="payment-item-thumb">{c.emoji}</div>
                          <div className="payment-item-body">
                            <div className="payment-item-top">
                              <div className="payment-item-title">{c.title}</div>
                              {e.type === 'manual'
                                ? <span className="badge-manual">수동 등록</span>
                                : isExpired
                                ? <span className="badge-expired">만료</span>
                                : <span className="badge-active">수강중</span>}
                            </div>
                            <div className="payment-item-meta">
                              결제일 {date} &nbsp;·&nbsp; {c.level} &nbsp;·&nbsp;
                              {isUnlimited ? ' 무제한 시청' : isExpired ? ' 만료됨' : ` 잔여 ${daysLeft}일`}
                            </div>
                            <div className="payment-item-bottom">
                              <span className="payment-item-price">{formatPrice(c.price)}</span>
                              {e.type !== 'manual' && !isExpired && (
                                <button className="btn btn-ghost btn-sm"
                                  onClick={() => openRefundRequest(c.id, date)}>
                                  환불 요청
                                </button>
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
                    <div className="mypage-empty-ico">💬</div>
                    <div className="mypage-empty-text">작성한 문의가 없습니다.</div>
                    <button className="btn btn-primary btn-sm" onClick={openNewInquiry}>문의하기</button>
                  </div>
                ) : (
                  <div className="inquiry-list">
                    {inquiries.map(q => {
                      const isAns = q.status === 'answered'
                      const d = new Date(q.date).toLocaleDateString('ko-KR')
                      const isOpen = openBodies[q.id]
                      return (
                        <div key={q.id} className={`inquiry-item ${isOpen ? 'open' : ''}`}>
                          {/* 헤더 */}
                          <div className="inquiry-header" onClick={() => toggleBody(q.id)}>
                            <div className="inquiry-header-left">
                              <span className={`inquiry-status ${isAns ? 'answered' : 'pending'}`}>
                                {isAns ? '답변완료' : '답변대기'}
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

                          {/* 본문 */}
                          {isOpen && (
                            <div className="inquiry-body">
                              <div className="inquiry-message">{q.message}</div>
                              {!isAns && (
                                <button className="btn btn-ghost btn-sm" style={{ marginTop: '12px' }}
                                  onClick={() => openEditInquiry(q)}>
                                  수정하기
                                </button>
                              )}
                              {isAns && (
                                <div className="inquiry-answer">
                                  <div className="inquiry-answer-label">관리자 답변 ✦</div>
                                  <div className="inquiry-answer-text">{q.answer}</div>
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
                  <div style={{ fontSize: '.8rem', fontWeight: 600, textAlign: 'right' }}>{refundModal.completedCount}/{refundModal.totalLessons}강 ({refundModal.progress}%)</div>
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
                    <div style={{ fontSize: '.8rem', color: 'var(--t2)' }}>이미 수강을 완료하여 환불이 불가능합니다.</div>
                  </div>
                ) : refundModal.refundable ? (() => {
                  const baseRefund = refundModal.refundAmount + refundModal.penalty
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
                  <button className="btn btn-primary w-full" onClick={submitRefund} disabled={!refundReason.trim()}>
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
