import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCourses } from '../hooks/useCourses'
import { useToast } from '../components/ui/Toast'
import {
  getCustomCourses,
  getInquiries, answerInquiry,
  getAllUsers, getAllEnrollmentsAdmin, cancelEnrollment, updateEnrollmentAdmin,
} from '../utils/storage'
import { formatPrice } from '../utils/format'
import type { Inquiry, Course, LessonItem, CurriculumSection, Instructor, InstructorService } from '../data/types'
import { useInstructors } from '../hooks/useInstructors'
import { useSiteSettings, type SiteSettings } from '../hooks/useSiteSettings'

type Section = 'overview' | 'courses' | 'instructors' | 'students' | 'payments' | 'inquiries' | 'reviews' | 'settings'

// ── 커리큘럼 편집 상태 타입 ──────────────────────────────────
interface CurrEditSection {
  _key: string   // React key용 임시 ID
  section: string
  items: CurrEditItem[]
}
interface CurrEditItem {
  id: string
  title: string
  duration: string
  vimeo: string
  status: 'free' | 'locked'
  attachments?: { name: string; ext: string; dataUrl: string }[]
}
interface CurriculumModalState {
  courseId: string
  courseTitle: string
  isCustom: boolean
  sections: CurrEditSection[]
}

// ── 강의 등록/편집 폼 타입 ──────────────────────────────────
interface CourseEditForm {
  _isNew: boolean
  _isCustom: boolean
  id: string
  emoji: string
  title: string
  subtitle: string
  description: string
  level: string
  duration: string
  lessons: number
  badge: string
  status: 'public' | 'private'
  instructor: string
  instructorAvatar: string
  instructorBio: string
  tiers: { days: number; price: number; originalPrice: number }[]
  whatYouLearnText: string
}

const DEFAULT_TIERS = [
  { days: 30, price: 0, originalPrice: 0 },
  { days: 90, price: 0, originalPrice: 0 },
  { days: 9999, price: 0, originalPrice: 0 },
]

