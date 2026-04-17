import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'
import type { Enrollment } from '../data/types'
import { useCourses } from './useCourses'

// ── 앱 내부에서 사용하는 User 타입 ──────────────────────────
export interface AppUser {
  uid: string
  name: string
  email: string
  avatar: string
  createdAt: string
  enrollments: Enrollment[]
}

interface AuthContextType {
  user: AppUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<string | null>
  signup: (name: string, email: string, password: string) => Promise<string | null>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  enroll: (courseId: string, days?: number, policyAgreedKeys?: string[], assignedInstructorId?: string) => Promise<boolean>
  isEnrolled: (courseId: string) => boolean
  isPaused: (courseId: string) => boolean
  getEnrollment: (courseId: string) => Enrollment | null
  completeLesson: (courseId: string, lessonId: string) => Promise<void>
  logAttachmentDownload: (courseId: string, lessonId: string, attachmentName: string) => Promise<void>
  pauseCourse: (courseId: string) => Promise<boolean>
  resumeCourse: (courseId: string) => Promise<boolean>
  enrollManual: (uid: string, courseId: string, days: number) => Promise<boolean>
  adminLogin: (id: string, pw: string) => boolean
  isAdminLoggedIn: boolean
  adminLogout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

// DB Row → Enrollment 변환
function rowToEnrollment(row: Record<string, unknown>): Enrollment {
  return {
    courseId: row.course_id as string,
    enrolledAt: row.enrolled_at as string,
    expiryDate: row.expiry_date as string,
    progress: (row.progress as number) ?? 0,
    completedLessons: (row.completed_lessons as string[]) ?? [],
    type: (row.type as Enrollment['type']) ?? 'payment',
    paused: (row.paused as boolean) ?? false,
    pausedAt: row.paused_at as string | undefined,
    remainingDays: row.remaining_days as number | undefined,
    pauseCount: (row.pause_count as number) ?? 0,
    policyAgreedAt: (row.policy_agreed_at as string | undefined) ?? undefined,
    policyAgreedKeys: (row.policy_agreed_keys as string[] | undefined) ?? undefined,
    attachmentDownloads: (row.attachment_downloads as Enrollment['attachmentDownloads']) ?? [],
    assignedInstructorId: (row.assigned_instructor_id as string | undefined) ?? undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(
    () => sessionStorage.getItem('arcana_admin') === '1'
  )
  const { getCourse, syncFromSupabase } = useCourses()

  // ── 세션 초기화 & 구독 ─────────────────────────────────────
  useEffect(() => {
    // 강의 데이터(overrides/custom/reviews) Supabase→localStorage 동기화
    syncFromSupabase()

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadUser(data.session)
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      if (sess) loadUser(sess)
      else { setUser(null); setLoading(false) }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // ── 사용자 정보 + 수강 내역 로드 ──────────────────────────
  async function loadUser(sess: Session) {
    setLoading(true)
    try {
      const uid = sess.user.id

      // 프로필 조회
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, avatar')
        .eq('id', uid)
        .single()

      // 수강 내역 조회
      const { data: rows } = await supabase
        .from('enrollments')
        .select('*')
        .eq('user_id', uid)

      const enrollments: Enrollment[] = (rows ?? []).map(r => rowToEnrollment(r as Record<string, unknown>))

      setUser({
        uid,
        name: profile?.name ?? sess.user.user_metadata?.name ?? '사용자',
        email: sess.user.email ?? '',
        avatar: profile?.avatar ?? (profile?.name?.[0] ?? '?').toUpperCase(),
        createdAt: sess.user.created_at,
        enrollments,
      })
    } finally {
      setLoading(false)
    }
  }

  const refreshUser = useCallback(async () => {
    if (session) await loadUser(session)
  }, [session])

  // ── 로그인 ────────────────────────────────────────────────
  // null = 성공, string = 에러 메시지
  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return null
    if (error.message.includes('Email not confirmed'))
      return '이메일 인증이 필요합니다. 받은편지함을 확인해주세요.'
    if (error.message.includes('Invalid login credentials'))
      return '이메일 또는 비밀번호가 올바르지 않습니다.'
    return error.message
  }, [])

  // ── 회원가입 ──────────────────────────────────────────────
  // null = 성공(인증메일 발송), string = 에러 메시지
  const signup = useCallback(async (name: string, email: string, password: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, avatar: name[0].toUpperCase() },
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) return error.message
    if (!data.user) return '가입에 실패했습니다. 다시 시도해주세요.'

    // 프로필 저장
    await supabase.from('profiles').upsert({
      id: data.user.id,
      name,
      email,
      avatar: name[0].toUpperCase(),
    })
    return null
  }, [])