export default function AdminPage() {
  const { isAdminLoggedIn, adminLogin, adminLogout, enrollManual } = useAuth()
  const { getAllCourses, getEnrolledCount, saveCourseOverride, saveCustomCourse, deleteCustomCourse, deleteReviewById, addReview } = useCourses()
  const { getAll: getAllInstructors, saveInstructor, deleteInstructor } = useInstructors()
  const { get: getSettings, save: saveSettings } = useSiteSettings()
  const [siteSettingsForm, setSiteSettingsForm] = useState<SiteSettings | null>(null)
  const toast = useToast()
  const navigate = useNavigate()

  const [sec, setSec] = useState<Section>('overview')
  const [aid, setAid] = useState('')
  const [apw, setApw] = useState('')
  const [loginErr, setLoginErr] = useState(false)

  // 모달 상태
  const [answerModal, setAnswerModal] = useState<{ inq: Inquiry; text: string } | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [enrollModal, setEnrollModal] = useState<{ user: any; courseId: string; days: number } | null>(null)
  const [courseEditModal, setCourseEditModal] = useState<CourseEditForm | null>(null)
  const [courseDetailModal, setCourseDetailModal] = useState<Course | null>(null)
  const [curriculumModal, setCurriculumModal] = useState<CurriculumModalState | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [users, setUsers] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [allEnrollments, setAllEnrollments] = useState<any[]>([])
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [reviews, setReviews] = useState<{ id: string; courseId: string; userId: string; userName: string; userAvatar: string; rating: number; text: string; date: string; source?: string }[]>([])
  const [adminReviewModal, setAdminReviewModal] = useState(false)
  const [arForm, setArForm] = useState({ courseId: '', userName: '', rating: 5, text: '' })
  const [studentSearch, setStudentSearch] = useState('')
  const [instModal, setInstModal] = useState<Instructor | null>(null)
  const [instSvcModal, setInstSvcModal] = useState<{ instId: string; service: InstructorService | null } | null>(null)
  const [courseEnrollModal, setCourseEnrollModal] = useState<string | null>(null)
  const [ceUserId, setCeUserId] = useState('')
  const [ceDays, setCeDays] = useState(365)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [enrollEditModal, setEnrollEditModal] = useState<{ user: any; enrollment: any; course: any } | null>(null)

  useEffect(() => { document.title = '관리자 대시보드 — JUMCLASS' }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [courses, setCourses] = useState<Course[]>([])

  useEffect(() => {
    if (!isAdminLoggedIn) return
    setCourses(getAllCourses())
    loadAdminData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminLoggedIn])

  // reload on tick (after mutations)
  const [, setTick] = useState(0)
  const refresh = useCallback(() => {
    setTick(t => t + 1)
    if (isAdminLoggedIn) {
      setCourses(getAllCourses())
      loadAdminData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminLoggedIn])

  async function loadAdminData() {
    const [dbUsers, dbEnrollments, dbInquiries] = await Promise.all([
      getAllUsers(),
      getAllEnrollmentsAdmin(),
      getInquiries(),
    ])
    setUsers(dbUsers)
    setAllEnrollments(dbEnrollments)
    setInquiries(dbInquiries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
    // reviews come from localStorage cache (synced from Supabase at app start via syncFromSupabase)
    try {
      const raw = localStorage.getItem('arcana_reviews')
      const cached = raw ? JSON.parse(raw) : []
      setReviews(cached.sort((a: { date: string }, b: { date: string }) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()))
    } catch { setReviews([]) }
  }

  // ── 로그인 게이트 ───────────────────────────────────────────
  if (!isAdminLoggedIn) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: 'var(--r4)', padding: '44px 40px', maxWidth: '400px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '26px' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>🔐</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '4px' }}>JUMCLASS</div>
            <div style={{ fontSize: '.82rem', color: 'var(--t3)' }}>관리자 전용 접근</div>
          </div>
          <form onSubmit={e => {
            e.preventDefault()
            if (!adminLogin(aid, apw)) setLoginErr(true)
          }}>
            <div className="form-group">
              <label className="form-label">관리자 ID</label>
              <input className="form-input" type="text" placeholder="admin" required
                value={aid} onChange={e => { setAid(e.target.value); setLoginErr(false) }} />
            </div>
            <div className="form-group">
              <label className="form-label">비밀번호</label>
              <input className="form-input" type="password" placeholder="••••••••" required
                value={apw} onChange={e => { setApw(e.target.value); setLoginErr(false) }} />
            </div>
            {loginErr && <div className="err-msg">아이디 또는 비밀번호가 올바르지 않습니다.</div>}
            <button type="submit" className="btn btn-primary w-full">대시보드 접속</button>
          </form>
          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            <Link to="/" style={{ fontSize: '.8rem', color: 'var(--t3)' }}>← 메인 사이트로</Link>
          </div>
        </div>
      </div>
    )
  }

  const pendingCount = inquiries.filter(i => i.status === 'pending').length

  const allInstructors = getAllInstructors()

  const navItems: { sec: Section; icon: string; label: string; badge?: number }[] = [
    { sec: 'overview',    icon: '📊', label: '대시보드' },
    { sec: 'courses',     icon: '📚', label: '강의 관리' },
    { sec: 'instructors', icon: '👤', label: '강사 관리' },
    { sec: 'students',    icon: '👥', label: '수강생' },
    { sec: 'payments',    icon: '💳', label: '결제 내역' },
    { sec: 'inquiries',   icon: '💬', label: '문의 관리', badge: pendingCount },
    { sec: 'reviews',     icon: '⭐', label: '리뷰 관리' },
    { sec: 'settings',    icon: '⚙', label: '설정' },
  ]

  function openNewInstructor() {
    setInstModal({
      id: 'inst-' + Date.now(), name: '', photo: '', title: '', bio: '',
      specialties: [], experience: '', instagram: '', kakao: '', phone: '',
      consultOnline: false, consultOffline: false, offlineAddress: '',
      services: [], courseIds: [], status: 'public',
    })
  }

  function handleSaveInstructor(e: React.FormEvent) {
    e.preventDefault()
    if (!instModal) return
    saveInstructor(instModal)
    toast('강사 정보가 저장되었습니다.', 'ok')
    setInstModal(null)
  }

  function handleSaveService(e: React.FormEvent) {
    e.preventDefault()
    if (!instSvcModal) return
    const inst = getAllInstructors().find(i => i.id === instSvcModal.instId)
    if (!inst) return
    const svc = instSvcModal.service
    if (!svc) return
    const services = [...inst.services]
    const idx = services.findIndex(s => s.id === svc.id)
    if (idx >= 0) services[idx] = svc
    else services.push(svc)
    saveInstructor({ ...inst, services })
    toast('서비스가 저장되었습니다.', 'ok')
    setInstSvcModal(null)
  }

  // ── 문의 답변 저장 ──────────────────────────────────────────
  async function handleAnswer(e: React.FormEvent) {
    e.preventDefault()
    if (!answerModal) return
    await answerInquiry(answerModal.inq.id, answerModal.text)
    toast('답변이 등록되었습니다.', 'ok')
    setAnswerModal(null)
    refresh()
  }

  // ── 수동 수강 등록 ──────────────────────────────────────────
  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault()
    if (!enrollModal) return
    const ok = await enrollManual(enrollModal.user.uid, enrollModal.courseId, enrollModal.days)
    if (ok) toast(`${enrollModal.user.name}님 수동 등록 완료`, 'ok')
    else toast('등록 실패', 'err')
    setEnrollModal(null)
    refresh()
  }

  // ── 수강 취소 ──────────────────────────────────────────────
  async function handleCancelEnroll(uid: string, courseId: string) {
    if (!confirm('수강을 취소하시겠습니까?')) return
    const ok = await cancelEnrollment(uid, courseId)
    if (ok) toast('수강이 취소되었습니다.', 'ok')
    else toast('취소 실패', 'err')
    refresh()
  }

  // ── 강의 등록/편집 저장 ────────────────────────────────────
  function handleCourseEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!courseEditModal) return
    const { _isNew, _isCustom, whatYouLearnText, tiers, id, ...rest } = courseEditModal
    const whatYouLearn = whatYouLearnText.split('\n').map(s => s.trim()).filter(Boolean)
    const pricingTiers = tiers.filter(t => t.price > 0)
    const price = pricingTiers[0]?.price || 0
    const originalPrice = pricingTiers[0]?.originalPrice || 0

    if (_isNew || _isCustom) {
      const existing = courses.find(c => c.id === id)
      const course: Course = {
        id,
        ...rest,
        price,
        originalPrice,
        pricingTiers,
        whatYouLearn,
        curriculum: existing?.curriculum || [],
        rating: existing?.rating ?? 4.5,
        ratingCount: existing?.ratingCount ?? 0,
        students: existing?.students ?? 0,
        pauseConfig: existing?.pauseConfig || { maxPauses: 2, maxDays: 30 },
      }
      saveCustomCourse(course)
      toast(_isNew ? '강의가 등록되었습니다.' : '강의가 수정되었습니다.', 'ok')
    } else {
      saveCourseOverride(id, { ...rest, price, originalPrice, pricingTiers, whatYouLearn })
      toast('강의 정보가 업데이트되었습니다.', 'ok')
    }
    setCourseEditModal(null)
    refresh()
  }

  function openCourseEdit(c: Course) {
    const isCustom = getCustomCourses().some(x => x.id === c.id)
    setCourseEditModal({
      _isNew: false,
      _isCustom: isCustom,
      id: c.id,
      emoji: c.emoji || '📚',
      title: c.title,
      subtitle: c.subtitle || '',
      description: c.description || '',
      level: c.level,
      duration: c.duration || '',
      lessons: c.lessons || 0,
      badge: c.badge || '',
      status: c.status || 'public',
      instructor: c.instructor || '',
      instructorAvatar: c.instructorAvatar || '🎓',
      instructorBio: c.instructorBio || '',
      tiers: c.pricingTiers?.length ? c.pricingTiers.map(t => ({ ...t })) : DEFAULT_TIERS.map(t => ({ ...t, price: c.price, originalPrice: c.originalPrice })),
      whatYouLearnText: (c.whatYouLearn || []).join('\n'),
    })
  }

  function openNewCourse() {
    setCourseEditModal({
      _isNew: true,
      _isCustom: false,
      id: 'course_' + Date.now(),
      emoji: '📚',
      title: '',
      subtitle: '',
      description: '',
      level: '입문',
      duration: '',
      lessons: 0,
      badge: '',
      status: 'public',
      instructor: '',
      instructorAvatar: '🎓',
      instructorBio: '',
      tiers: DEFAULT_TIERS.map(t => ({ ...t })),
      whatYouLearnText: '',
    })
  }

  // ── 커스텀 강의 삭제 ────────────────────────────────────────
  function handleDeleteCourse(id: string) {
    if (!confirm('강의를 삭제하시겠습니까? 수강 내역은 유지됩니다.')) return
    deleteCustomCourse(id)
    toast('강의가 삭제되었습니다.', 'ok')
    refresh()
  }

  // ── 커리큘럼 편집 열기 ─────────────────────────────────────
  function openCurriculumEdit(c: Course) {
    const isCustom = getCustomCourses().some(x => x.id === c.id)
    setCurriculumModal({
      courseId: c.id,
      courseTitle: c.title,
      isCustom,
      sections: (c.curriculum || []).map(s => ({
        _key: Math.random().toString(36).slice(2),
        section: s.section,
        items: s.items.map(i => ({ ...i })),
      })),
    })
  }

  function currAddSection() {
    setCurriculumModal(p => p ? {
      ...p,
      sections: [...p.sections, {
        _key: Math.random().toString(36).slice(2),
        section: '',
        items: [],
      }],
    } : null)
  }

  function currDeleteSection(key: string) {
    setCurriculumModal(p => p ? { ...p, sections: p.sections.filter(s => s._key !== key) } : null)
  }

  function currUpdateSection(key: string, name: string) {
    setCurriculumModal(p => p ? {
      ...p,
      sections: p.sections.map(s => s._key === key ? { ...s, section: name } : s),
    } : null)
  }

  function currAddLesson(sectionKey: string) {
    setCurriculumModal(p => p ? {
      ...p,
      sections: p.sections.map(s => s._key !== sectionKey ? s : {
        ...s,
        items: [...s.items, {
          id: `l_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          title: '', duration: '', vimeo: '', status: 'locked' as const,
        }],
      }),
    } : null)
  }

  function currDeleteLesson(sectionKey: string, lessonId: string) {
    setCurriculumModal(p => p ? {
      ...p,
      sections: p.sections.map(s => s._key !== sectionKey ? s : {
        ...s, items: s.items.filter(i => i.id !== lessonId),
      }),
    } : null)
  }

  function currUpdateLesson(sectionKey: string, lessonId: string, field: keyof CurrEditItem, value: string) {
    setCurriculumModal(p => p ? {
      ...p,
      sections: p.sections.map(s => s._key !== sectionKey ? s : {
        ...s,
        items: s.items.map(i => i.id !== lessonId ? i : { ...i, [field]: value }),
      }),
    } : null)
  }

  async function currFetchVimeoDuration(sectionKey: string, lessonId: string, vimeoId: string) {
    if (!vimeoId) return
    try {
      const res = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${vimeoId}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.duration) {
        const mins = Math.floor(data.duration / 60)
        const secs = data.duration % 60
        const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        currUpdateLesson(sectionKey, lessonId, 'duration', formatted)
        toast(`영상 길이: ${formatted}`, 'ok')
      }
    } catch { /* ignore */ }
  }

  function currAddAttachment(sectionKey: string, lessonId: string, file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const att = { name: file.name.replace(/\.[^.]+$/, ''), ext, dataUrl: reader.result as string }
      setCurriculumModal(p => p ? {
        ...p,
        sections: p.sections.map(s => s._key !== sectionKey ? s : {
          ...s,
          items: s.items.map(i => i.id !== lessonId ? i : { ...i, attachments: [...(i.attachments || []), att] }),
        }),
      } : null)
    }
    reader.readAsDataURL(file)
  }

  function currRemoveAttachment(sectionKey: string, lessonId: string, attIdx: number) {
    setCurriculumModal(p => p ? {
      ...p,
      sections: p.sections.map(s => s._key !== sectionKey ? s : {
        ...s,
        items: s.items.map(i => i.id !== lessonId ? i : { ...i, attachments: (i.attachments || []).filter((_, j) => j !== attIdx) }),
      }),
    } : null)
  }

  function handleSaveCurriculum() {
    if (!curriculumModal) return
    const curriculum: CurriculumSection[] = curriculumModal.sections
      .filter(s => s.section.trim())
      .map(s => ({
        section: s.section.trim(),
        items: s.items.filter(i => i.title.trim()).map(i => ({
          id: i.id,
          title: i.title.trim(),
          duration: i.duration || '00:00',
          vimeo: i.vimeo || '',
          status: i.status as LessonItem['status'],
          ...(i.attachments && i.attachments.length > 0 ? { attachments: i.attachments } : {}),
        })),
      }))

    const totalLessons = curriculum.reduce((n, s) => n + s.items.length, 0)

    if (curriculumModal.isCustom) {
      const c = courses.find(x => x.id === curriculumModal.courseId)
      if (c) saveCustomCourse({ ...c, curriculum, lessons: totalLessons })
    } else {
      saveCourseOverride(curriculumModal.courseId, { curriculum, lessons: totalLessons })
    }
    toast('커리큘럼이 저장되었습니다.', 'ok')
    setCurriculumModal(null)
    refresh()
  }

  // ── 리뷰 삭제 ──────────────────────────────────────────────
  async function handleDeleteReview(id: string) {
    if (!confirm('리뷰를 삭제하시겠습니까?')) return
    await deleteReviewById(id)
    toast('리뷰가 삭제되었습니다.', 'ok')
    refresh()
  }

  // ── 관리자 리뷰 작성 ──────────────────────────────────────
  async function handleAdminReview(e: React.FormEvent) {
    e.preventDefault()
    if (!arForm.courseId || !arForm.userName || !arForm.text) return
    await addReview(arForm.courseId, 'admin-' + Date.now(), arForm.userName, '✍', arForm.rating, arForm.text, 'admin')
    toast('리뷰가 등록되었습니다.', 'ok')
    setAdminReviewModal(false)
    setArForm({ courseId: '', userName: '', rating: 5, text: '' })
    refresh()
  }

  // ── 강의별 수강생 등록 ──────────────────────────────────────
  async function handleCourseEnroll(e: React.FormEvent) {
    e.preventDefault()
    if (!courseEnrollModal || !ceUserId) return
    const ok = await enrollManual(ceUserId, courseEnrollModal, ceDays)
    if (ok) toast('수강 등록 완료', 'ok')
    else toast('등록 실패', 'err')
    setCourseEnrollModal(null)
    setCeUserId('')
    setCeDays(365)
    refresh()
  }

  // ── 수강 정보 수정 ────────────────────────────────────────
  async function handleEnrollEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!enrollEditModal) return
    const em = enrollEditModal
    const ok = await updateEnrollmentAdmin(em.user.uid, em.enrollment.courseId, {
      expiryDate: em.enrollment.expiryDate,
      paused: em.enrollment.paused,
      pauseCount: em.enrollment.pauseCount,
      remainingDays: em.enrollment.remainingDays,
    })
    if (ok) toast('수강 정보가 수정되었습니다.', 'ok')
    else toast('수정 실패', 'err')
    setEnrollEditModal(null)
    refresh()
  }

  // ─────────────────────────────────────────────────────────────
  // render
  // ─────────────────────────────────────────────────────────────
  return (
    <>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

        {/* ── 사이드바 ── */}
        <div style={{
          width: '220px', flexShrink: 0, background: 'rgba(6,7,15,.95)',
          borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--line)', fontSize: '1.05rem', fontWeight: 800 }}>
            JUM<span style={{ color: 'var(--purple-2)' }}>CLASS</span>
            <div style={{ fontSize: '.68rem', color: 'var(--t3)', fontWeight: 400, marginTop: '2px' }}>관리자 콘솔</div>
          </div>
          <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
            {navItems.map(n => (
              <button key={n.sec} onClick={() => setSec(n.sec)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                  borderRadius: 'var(--r2)', fontSize: '.875rem', fontWeight: 600,
                  background: sec === n.sec ? 'rgba(124,111,205,.15)' : 'transparent',
                  color: sec === n.sec ? 'var(--purple-2)' : 'var(--t2)',
                  transition: 'var(--t)', width: '100%', textAlign: 'left',
                }}
              >
                <span>{n.icon}</span>
                <span style={{ flex: 1 }}>{n.label}</span>
                {(n.badge ?? 0) > 0 && (
                  <span style={{ fontSize: '.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 'var(--pill)', background: 'rgba(232,156,56,.2)', color: 'var(--warn)' }}>
                    {n.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div style={{ padding: '16px', borderTop: '1px solid var(--line)' }}>
            <div style={{ fontSize: '.76rem', color: 'var(--t3)', marginBottom: '8px' }}>관리자: admin</div>
            <button className="btn btn-ghost btn-sm w-full" onClick={() => { adminLogout(); navigate('/') }}>로그아웃</button>
          </div>
        </div>

        {/* ── 메인 콘텐츠 ── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>

          {/* ═══ 대시보드 ═══ */}
          {sec === 'overview' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.03em' }}>대시보드</h1>
                <div style={{ fontSize: '.82rem', color: 'var(--t3)' }}>
                  {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>

              {/* 통계 카드 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '28px' }}>
                {[
                  { ico: '👥', val: String(users.length), lbl: '총 회원 수', sub: '가입 회원' },
                  { ico: '💳', val: String(allEnrollments.length), lbl: '총 수강 등록', sub: '전체 건수' },
                  { ico: '💬', val: String(pendingCount), lbl: '미처리 문의', sub: '답변 대기', warn: pendingCount > 0 },
                  { ico: '⭐', val: String(reviews.length), lbl: '등록 리뷰', sub: '전체 리뷰 수' },
                ].map(s => (
                  <div key={s.lbl} style={{ background: 'var(--glass-1)', border: '1px solid var(--line)', borderRadius: 'var(--r3)', padding: '20px' }}>
                    <div style={{ fontSize: '1.6rem', marginBottom: '10px' }}>{s.ico}</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: '2px' }}>{s.val}</div>
                    <div style={{ fontSize: '.8rem', fontWeight: 600, marginBottom: '2px' }}>{s.lbl}</div>
                    <div style={{ fontSize: '.72rem', color: s.warn ? 'var(--warn)' : 'var(--t3)' }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* 강의별 현황 */}
              <div style={{ background: 'var(--glass-1)', border: '1px solid var(--line)', borderRadius: 'var(--r3)', overflow: 'hidden', marginBottom: '20px' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '.95rem', fontWeight: 700 }}>강의별 수강 현황</h3>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSec('courses')}>전체 보기 →</button>
                </div>
                <table className="admin-table">
                  <thead><tr><th>강의명</th><th>강사</th><th>수강생</th><th>가격</th><th>리뷰</th></tr></thead>
                  <tbody>
                    {courses.map(c => {
                      const courseReviews = reviews.filter(r => r.courseId === c.id)
                      const avg = courseReviews.length
                        ? (courseReviews.reduce((s, r) => s + r.rating, 0) / courseReviews.length).toFixed(1)
                        : '-'
                      return (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 600 }}>{c.emoji} {c.title}</td>
                          <td style={{ color: 'var(--t2)' }}>{c.instructor}</td>
                          <td>{getEnrolledCount(c.id)}명</td>
                          <td>{formatPrice(c.price)}</td>
                          <td>★ {avg} ({courseReviews.length}개)</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* 최근 수강 등록 */}
              <div style={{ background: 'var(--glass-1)', border: '1px solid var(--line)', borderRadius: 'var(--r3)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '.95rem', fontWeight: 700 }}>최근 수강 등록</h3>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSec('payments')}>전체 보기 →</button>
                </div>
                {allEnrollments.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--t3)' }}>수강 등록 내역이 없습니다.</div>
                ) : (
                  <table className="admin-table">
                    <thead><tr><th>수강생</th><th>강의</th><th>등록일</th><th>수강 기간</th><th>타입</th></tr></thead>
                    <tbody>
                      {allEnrollments.slice(0, 8).map((e, i) => {
                        const c = courses.find(x => x.id === e.courseId)
                        const daysLeft = e.paused
                          ? `${e.remainingDays || 0}일 (휴강)`
                          : `${Math.max(0, Math.ceil((new Date(e.expiryDate).getTime() - Date.now()) / 86400000))}일 남음`
                        return (
                          <tr key={i}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--purple),var(--purple-sat))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.68rem', fontWeight: 700 }}>{e.user.avatar}</div>
                                <span style={{ fontSize: '.855rem', fontWeight: 600 }}>{e.user.name}</span>
                              </div>
                            </td>
                            <td style={{ fontSize: '.855rem' }}>{c ? `${c.emoji} ${c.title}` : e.courseId}</td>
                            <td style={{ fontSize: '.8rem', color: 'var(--t3)' }}>{new Date(e.enrolledAt).toLocaleDateString()}</td>
                            <td style={{ fontSize: '.8rem', color: e.paused ? 'var(--warn)' : 'var(--t2)' }}>{daysLeft}</td>
                            <td>
                              <span style={{ fontSize: '.68rem', padding: '2px 7px', borderRadius: 'var(--pill)', background: e.type === 'manual' ? 'rgba(232,156,56,.12)' : 'rgba(52,196,124,.12)', color: e.type === 'manual' ? 'var(--warn)' : 'var(--ok)' }}>
                                {e.type === 'manual' ? '수동' : '결제'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ═══ 강의 관리 ═══ */}
          {sec === 'courses' && (() => {
            const customIds = new Set(getCustomCourses().map(c => c.id))
            return (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.03em' }}>강의 관리 ({courses.length}개)</h1>
                  <button className="btn btn-primary btn-sm" onClick={openNewCourse}>+ 새 강의 등록</button>
                </div>
                <div style={{ background: 'var(--glass-1)', border: '1px solid var(--line)', borderRadius: 'var(--r3)', overflow: 'hidden' }}>
                  <table className="admin-table">
                    <thead>
                      <tr><th>강의명</th><th>강사</th><th>수강생</th><th>가격</th><th>레벨</th><th>상태</th><th>액션</th></tr>
                    </thead>
                    <tbody>
                      {courses.map(c => {
                        const isCustom = customIds.has(c.id)
                        return (
                          <tr key={c.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.2rem' }}>{c.emoji}</span>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {c.title}
                                    {isCustom && (
                                      <span style={{ fontSize: '.62rem', padding: '1px 5px', borderRadius: 'var(--pill)', background: 'rgba(232,156,56,.15)', color: 'var(--warn)' }}>직접등록</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '.75rem', color: 'var(--t3)' }}>{c.lessons}강 · {c.duration}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ fontSize: '.875rem', color: 'var(--t2)' }}>{c.instructor}</td>
                            <td>
                              <button
                                style={{ background: 'none', color: 'var(--purple-2)', fontSize: '.855rem', cursor: 'pointer', textDecoration: 'underline' }}
                                onClick={() => setCourseDetailModal(c)}
                              >
                                {getEnrolledCount(c.id)}명
                              </button>
                            </td>
                            <td>
                              <div style={{ fontSize: '.875rem' }}>{formatPrice(c.price)}</div>
                              <div style={{ fontSize: '.72rem', color: 'var(--t3)', textDecoration: 'line-through' }}>{formatPrice(c.originalPrice)}</div>
                            </td>
                            <td>
                              <span style={{ fontSize: '.72rem', padding: '2px 8px', borderRadius: 'var(--pill)', background: 'rgba(124,111,205,.1)', color: 'var(--purple-2)' }}>{c.level}</span>
                            </td>
                            <td>
                              <span style={{ fontSize: '.72rem', padding: '2px 8px', borderRadius: 'var(--pill)', background: c.status === 'private' ? 'rgba(224,82,82,.1)' : 'rgba(52,196,124,.1)', color: c.status === 'private' ? 'var(--fail)' : 'var(--ok)' }}>
                                {c.status === 'private' ? '비공개' : '공개'}
                              </span>
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button className="btn btn-primary btn-sm" onClick={() => openCourseEdit(c)}>편집</button>
                                <button className="btn btn-ghost btn-sm" onClick={() => openCurriculumEdit(c)}>커리큘럼</button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setCourseEnrollModal(c.id)}>+ 수강생</button>
                                <Link to={`/course/${c.id}`} className="btn btn-ghost btn-sm">보기</Link>
                                {isCustom ? (
                                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--fail)' }} onClick={() => handleDeleteCourse(c.id)}>삭제</button>
                                ) : (
                                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--fail)' }} onClick={() => {
                                    if (!confirm(`"${c.title}" 강의를 비공개 처리하시겠습니까?`)) return
                                    saveCourseOverride(c.id, { status: 'private' })
                                    toast('강의가 비공개 처리되었습니다.', 'ok')
                                    refresh()
                                  }}>비공개</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          {/* ═══ 수강생 관리 ═══ */}
          {sec === 'students' && (() => {
            const q = studentSearch.toLowerCase().trim()
            const filteredUsers = q ? users.filter(u =>
              (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
            ) : users
            return (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.03em' }}>수강생 ({users.length}명)</h1>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <input className="form-input" type="text" placeholder="이름 또는 이메일로 검색..."
                  style={{ maxWidth: '360px', fontSize: '.875rem' }}
                  value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
              </div>
              <div style={{ background: 'var(--glass-1)', border: '1px solid var(--line)', borderRadius: 'var(--r3)', overflow: 'hidden' }}>
                {filteredUsers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--t2)' }}>
                    {q ? '검색 결과가 없습니다.' : '등록된 수강생이 없습니다.'}
                  </div>
                ) : (
                  <table className="admin-table">
                    <thead><tr><th>이름</th><th>이메일</th><th>수강 강의</th><th>가입일</th><th>액션</th></tr></thead>
                    <tbody>
                      {filteredUsers.map(u => (
                        <tr key={u.uid}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--purple),var(--purple-sat))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: 700 }}>
                                {u.avatar}
                              </div>
                              <span style={{ fontWeight: 600 }}>{u.name}</span>
                            </div>
                          </td>
                          <td style={{ fontSize: '.855rem', color: 'var(--t2)' }}>{u.email}</td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {(u.enrollments || []).length === 0
                                ? <span style={{ color: 'var(--t3)', fontSize: '.8rem' }}>없음</span>
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                : (u.enrollments || []).map((e: any) => {
                                  const c = courses.find(x => x.id === e.courseId)
                                  return (
                                    <div key={e.courseId} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <button
                                        style={{ fontSize: '.72rem', padding: '2px 7px', borderRadius: 'var(--pill)', background: 'rgba(124,111,205,.1)', color: 'var(--purple-2)', cursor: 'pointer' }}
                                        onClick={() => setEnrollEditModal({ user: u, enrollment: { ...e }, course: c })}
                                      >
                                        {c ? `${c.emoji} ${c.title.slice(0, 8)}` : e.courseId}
                                      </button>
                                      <button
                                        title="수강 취소"
                                        style={{ fontSize: '.65rem', color: 'var(--fail)', cursor: 'pointer', padding: '1px 4px', borderRadius: '3px', background: 'rgba(224,82,82,.1)' }}
                                        onClick={() => handleCancelEnroll(u.uid, e.courseId)}
                                      >✕</button>
                                    </div>
                                  )
                                })
                              }
                            </div>
                          </td>
                          <td style={{ fontSize: '.8rem', color: 'var(--t3)' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td>
                            <button className="btn btn-primary btn-sm"
                              onClick={() => setEnrollModal({ user: u, courseId: courses[0]?.id || '', days: 365 })}>
                              + 수강 등록
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            )
          })()}

          {/* ═══ 결제 내역 ═══ */}
          {sec === 'payments' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.03em' }}>결제 내역 ({allEnrollments.length}건)</h1>
              </div>
              <div style={{ background: 'var(--glass-1)', border: '1px solid var(--line)', borderRadius: 'var(--r3)', overflow: 'hidden' }}>
                {allEnrollments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--t2)' }}>결제 내역이 없습니다.</div>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr><th>수강생</th><th>강의</th><th>등록일</th><th>수강 기간</th><th>타입</th><th>상태</th></tr>
                    </thead>
                    <tbody>
                      {allEnrollments.map((e, i) => {
                        const c = courses.find(x => x.id === e.courseId)
                        const expired = !e.paused && new Date(e.expiryDate) <= new Date()
                        const daysLeft = e.paused
                          ? `${e.remainingDays || 0}일 (휴강)`
                          : expired
                          ? '만료됨'
                          : `${Math.ceil((new Date(e.expiryDate).getTime() - Date.now()) / 86400000)}일`
                        return (
                          <tr key={i}>
                            <td>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{e.user.name}</div>
                                <div style={{ fontSize: '.75rem', color: 'var(--t3)' }}>{e.user.email}</div>
                              </div>
                            </td>
                            <td style={{ fontSize: '.855rem' }}>{c ? `${c.emoji} ${c.title}` : e.courseId}</td>
                            <td style={{ fontSize: '.8rem', color: 'var(--t3)' }}>{new Date(e.enrolledAt).toLocaleDateString()}</td>
                            <td style={{ fontSize: '.8rem', color: expired ? 'var(--fail)' : e.paused ? 'var(--warn)' : 'var(--t2)' }}>{daysLeft}</td>
                            <td>
                              <span style={{ fontSize: '.68rem', padding: '2px 7px', borderRadius: 'var(--pill)', background: e.type === 'manual' ? 'rgba(232,156,56,.12)' : 'rgba(52,196,124,.12)', color: e.type === 'manual' ? 'var(--warn)' : 'var(--ok)' }}>
                                {e.type === 'manual' ? '수동' : '결제'}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '.68rem', padding: '2px 7px', borderRadius: 'var(--pill)', background: expired ? 'rgba(224,82,82,.1)' : e.paused ? 'rgba(232,156,56,.1)' : 'rgba(52,196,124,.1)', color: expired ? 'var(--fail)' : e.paused ? 'var(--warn)' : 'var(--ok)' }}>
                                {expired ? '만료' : e.paused ? '휴강' : '수강중'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ═══ 문의 관리 ═══ */}
          {sec === 'inquiries' && (
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.03em', marginBottom: '28px' }}>
                문의 관리
                {pendingCount > 0 && <span style={{ fontSize: '.85rem', color: 'var(--warn)', fontWeight: 400, marginLeft: '8px' }}>({pendingCount}건 대기)</span>}
              </h1>
              {inquiries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--t2)' }}>접수된 문의가 없습니다.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {inquiries.map(inq => (
                    <div key={inq.id} style={{ background: 'var(--glass-1)', border: `1px solid ${inq.status === 'pending' ? 'rgba(232,156,56,.25)' : 'var(--line)'}`, borderRadius: 'var(--r3)', padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontWeight: 700, marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {inq.type === 'refund' && (
                              <span style={{ fontSize: '.7rem', padding: '2px 7px', borderRadius: 'var(--pill)', background: 'rgba(224,82,82,.12)', color: 'var(--fail)' }}>환불 요청</span>
                            )}
                            {inq.subject}
                          </div>
                          <div style={{ fontSize: '.78rem', color: 'var(--t3)' }}>
                            {inq.userName} ({inq.userEmail}) · {new Date(inq.date).toLocaleDateString()}
                            {inq.metadata?.courseId && (() => {
                              const c = courses.find(x => x.id === inq.metadata?.courseId)
                              return c ? <span style={{ marginLeft: '8px', color: 'var(--purple-2)' }}>· {c.emoji} {c.title}</span> : null
                            })()}
                          </div>
                        </div>
                        <span style={{
                          fontSize: '.72rem', padding: '3px 10px', borderRadius: 'var(--pill)', flexShrink: 0,
                          background: inq.status === 'answered' ? 'rgba(52,196,124,.1)' : 'rgba(232,156,56,.1)',
                          color: inq.status === 'answered' ? 'var(--ok)' : 'var(--warn)',
                          border: `1px solid ${inq.status === 'answered' ? 'rgba(52,196,124,.2)' : 'rgba(232,156,56,.2)'}`,
                        }}>
                          {inq.status === 'answered' ? '답변 완료' : '답변 대기'}
                        </span>
                      </div>
                      <p style={{ fontSize: '.875rem', color: 'var(--t2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: '12px' }}>{inq.message}</p>
                      {inq.status === 'answered' && (
                        <div style={{ padding: '12px 16px', background: 'rgba(52,196,124,.05)', border: '1px solid rgba(52,196,124,.15)', borderRadius: 'var(--r2)', marginBottom: '12px' }}>
                          <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--ok)', marginBottom: '6px' }}>
                            ✓ 관리자 답변 ({inq.answeredAt ? new Date(inq.answeredAt).toLocaleDateString() : ''})
                          </div>
                          <div style={{ fontSize: '.855rem', color: 'var(--t1)', whiteSpace: 'pre-wrap' }}>{inq.answer}</div>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className={`btn btn-sm ${inq.status !== 'answered' ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setAnswerModal({ inq, text: inq.answer || '' })}>
                          {inq.status !== 'answered' ? '답변 작성' : '답변 수정'}
                        </button>
                        {inq.type === 'refund' && inq.status !== 'answered' && (
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--fail)' }}
                            onClick={async () => {
                              if (!confirm('환불 처리 하시겠습니까? (수강 내역은 유지됩니다)')) return
                              await answerInquiry(inq.id, '환불 처리가 완료되었습니다. 감사합니다.')
                              toast('환불 처리 완료', 'ok')
                              refresh()
                            }}>
                            환불 처리
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ 강사 관리 ═══ */}
          {sec === 'instructors' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.03em' }}>강사 관리 ({allInstructors.length}명)</h1>
                <button className="btn btn-primary btn-sm" onClick={openNewInstructor}>+ 강사 등록</button>
              </div>
              {allInstructors.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--t2)' }}>등록된 강사가 없습니다.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {allInstructors.map(inst => (
                    <div key={inst.id} style={{ background: 'var(--glass-1)', border: '1px solid var(--line)', borderRadius: 'var(--r3)', padding: '20px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                      <div style={{ width: '56px', height: '56px', borderRadius: 'var(--r2)', background: 'rgba(124,111,205,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800, color: 'var(--purple-2)', flexShrink: 0, overflow: 'hidden' }}>
                        {inst.photo ? <img src={inst.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : inst.name.charAt(0)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '.9rem' }}>{inst.name}</span>
                          <span style={{ fontSize: '.75rem', color: 'var(--purple-2)' }}>{inst.title}</span>
                          <span style={{ fontSize: '.68rem', padding: '2px 7px', borderRadius: 'var(--pill)', background: inst.status === 'private' ? 'rgba(224,82,82,.1)' : 'rgba(52,196,124,.1)', color: inst.status === 'private' ? 'var(--fail)' : 'var(--ok)' }}>
                            {inst.status === 'private' ? '비공개' : '공개'}
                          </span>
                        </div>
                        <div style={{ fontSize: '.78rem', color: 'var(--t3)', marginBottom: '8px' }}>{inst.experience} · 서비스 {inst.services.length}개</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => setInstModal({ ...inst })}>편집</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => {
                            const copied = { ...inst, id: 'inst-' + Date.now(), name: inst.name + ' (복사)', services: inst.services.map(s => ({ ...s, id: 'svc-' + Date.now() + Math.random().toString(36).slice(2, 6) })) }
                            saveInstructor(copied)
                            toast('강사 프로필이 복사되었습니다.', 'ok')
                          }}>복사</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => {
                            setInstSvcModal({ instId: inst.id, service: { id: 'svc-' + Date.now(), title: '', description: '', price: 0, originalPrice: 0, duration: '', type: 'consultation' } })
                          }}>+ 서비스</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--fail)' }}
                            onClick={() => { if (confirm('삭제하시겠습니까?')) { deleteInstructor(inst.id); toast('삭제 완료', 'ok') } }}>
                            삭제
                          </button>
                        </div>
                        {inst.services.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {inst.services.map((svc, si) => (
                              <div key={svc.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <button style={{ fontSize: '.6rem', color: si === 0 ? 'var(--line)' : 'var(--t3)', cursor: si === 0 ? 'default' : 'pointer', padding: '0 2px' }}
                                    disabled={si === 0}
                                    onClick={() => {
                                      const svcs = [...inst.services]
                                      ;[svcs[si - 1], svcs[si]] = [svcs[si], svcs[si - 1]]
                                      saveInstructor({ ...inst, services: svcs })
                                      toast('순서가 변경되었습니다.', 'ok')
                                    }}>▲</button>
                                  <button style={{ fontSize: '.6rem', color: si === inst.services.length - 1 ? 'var(--line)' : 'var(--t3)', cursor: si === inst.services.length - 1 ? 'default' : 'pointer', padding: '0 2px' }}
                                    disabled={si === inst.services.length - 1}
                                    onClick={() => {
                                      const svcs = [...inst.services]
                                      ;[svcs[si], svcs[si + 1]] = [svcs[si + 1], svcs[si]]
                                      saveInstructor({ ...inst, services: svcs })
                                      toast('순서가 변경되었습니다.', 'ok')
                                    }}>▼</button>
                                </div>
                                <button className="btn btn-ghost btn-sm" style={{ fontSize: '.72rem', flex: 1, justifyContent: 'flex-start' }}
                                  onClick={() => setInstSvcModal({ instId: inst.id, service: { ...svc } })}>
                                  {svc.title || '서비스'} ({formatPrice(svc.price)})
                                  {svc.mode && <span style={{ marginLeft: '6px', fontSize: '.65rem', color: 'var(--t3)' }}>{svc.mode === 'online' ? '비대면' : svc.mode === 'offline' ? '대면' : '대면&비대면'}</span>}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ 리뷰 관리 ═══ */}
          {sec === 'reviews' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.03em', margin: 0 }}>
                  리뷰 관리 ({reviews.length}개)
                </h1>
                <button className="btn btn-primary btn-sm" onClick={() => setAdminReviewModal(true)}>+ 리뷰 작성</button>
              </div>
              {reviews.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--t2)' }}>등록된 리뷰가 없습니다.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {reviews.map(r => {
                    const c = courses.find(x => x.id === r.courseId)
                    const isAdmin = r.source === 'admin'
                    return (
                      <div key={r.id} style={{ background: 'var(--glass-1)', border: '1px solid var(--line)', borderRadius: 'var(--r3)', padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--purple),var(--purple-sat))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                          {r.userAvatar}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, fontSize: '.875rem' }}>{r.userName}</span>
                            <span style={{
                              fontSize: '.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 'var(--pill)',
                              background: isAdmin ? 'rgba(232,156,56,.12)' : 'rgba(52,196,124,.12)',
                              color: isAdmin ? 'var(--warn)' : 'var(--ok)',
                            }}>{isAdmin ? '관리자' : '수강생'}</span>
                            <span style={{ fontSize: '.77rem', color: 'var(--gold)' }}>{'★'.repeat(r.rating)}</span>
                            <span style={{ fontSize: '.75rem', color: 'var(--t3)' }}>{new Date(r.date).toLocaleDateString()}</span>
                          </div>
                          {c && <div style={{ fontSize: '.75rem', color: 'var(--purple-2)', marginBottom: '6px' }}>{c.emoji} {c.title}</div>}
                          <p style={{ fontSize: '.875rem', color: 'var(--t2)', lineHeight: 1.6 }}>{r.text}</p>
                        </div>
                        <button
                          style={{ fontSize: '.75rem', padding: '5px 10px', borderRadius: 'var(--r1)', background: 'rgba(224,82,82,.1)', color: 'var(--fail)', cursor: 'pointer', flexShrink: 0 }}
                          onClick={() => handleDeleteReview(r.id)}
                        >
                          삭제
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ 설정 ═══ */}
          {sec === 'settings' && (() => {
            const form = siteSettingsForm || getSettings()
            if (!siteSettingsForm) setTimeout(() => setSiteSettingsForm(form), 0)
            return (
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.03em', marginBottom: '28px' }}>사이트 설정</h1>

                {/* 기본 정보 */}
                <div style={{ background: 'var(--glass-1)', border: '1px solid var(--line)', borderRadius: 'var(--r3)', padding: '24px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '.85rem', fontWeight: 700, marginBottom: '16px' }}>기본 정보</div>
                  <div className="form-group">
                    <label className="form-label">카피라이트</label>
                    <input className="form-input" value={form.copyright}
                      onChange={e => setSiteSettingsForm(p => p ? { ...p, copyright: e.target.value } : null)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">사업자 정보</label>
                    <input className="form-input" value={form.businessInfo}
                      onChange={e => setSiteSettingsForm(p => p ? { ...p, businessInfo: e.target.value } : null)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">브랜드 소개 (푸터)</label>
                    <textarea className="form-input" rows={2} value={form.brandDescription}
                      onChange={e => setSiteSettingsForm(p => p ? { ...p, brandDescription: e.target.value } : null)} />
                  </div>
                </div>

                {/* SEO */}
                <div style={{ background: 'var(--glass-1)', border: '1px solid var(--line)', borderRadius: 'var(--r3)', padding: '24px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '.85rem', fontWeight: 700, marginBottom: '16px' }}>SEO 설정</div>
                  <div className="form-group">
                    <label className="form-label">페이지 타이틀 (title 태그)</label>
                    <input className="form-input" value={form.seoTitle}
                      onChange={e => setSiteSettingsForm(p => p ? { ...p, seoTitle: e.target.value } : null)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">메타 설명 (description)</label>
                    <textarea className="form-input" rows={2} value={form.seoDescription}
                      onChange={e => setSiteSettingsForm(p => p ? { ...p, seoDescription: e.target.value } : null)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">키워드 (쉼표 구분)</label>
                    <input className="form-input" value={form.seoKeywords}
                      onChange={e => setSiteSettingsForm(p => p ? { ...p, seoKeywords: e.target.value } : null)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">OG 이미지 URL</label>
                    <input className="form-input" placeholder="https://..." value={form.ogImage}
                      onChange={e => setSiteSettingsForm(p => p ? { ...p, ogImage: e.target.value } : null)} />
                  </div>
                </div>

                {/* 정책 관리 */}
                <div style={{ background: 'var(--glass-1)', border: '1px solid var(--line)', borderRadius: 'var(--r3)', padding: '24px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '.85rem', fontWeight: 700, marginBottom: '16px' }}>정책 관리</div>
                  {(['privacy', 'terms', 'refund', 'copyright'] as const).map(key => (
                    <div className="form-group" key={key}>
                      <label className="form-label">
                        {key === 'privacy' ? '개인정보처리방침' : key === 'terms' ? '이용약관' : key === 'refund' ? '환불 정책' : '저작권 안내'}
                        <a href={`/policy/${key}`} target="_blank" rel="noopener noreferrer"
                          style={{ marginLeft: '8px', fontSize: '.72rem', color: 'var(--purple-2)' }}>미리보기 →</a>
                      </label>
                      <textarea className="form-input" rows={6} style={{ fontFamily: 'monospace', fontSize: '.78rem' }}
                        value={form.policies[key]}
                        onChange={e => setSiteSettingsForm(p => {
                          if (!p) return null
                          return { ...p, policies: { ...p.policies, [key]: e.target.value } }
                        })} />
                    </div>
                  ))}
                  <div style={{ fontSize: '.75rem', color: 'var(--t3)', marginTop: '-8px' }}>
                    마크다운 형식을 지원합니다. # 제목, ## 소제목, - 목록, | 표 |
                  </div>
                </div>

                <button className="btn btn-primary btn-lg w-full" onClick={() => {
                  if (siteSettingsForm) {
                    saveSettings(siteSettingsForm)
                    toast('설정이 저장되었습니다.', 'ok')
                  }
                }}>설정 저장</button>
              </div>
            )
          })()}

        </div>
      </div>

      {/* ── 강의 등록/편집 모달 ── */}
      {courseEditModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setCourseEditModal(null) }}>
          <div className="modal-box" style={{ position: 'relative', maxWidth: '660px', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <button className="modal-close" onClick={() => setCourseEditModal(null)}>✕</button>
            <div className="modal-head" style={{ flexShrink: 0 }}>
              <h2>{courseEditModal._isNew ? '새 강의 등록' : '강의 편집'}</h2>
              <p style={{ fontSize: '.82rem', color: 'var(--t3)' }}>
                {courseEditModal._isNew ? '새 강의를 등록합니다.' : '변경 사항은 즉시 사용자 화면에 반영됩니다.'}
              </p>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
              <form onSubmit={handleCourseEdit}>

                {/* ① 기본 정보 */}
                <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--t3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--line)' }}>기본 정보</div>
                <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: '0 12px' }}>
                  <div className="form-group">
                    <label className="form-label">이모지</label>
                    <input className="form-input" type="text" placeholder="📚"
                      value={courseEditModal.emoji}
                      onChange={e => setCourseEditModal(p => p ? { ...p, emoji: e.target.value } : null)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">강의명 *</label>
                    <input className="form-input" type="text" placeholder="강의명을 입력하세요" required
                      value={courseEditModal.title}
                      onChange={e => setCourseEditModal(p => p ? { ...p, title: e.target.value } : null)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">부제목</label>
                  <input className="form-input" type="text" placeholder="한 줄 설명"
                    value={courseEditModal.subtitle}
                    onChange={e => setCourseEditModal(p => p ? { ...p, subtitle: e.target.value } : null)} />
                </div>
                <div className="form-group">
                  <label className="form-label">강의 소개</label>
                  <textarea className="form-input" rows={3} placeholder="강의에 대한 상세 설명을 입력하세요."
                    value={courseEditModal.description}
                    onChange={e => setCourseEditModal(p => p ? { ...p, description: e.target.value } : null)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 1fr', gap: '0 12px' }}>
                  <div className="form-group">
                    <label className="form-label">레벨</label>
                    <select className="form-input"
                      value={courseEditModal.level}
                      onChange={e => setCourseEditModal(p => p ? { ...p, level: e.target.value } : null)}>
                      {['입문', '중급', '고급'].map(l => <option key={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">총 시간</label>
                    <input className="form-input" type="text" placeholder="예: 12시간"
                      value={courseEditModal.duration}
                      onChange={e => setCourseEditModal(p => p ? { ...p, duration: e.target.value } : null)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">강수</label>
                    <input className="form-input" type="number" min={0} placeholder="0"
                      value={courseEditModal.lessons || ''}
                      onChange={e => setCourseEditModal(p => p ? { ...p, lessons: Number(e.target.value) } : null)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">상태</label>
                    <select className="form-input"
                      value={courseEditModal.status}
                      onChange={e => setCourseEditModal(p => p ? { ...p, status: e.target.value as 'public' | 'private' } : null)}>
                      <option value="public">공개</option>
                      <option value="private">비공개</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">뱃지 <span style={{ color: 'var(--t3)', fontWeight: 400 }}>(예: 베스트셀러, 인기, 자격증)</span></label>
                  <input className="form-input" type="text" placeholder="빈칸이면 뱃지 없음"
                    value={courseEditModal.badge}
                    onChange={e => setCourseEditModal(p => p ? { ...p, badge: e.target.value } : null)} />
                </div>

                {/* ② 강사 정보 */}
                <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--t3)', letterSpacing: '.08em', textTransform: 'uppercase', margin: '20px 0 12px', paddingBottom: '6px', borderBottom: '1px solid var(--line)' }}>강사 정보</div>
                <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: '0 12px' }}>
                  <div className="form-group">
                    <label className="form-label">아바타</label>
                    <input className="form-input" type="text" placeholder="🎓"
                      value={courseEditModal.instructorAvatar}
                      onChange={e => setCourseEditModal(p => p ? { ...p, instructorAvatar: e.target.value } : null)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">강사명</label>
                    <input className="form-input" type="text" placeholder="강사 이름"
                      value={courseEditModal.instructor}
                      onChange={e => setCourseEditModal(p => p ? { ...p, instructor: e.target.value } : null)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">강사 소개</label>
                  <textarea className="form-input" rows={2} placeholder="강사 경력 및 소개"
                    value={courseEditModal.instructorBio}
                    onChange={e => setCourseEditModal(p => p ? { ...p, instructorBio: e.target.value } : null)} />
                </div>

                {/* ③ 가격 & 수강 기간 */}
                <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--t3)', letterSpacing: '.08em', textTransform: 'uppercase', margin: '20px 0 12px', paddingBottom: '6px', borderBottom: '1px solid var(--line)' }}>가격 & 수강 기간</div>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gap: '6px 10px', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ fontSize: '.72rem', color: 'var(--t3)', fontWeight: 700 }}>기간</div>
                  <div style={{ fontSize: '.72rem', color: 'var(--t3)', fontWeight: 700 }}>판매가 (원)</div>
                  <div style={{ fontSize: '.72rem', color: 'var(--t3)', fontWeight: 700 }}>정가 (원)</div>
                  {courseEditModal.tiers.map((tier, i) => (
                    <React.Fragment key={i}>
                      <select className="form-input" value={tier.days}
                        onChange={e => {
                          const tiers = courseEditModal.tiers.map((t, j) => j === i ? { ...t, days: Number(e.target.value) } : t)
                          setCourseEditModal(p => p ? { ...p, tiers } : null)
                        }}>
                        <option value={30}>30일</option>
                        <option value={60}>60일</option>
                        <option value={90}>90일</option>
                        <option value={180}>180일</option>
                        <option value={365}>365일</option>
                        <option value={9999}>무제한</option>
                      </select>
                      <input className="form-input" type="number" min={0} placeholder="판매가"
                        value={tier.price || ''}
                        onChange={e => {
                          const tiers = courseEditModal.tiers.map((t, j) => j === i ? { ...t, price: Number(e.target.value) } : t)
                          setCourseEditModal(p => p ? { ...p, tiers } : null)
                        }} />
                      <input className="form-input" type="number" min={0} placeholder="정가"
                        value={tier.originalPrice || ''}
                        onChange={e => {
                          const tiers = courseEditModal.tiers.map((t, j) => j === i ? { ...t, originalPrice: Number(e.target.value) } : t)
                          setCourseEditModal(p => p ? { ...p, tiers } : null)
                        }} />
                    </React.Fragment>
                  ))}
                </div>
                <div style={{ fontSize: '.72rem', color: 'var(--t3)', marginBottom: '4px' }}>첫 번째 기간이 기본 가격(목록 표시가)으로 사용됩니다. 가격 0은 제외됩니다.</div>

                {/* ④ 학습 목표 */}
                <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--t3)', letterSpacing: '.08em', textTransform: 'uppercase', margin: '20px 0 12px', paddingBottom: '6px', borderBottom: '1px solid var(--line)' }}>학습 목표 (이수 후 얻는 것)</div>
                <div className="form-group">
                  <textarea className="form-input" rows={5}
                    placeholder={'한 줄에 하나씩 입력하세요.\n예:\n메이저 아르카나 22장 완벽 해석\n마이너 아르카나 4수트 심층 이해'}
                    value={courseEditModal.whatYouLearnText}
                    onChange={e => setCourseEditModal(p => p ? { ...p, whatYouLearnText: e.target.value } : null)} />
                  <div style={{ fontSize: '.72rem', color: 'var(--t3)', marginTop: '4px' }}>강의 상세 페이지 "이런 것을 배워요" 섹션에 표시됩니다.</div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button type="button" className="btn btn-ghost w-full" onClick={() => setCourseEditModal(null)}>취소</button>
                  <button type="submit" className="btn btn-primary w-full">
                    {courseEditModal._isNew ? '강의 등록하기' : '저장하기'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── 강의 수강생 상세 모달 ── */}
      {courseDetailModal && (() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const enrolled = users.filter(u => (u.enrollments || []).some((e: any) => e.courseId === courseDetailModal.id))
        return (
          <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setCourseDetailModal(null) }}>
            <div className="modal-box" style={{ position: 'relative', maxWidth: '500px' }}>
              <button className="modal-close" onClick={() => setCourseDetailModal(null)}>✕</button>
              <div className="modal-head">
                <h2>{courseDetailModal.emoji} {courseDetailModal.title}</h2>
                <p>수강생 {enrolled.length}명</p>
              </div>
              <div className="modal-body">
                {enrolled.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--t3)', padding: '20px' }}>수강생이 없습니다.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {enrolled.map(u => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const e = (u.enrollments || []).find((x: any) => x.courseId === courseDetailModal.id)!
                      const expired = !e.paused && new Date(e.expiryDate) <= new Date()
                      return (
                        <div key={u.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,.03)', borderRadius: 'var(--r2)', border: '1px solid var(--line)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--purple),var(--purple-sat))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.7rem', fontWeight: 700 }}>{u.avatar}</div>
                            <div>
                              <div style={{ fontSize: '.875rem', fontWeight: 600 }}>{u.name}</div>
                              <div style={{ fontSize: '.75rem', color: 'var(--t3)' }}>{e.progress || 0}% 진도</div>
                            </div>
                          </div>
                          <span style={{ fontSize: '.68rem', padding: '2px 7px', borderRadius: 'var(--pill)', background: expired ? 'rgba(224,82,82,.1)' : 'rgba(52,196,124,.1)', color: expired ? 'var(--fail)' : 'var(--ok)' }}>
                            {expired ? '만료' : e.paused ? '휴강' : '수강중'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── 문의 답변 모달 ── */}
      {answerModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setAnswerModal(null) }}>
          <div className="modal-box" style={{ position: 'relative', maxWidth: '500px' }}>
            <button className="modal-close" onClick={() => setAnswerModal(null)}>✕</button>
            <div className="modal-head">
              <h2>문의 답변</h2>
              <p style={{ fontSize: '.82rem', color: 'var(--t2)', marginTop: '4px' }}>{answerModal.inq.subject}</p>
            </div>
            <div className="modal-body">
              <div style={{ padding: '12px', background: 'rgba(255,255,255,.03)', borderRadius: 'var(--r2)', marginBottom: '16px', fontSize: '.83rem', color: 'var(--t2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {answerModal.inq.message}
              </div>
              <form onSubmit={handleAnswer}>
                <div className="form-group">
                  <label className="form-label">답변 내용</label>
                  <textarea className="form-input" rows={6} required
                    placeholder="답변 내용을 입력해주세요."
                    value={answerModal.text}
                    onChange={e => setAnswerModal(p => p ? { ...p, text: e.target.value } : null)} />
                </div>
                <button type="submit" className="btn btn-primary w-full">답변 등록</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── 수동 수강 등록 모달 ── */}
      {enrollModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEnrollModal(null) }}>
          <div className="modal-box" style={{ position: 'relative' }}>
            <button className="modal-close" onClick={() => setEnrollModal(null)}>✕</button>
            <div className="modal-head">
              <h2>수강 수동 등록</h2>
              <p>{enrollModal.user.name} ({enrollModal.user.email})</p>
            </div>
            <div className="modal-body">
              <form onSubmit={handleEnroll}>
                <div className="form-group">
                  <label className="form-label">강의 선택</label>
                  <select className="form-input"
                    value={enrollModal.courseId}
                    onChange={e => setEnrollModal(p => p ? { ...p, courseId: e.target.value } : null)}>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.title}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">수강 기간</label>
                  <select className="form-input"
                    value={enrollModal.days}
                    onChange={e => setEnrollModal(p => p ? { ...p, days: Number(e.target.value) } : null)}>
                    <option value={30}>30일</option>
                    <option value={90}>90일</option>
                    <option value={180}>180일</option>
                    <option value={365}>365일</option>
                    <option value={9999}>무제한</option>
                  </select>
                  <div style={{ fontSize: '.75rem', color: 'var(--t3)', marginTop: '4px' }}>
                    {enrollModal.days >= 9999 ? '무제한' : `${enrollModal.days}일`} 수강 가능
                  </div>
                </div>
                <button type="submit" className="btn btn-primary w-full">등록하기</button>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* ── 강사 편집 모달 ── */}
      {instModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setInstModal(null) }}>
          <div className="modal-box" style={{ position: 'relative', maxWidth: '560px', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <button className="modal-close" onClick={() => setInstModal(null)}>✕</button>
            <div className="modal-head" style={{ flexShrink: 0 }}>
              <h2>{instModal.name ? '강사 편집' : '새 강사 등록'}</h2>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
              <form onSubmit={handleSaveInstructor}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                  <div className="form-group">
                    <label className="form-label">이름 *</label>
                    <input className="form-input" required value={instModal.name}
                      onChange={e => setInstModal(p => p ? { ...p, name: e.target.value } : null)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">직함</label>
                    <input className="form-input" placeholder="전문 타로 리더" value={instModal.title}
                      onChange={e => setInstModal(p => p ? { ...p, title: e.target.value } : null)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">프로필 사진</label>
                  {instModal.photo && (
                    <div style={{ marginBottom: '8px', width: '80px', height: '80px', borderRadius: 'var(--r2)', overflow: 'hidden', border: '1px solid var(--line)' }}>
                      <img src={instModal.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <input type="file" accept="image/*" style={{ fontSize: '.82rem', color: 'var(--t2)' }}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const canvas = document.createElement('canvas')
                      const img = new Image()
                      img.onload = () => {
                        const size = 1500
                        const min = Math.min(img.width, img.height)
                        const sx = (img.width - min) / 2
                        const sy = (img.height - min) / 2
                        canvas.width = size; canvas.height = size
                        canvas.getContext('2d')!.drawImage(img, sx, sy, min, min, 0, 0, size, size)
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.95)
                        setInstModal(p => p ? { ...p, photo: dataUrl } : null)
                      }
                      img.src = URL.createObjectURL(file)
                    }} />
                </div>
                <div className="form-group">
                  <label className="form-label">경력</label>
                  <input className="form-input" placeholder="10년+ 경력" value={instModal.experience}
                    onChange={e => setInstModal(p => p ? { ...p, experience: e.target.value } : null)} />
                </div>
                <div className="form-group">
                  <label className="form-label">소개</label>
                  <textarea className="form-input" rows={4} value={instModal.bio}
                    onChange={e => setInstModal(p => p ? { ...p, bio: e.target.value } : null)} />
                </div>
                <div className="form-group">
                  <label className="form-label">전문 분야 (쉼표 구분)</label>
                  <input className="form-input" placeholder="타로, 오라클, 수비학"
                    defaultValue={instModal.specialties.join(', ')}
                    onBlur={e => setInstModal(p => p ? { ...p, specialties: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } : null)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px' }}>
                  <div className="form-group">
                    <label className="form-label">Instagram</label>
                    <input className="form-input" placeholder="@username" value={instModal.instagram || ''}
                      onChange={e => setInstModal(p => p ? { ...p, instagram: e.target.value } : null)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">KakaoTalk 오픈채팅 링크</label>
                    <input className="form-input" placeholder="https://open.kakao.com/o/..." value={instModal.kakao || ''}
                      onChange={e => setInstModal(p => p ? { ...p, kakao: e.target.value } : null)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">전화번호</label>
                    <input className="form-input" type="tel" placeholder="010-0000-0000" value={instModal.phone || ''}
                      onChange={e => setInstModal(p => p ? { ...p, phone: e.target.value } : null)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">연결 강의 (복수 선택)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {courses.map(c => {
                      const sel = instModal.courseIds.includes(c.id)
                      return (
                        <button key={c.id} type="button"
                          style={{ fontSize: '.75rem', padding: '4px 10px', borderRadius: 'var(--pill)', cursor: 'pointer', background: sel ? 'rgba(124,111,205,.2)' : 'rgba(255,255,255,.04)', color: sel ? 'var(--purple-2)' : 'var(--t3)', border: `1px solid ${sel ? 'rgba(124,111,205,.3)' : 'var(--line)'}` }}
                          onClick={() => setInstModal(p => {
                            if (!p) return null
                            const ids = sel ? p.courseIds.filter(id => id !== c.id) : [...p.courseIds, c.id]
                            return { ...p, courseIds: ids }
                          })}
                        >{c.emoji} {c.title}</button>
                      )
                    })}
                  </div>
                </div>
                <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--t3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--line)', marginTop: '8px' }}>상담 설정</div>
                <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.85rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={instModal.consultOnline || false}
                      onChange={e => setInstModal(p => p ? { ...p, consultOnline: e.target.checked } : null)} />
                    온라인 상담
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.85rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={instModal.consultOffline || false}
                      onChange={e => setInstModal(p => p ? { ...p, consultOffline: e.target.checked } : null)} />
                    오프라인 상담
                  </label>
                </div>
                {instModal.consultOffline && (
                  <div className="form-group">
                    <label className="form-label">오프라인 상담 주소</label>
                    <input className="form-input" placeholder="서울특별시 강남구 테헤란로 123" value={instModal.offlineAddress || ''}
                      onChange={e => setInstModal(p => p ? { ...p, offlineAddress: e.target.value } : null)} />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">상태</label>
                  <select className="form-input" value={instModal.status || 'public'}
                    onChange={e => setInstModal(p => p ? { ...p, status: e.target.value as 'public' | 'private' } : null)}>
                    <option value="public">공개</option>
                    <option value="private">비공개</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary w-full">저장하기</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── 강사 서비스 편집 모달 ── */}
      {instSvcModal && instSvcModal.service && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setInstSvcModal(null) }}>
          <div className="modal-box" style={{ position: 'relative', maxWidth: '460px' }}>
            <button className="modal-close" onClick={() => setInstSvcModal(null)}>✕</button>
            <div className="modal-head">
              <h2>서비스 {instSvcModal.service.title ? '편집' : '등록'}</h2>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSaveService}>
                <div className="form-group">
                  <label className="form-label">서비스명 *</label>
                  <input className="form-input" required value={instSvcModal.service.title}
                    onChange={e => setInstSvcModal(p => p && p.service ? { ...p, service: { ...p.service, title: e.target.value } } : null)} />
                </div>
                <div className="form-group">
                  <label className="form-label">유형</label>
                  <select className="form-input" value={instSvcModal.service.type}
                    onChange={e => setInstSvcModal(p => p && p.service ? { ...p, service: { ...p.service, type: e.target.value as InstructorService['type'] } } : null)}>
                    <option value="consultation">상담</option>
                    <option value="reading">리딩</option>
                    <option value="lesson">레슨</option>
                    <option value="other">기타</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">설명</label>
                  <textarea className="form-input" rows={3} value={instSvcModal.service.description}
                    onChange={e => setInstSvcModal(p => p && p.service ? { ...p, service: { ...p.service, description: e.target.value } } : null)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                  <div className="form-group">
                    <label className="form-label">가격</label>
                    <input className="form-input" type="number" value={instSvcModal.service.price}
                      onChange={e => setInstSvcModal(p => p && p.service ? { ...p, service: { ...p.service, price: Number(e.target.value) } } : null)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">원래 가격</label>
                    <input className="form-input" type="number" value={instSvcModal.service.originalPrice}
                      onChange={e => setInstSvcModal(p => p && p.service ? { ...p, service: { ...p.service, originalPrice: Number(e.target.value) } } : null)} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                  <div className="form-group">
                    <label className="form-label">소요 시간</label>
                    <input className="form-input" placeholder="30분, 1시간 등" value={instSvcModal.service.duration}
                      onChange={e => setInstSvcModal(p => p && p.service ? { ...p, service: { ...p.service, duration: e.target.value } } : null)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">강의 방식</label>
                    <select className="form-input" value={instSvcModal.service.mode || ''}
                      onChange={e => setInstSvcModal(p => p && p.service ? { ...p, service: { ...p.service, mode: (e.target.value || undefined) as InstructorService['mode'] } } : null)}>
                      <option value="">미지정</option>
                      <option value="offline">대면 강의</option>
                      <option value="online">비대면 (Zoom)</option>
                      <option value="both">대면 &amp; 비대면(Zoom)</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary w-full">저장하기</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── 관리자 리뷰 작성 모달 ── */}
      {adminReviewModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setAdminReviewModal(false) }}>
          <div className="modal-box" style={{ position: 'relative', maxWidth: '460px' }}>
            <button className="modal-close" onClick={() => setAdminReviewModal(false)}>✕</button>
            <div className="modal-head">
              <h2>리뷰 수동 작성</h2>
              <p style={{ fontSize: '.82rem', color: 'var(--t3)' }}>관리자가 작성한 리뷰로 표시됩니다.</p>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAdminReview}>
                <div className="form-group">
                  <label className="form-label">강의 선택 *</label>
                  <select className="form-input" required value={arForm.courseId}
                    onChange={e => setArForm(p => ({ ...p, courseId: e.target.value }))}>
                    <option value="">강의를 선택하세요</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.title}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">작성자 이름 *</label>
                  <input className="form-input" type="text" placeholder="이름을 입력하세요" required
                    value={arForm.userName} onChange={e => setArForm(p => ({ ...p, userName: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">별점</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} type="button" onClick={() => setArForm(p => ({ ...p, rating: n }))}
                        style={{ fontSize: '1.5rem', cursor: 'pointer', filter: arForm.rating >= n ? 'none' : 'grayscale(1) opacity(.3)' }}>
                        ★
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">리뷰 내용 *</label>
                  <textarea className="form-input" rows={4} placeholder="리뷰 내용을 입력하세요" required
                    value={arForm.text} onChange={e => setArForm(p => ({ ...p, text: e.target.value }))} />
                </div>
                <button type="submit" className="btn btn-primary w-full">리뷰 등록</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── 강의별 수강생 등록 모달 ── */}
      {courseEnrollModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setCourseEnrollModal(null) }}>
          <div className="modal-box" style={{ position: 'relative' }}>
            <button className="modal-close" onClick={() => setCourseEnrollModal(null)}>✕</button>
            <div className="modal-head">
              <h2>수강생 등록</h2>
              <p style={{ fontSize: '.82rem', color: 'var(--t2)' }}>
                {courses.find(c => c.id === courseEnrollModal)?.emoji} {courses.find(c => c.id === courseEnrollModal)?.title}
              </p>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCourseEnroll}>
                <div className="form-group">
                  <label className="form-label">수강생 선택</label>
                  <select className="form-input" required value={ceUserId} onChange={e => setCeUserId(e.target.value)}>
                    <option value="">수강생을 선택하세요</option>
                    {users.map(u => <option key={u.uid} value={u.uid}>{u.name} ({u.email})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">수강 기간</label>
                  <select className="form-input" value={ceDays} onChange={e => setCeDays(Number(e.target.value))}>
                    <option value={30}>30일</option>
                    <option value={90}>90일</option>
                    <option value={180}>180일</option>
                    <option value={365}>365일</option>
                    <option value={9999}>무제한</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary w-full">등록하기</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── 수강 정보 수정 모달 ── */}
      {enrollEditModal && (() => {
        const em = enrollEditModal
        const enrollment = em.enrollment
        const daysLeft = enrollment.paused
          ? (enrollment.remainingDays || 0)
          : Math.max(0, Math.ceil((new Date(enrollment.expiryDate).getTime() - Date.now()) / 86400000))
        return (
          <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEnrollEditModal(null) }}>
            <div className="modal-box" style={{ position: 'relative', maxWidth: '480px' }}>
              <button className="modal-close" onClick={() => setEnrollEditModal(null)}>✕</button>
              <div className="modal-head">
                <h2>수강 정보 수정</h2>
                <p style={{ fontSize: '.82rem', color: 'var(--t2)' }}>
                  {em.user.name} — {em.course?.emoji} {em.course?.title || enrollment.courseId}
                </p>
              </div>
              <div className="modal-body">
                {/* 진도 현황 */}
                <div style={{ padding: '14px 16px', borderRadius: 'var(--r2)', background: 'rgba(255,255,255,.03)', border: '1px solid var(--line)', marginBottom: '16px' }}>
                  <div style={{ fontSize: '.78rem', fontWeight: 700, marginBottom: '8px' }}>수강 진도</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ flex: 1, height: '6px', borderRadius: '99px', background: 'rgba(255,255,255,.1)', overflow: 'hidden' }}>
                      <div style={{ width: `${enrollment.progress || 0}%`, height: '100%', background: 'var(--purple)', borderRadius: '99px' }} />
                    </div>
                    <span style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--t1)' }}>{enrollment.progress || 0}%</span>
                  </div>
                  <div style={{ fontSize: '.75rem', color: 'var(--t3)' }}>
                    잔여 {daysLeft}일 · 등록일 {new Date(enrollment.enrolledAt).toLocaleDateString()}
                  </div>
                </div>

                <form onSubmit={handleEnrollEdit}>
                  <div className="form-group">
                    <label className="form-label">수강 만료일</label>
                    <input className="form-input" type="date"
                      value={enrollment.expiryDate.split('T')[0]}
                      onChange={e => setEnrollEditModal(p => p ? {
                        ...p, enrollment: { ...p.enrollment, expiryDate: new Date(e.target.value).toISOString() }
                      } : null)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">휴강 상태</label>
                    <select className="form-input"
                      value={enrollment.paused ? '1' : '0'}
                      onChange={e => setEnrollEditModal(p => p ? {
                        ...p, enrollment: { ...p.enrollment, paused: e.target.value === '1' }
                      } : null)}>
                      <option value="0">수강중</option>
                      <option value="1">휴강중</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">휴강 사용 횟수</label>
                    <input className="form-input" type="number" min="0"
                      value={enrollment.pauseCount || 0}
                      onChange={e => setEnrollEditModal(p => p ? {
                        ...p, enrollment: { ...p.enrollment, pauseCount: Number(e.target.value) }
                      } : null)} />
                  </div>
                  {enrollment.paused && (
                    <div className="form-group">
                      <label className="form-label">잔여 일수</label>
                      <input className="form-input" type="number" min="0"
                        value={enrollment.remainingDays || 0}
                        onChange={e => setEnrollEditModal(p => p ? {
                          ...p, enrollment: { ...p.enrollment, remainingDays: Number(e.target.value) }
                        } : null)} />
                    </div>
                  )}
                  <button type="submit" className="btn btn-primary w-full">저장하기</button>
                </form>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── 커리큘럼 편집 모달 ── */}
      {curriculumModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setCurriculumModal(null) }}>
          <div className="modal-box" style={{ position: 'relative', maxWidth: '720px', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <button className="modal-close" onClick={() => setCurriculumModal(null)}>✕</button>
            <div className="modal-head" style={{ flexShrink: 0, textAlign: 'left', padding: '20px 24px 16px' }}>
              <h2 style={{ fontSize: '1.05rem' }}>커리큘럼 편집</h2>
              <p style={{ fontSize: '.82rem', color: 'var(--t3)', margin: 0 }}>{curriculumModal.courseTitle}</p>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '0 24px 24px' }}>
              {curriculumModal.sections.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--t3)', fontSize: '.875rem' }}>
                  섹션이 없습니다. 아래 버튼으로 첫 섹션을 추가하세요.
                </div>
              )}

              {curriculumModal.sections.map((sec, si) => (
                <div key={sec._key} style={{ marginBottom: '16px', border: '1px solid var(--line)', borderRadius: 'var(--r3)', overflow: 'hidden' }}>
                  {/* 섹션 헤더 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(109,86,224,.08)', borderBottom: '1px solid var(--line)' }}>
                    <span style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--purple-2)', flexShrink: 0 }}>섹션 {si + 1}</span>
                    <input
                      className="form-input"
                      style={{ flex: 1, padding: '5px 10px', fontSize: '.875rem' }}
                      placeholder="섹션 이름"
                      value={sec.section}
                      onChange={e => currUpdateSection(sec._key, e.target.value)}
                    />
                    <button
                      style={{ fontSize: '.72rem', padding: '4px 10px', borderRadius: 'var(--r1)', background: 'rgba(224,82,82,.1)', color: 'var(--fail)', cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => currDeleteSection(sec._key)}
                    >
                      섹션 삭제
                    </button>
                  </div>

                  {/* 강의 목록 */}
                  <div style={{ padding: '8px 14px' }}>
                    {sec.items.length === 0 && (
                      <div style={{ fontSize: '.78rem', color: 'var(--t3)', padding: '8px 0' }}>강의가 없습니다.</div>
                    )}
                    {sec.items.map((item, ii) => (
                      <div key={item.id} style={{ padding: '8px 0', borderBottom: ii < sec.items.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 80px 28px', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '.72rem', color: 'var(--t3)', textAlign: 'center' }}>{ii + 1}</span>
                          <input className="form-input" style={{ padding: '5px 8px', fontSize: '.82rem' }}
                            placeholder="강의 제목" value={item.title}
                            onChange={e => currUpdateLesson(sec._key, item.id, 'title', e.target.value)} />
                          <select className="form-input" style={{ padding: '5px 8px', fontSize: '.82rem' }}
                            value={item.status}
                            onChange={e => currUpdateLesson(sec._key, item.id, 'status', e.target.value)}>
                            <option value="free">무료</option>
                            <option value="locked">잠금</option>
                          </select>
                          <button
                            style={{ width: '28px', height: '28px', borderRadius: 'var(--r1)', background: 'rgba(224,82,82,.1)', color: 'var(--fail)', cursor: 'pointer', fontSize: '.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => currDeleteLesson(sec._key, item.id)}
                          >✕</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 80px auto', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                          <span />
                          <input className="form-input" style={{ padding: '5px 8px', fontSize: '.78rem' }}
                            placeholder="Vimeo ID" value={item.vimeo}
                            onChange={e => currUpdateLesson(sec._key, item.id, 'vimeo', e.target.value)}
                            onBlur={() => { if (item.vimeo && !item.duration) currFetchVimeoDuration(sec._key, item.id, item.vimeo) }} />
                          <input className="form-input" style={{ padding: '5px 8px', fontSize: '.78rem' }}
                            placeholder="00:00" value={item.duration}
                            onChange={e => currUpdateLesson(sec._key, item.id, 'duration', e.target.value)} />
                          <button style={{ fontSize: '.68rem', padding: '4px 8px', borderRadius: 'var(--r1)', background: 'rgba(124,111,205,.1)', color: 'var(--purple-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            onClick={() => currFetchVimeoDuration(sec._key, item.id, item.vimeo)}>
                            시간 가져오기
                          </button>
                        </div>
                        {/* 첨부파일 */}
                        <div style={{ marginTop: '4px', paddingLeft: '30px' }}>
                          {(item.attachments || []).map((att, ai) => (
                            <div key={ai} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '.72rem', padding: '2px 8px', borderRadius: 'var(--pill)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--line)', marginRight: '4px', marginBottom: '4px' }}>
                              <span style={{ color: 'var(--t2)' }}>{att.name}.{att.ext}</span>
                              <button style={{ fontSize: '.65rem', color: 'var(--fail)', cursor: 'pointer' }}
                                onClick={() => currRemoveAttachment(sec._key, item.id, ai)}>✕</button>
                            </div>
                          ))}
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '.7rem', padding: '2px 8px', borderRadius: 'var(--pill)', background: 'rgba(124,111,205,.06)', color: 'var(--purple-2)', cursor: 'pointer', border: '1px dashed rgba(124,111,205,.2)' }}>
                            + 첨부파일
                            <input type="file" style={{ display: 'none' }}
                              onChange={e => { const f = e.target.files?.[0]; if (f) currAddAttachment(sec._key, item.id, f); e.target.value = '' }} />
                          </label>
                        </div>
                      </div>
                    ))}
                    <button
                      style={{ marginTop: '8px', fontSize: '.78rem', padding: '5px 12px', borderRadius: 'var(--r1)', background: 'rgba(124,111,205,.1)', color: 'var(--purple-2)', cursor: 'pointer' }}
                      onClick={() => currAddLesson(sec._key)}
                    >
                      + 강의 추가
                    </button>
                  </div>
                </div>
              ))}

              <button
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--r2)', border: '1px dashed var(--line)', color: 'var(--t3)', fontSize: '.875rem', cursor: 'pointer', marginBottom: '16px' }}
                onClick={currAddSection}
              >
                + 섹션 추가
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-ghost w-full" onClick={() => setCurriculumModal(null)}>취소</button>
                <button className="btn btn-primary w-full" onClick={handleSaveCurriculum}>저장하기</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