  // ── Google 로그인 ─────────────────────────────────────────
  const loginWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }, [])

  // ── 로그아웃 ──────────────────────────────────────────────
  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  // ── 수강 등록 ─────────────────────────────────────────────
  const enroll = useCallback(async (courseId: string, days = 365, policyAgreedKeys?: string[], assignedInstructorId?: string) => {
    if (!user) return false
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + days)

    const { error } = await supabase.from('enrollments').upsert({
      user_id: user.uid,
      course_id: courseId,
      expiry_date: expiry.toISOString(),
      progress: 0,
      completed_lessons: [],
      type: 'payment',
      paused: false,
      pause_count: 0,
      policy_agreed_at: policyAgreedKeys && policyAgreedKeys.length > 0 ? new Date().toISOString() : null,
      policy_agreed_keys: policyAgreedKeys && policyAgreedKeys.length > 0 ? policyAgreedKeys : null,
      assigned_instructor_id: assignedInstructorId || null,
    }, { onConflict: 'user_id,course_id' })

    if (error) return false
    await refreshUser()
    return true
  }, [user, refreshUser])

  const isEnrolled = useCallback((courseId: string) => {
    if (!user?.enrollments) return false
    const e = user.enrollments.find(x => x.courseId === courseId)
    if (!e) return false
    if (e.paused) return true
    return new Date(e.expiryDate) > new Date()
  }, [user])

  const isPaused = useCallback((courseId: string) => {
    return !!user?.enrollments.find(e => e.courseId === courseId)?.paused
  }, [user])

  const getEnrollment = useCallback((courseId: string) => {
    return user?.enrollments.find(e => e.courseId === courseId) ?? null
  }, [user])

  // ── 강의 완료 처리 ────────────────────────────────────────
  const completeLesson = useCallback(async (courseId: string, lessonId: string) => {
    if (!user) return
    const enrollment = user.enrollments.find(e => e.courseId === courseId)
    if (!enrollment) return

    const completed = [...(enrollment.completedLessons ?? [])]
    if (!completed.includes(lessonId)) completed.push(lessonId)

    const course = getCourse(courseId)
    const total = course?.curriculum.reduce((s, sec) => s + sec.items.length, 0) ?? 1
    const progress = Math.round((completed.length / total) * 100)

    await supabase.from('enrollments')
      .update({ completed_lessons: completed, progress })
      .eq('user_id', user.uid)
      .eq('course_id', courseId)

    await refreshUser()
  }, [user, getCourse, refreshUser])

  // ── 첨부파일(교재) 다운로드 로그 + 자동 강의 완료 처리 ──────
  // 교재만 받고 환불받는 손실을 막기 위해 다운로드 즉시 해당 강의를 수강 완료로 간주
  const logAttachmentDownload = useCallback(async (
    courseId: string, lessonId: string, attachmentName: string
  ) => {
    if (!user) return
    const enrollment = user.enrollments.find(e => e.courseId === courseId)
    if (!enrollment) return

    const downloads = [...(enrollment.attachmentDownloads ?? [])]
    downloads.push({ lessonId, attachmentName, downloadedAt: new Date().toISOString() })

    const completed = [...(enrollment.completedLessons ?? [])]
    if (!completed.includes(lessonId)) completed.push(lessonId)

    const course = getCourse(courseId)
    const total = course?.curriculum.reduce((s, sec) => s + sec.items.length, 0) ?? 1
    const progress = Math.round((completed.length / total) * 100)

    await supabase.from('enrollments')
      .update({
        attachment_downloads: downloads,
        completed_lessons: completed,
        progress,
      })
      .eq('user_id', user.uid)
      .eq('course_id', courseId)

    await refreshUser()
  }, [user, getCourse, refreshUser])

  // ── 휴강 ──────────────────────────────────────────────────
  const pauseCourse = useCallback(async (courseId: string) => {
    if (!user) return false
    const e = user.enrollments.find(x => x.courseId === courseId)
    if (!e) return false
    const course = getCourse(courseId)
    const maxPauses = course?.pauseConfig?.maxPauses ?? 0
    if ((e.pauseCount ?? 0) >= maxPauses) return false

    const remaining = Math.max(0, Math.ceil(
      (new Date(e.expiryDate).getTime() - Date.now()) / 86400000
    ))
    await supabase.from('enrollments')
      .update({
        paused: true,
        paused_at: new Date().toISOString(),
        remaining_days: remaining,
        pause_count: (e.pauseCount ?? 0) + 1,
      })
      .eq('user_id', user.uid).eq('course_id', courseId)

    await refreshUser()
    return true
  }, [user, getCourse, refreshUser])

  // ── 재개 ──────────────────────────────────────────────────
  const resumeCourse = useCallback(async (courseId: string) => {
    if (!user) return false
    const e = user.enrollments.find(x => x.courseId === courseId)
    if (!e?.paused) return false

    const newExpiry = new Date()
    newExpiry.setDate(newExpiry.getDate() + (e.remainingDays ?? 30))

    await supabase.from('enrollments')
      .update({
        paused: false,
        paused_at: null,
        remaining_days: null,
        expiry_date: newExpiry.toISOString(),
      })
      .eq('user_id', user.uid).eq('course_id', courseId)

    await refreshUser()
    return true
  }, [user, refreshUser])

  // ── 수동 등록 (관리자) ────────────────────────────────────
  const enrollManual = useCallback(async (uid: string, courseId: string, days: number) => {
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + days)

    const { error } = await supabase.from('enrollments').upsert({
      user_id: uid,
      course_id: courseId,
      expiry_date: expiry.toISOString(),
      progress: 0,
      completed_lessons: [],
      type: 'manual',
      paused: false,
      pause_count: 0,
    }, { onConflict: 'user_id,course_id' })

    if (error) return false
    if (user?.uid === uid) await refreshUser()
    return true
  }, [user, refreshUser])

  // ── 관리자 로그인 (세션스토리지 기반 유지) ─────────────────
  const adminLogin = useCallback((id: string, pw: string) => {
    if (id === 'admin' && pw === 'admin123!') {
      sessionStorage.setItem('arcana_admin', '1')
      setIsAdminLoggedIn(true)
      return true
    }
    return false
  }, [])

  const adminLogout = useCallback(() => {
    sessionStorage.removeItem('arcana_admin')
    setIsAdminLoggedIn(false)
  }, [])

  return (
    <AuthContext.Provider value={{
      user, loading,
      login, signup, loginWithGoogle, logout,
      enroll, isEnrolled, isPaused, getEnrollment,
      completeLesson, logAttachmentDownload, pauseCourse, resumeCourse, enrollManual,
      adminLogin, isAdminLoggedIn, adminLogout, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
