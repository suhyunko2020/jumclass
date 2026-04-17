// ── 스토리지 레이어 ─────────────────────────────────────────
// - 강의 override/custom: localStorage 캐시 (동기) + Supabase 백그라운드
// - 문의/리뷰/유저: Supabase (비동기)

import type { Inquiry, Course, Instructor } from '../data/types'
import { supabase } from '../lib/supabase'

// ── localStorage 캐시 (강의 데이터용) ─────────────────────
const OVERRIDE_KEY = 'arcana_course_overrides'
const CUSTOM_KEY   = 'arcana_custom_courses'

function getJSON<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback }
  catch { return fallback }
}
function setJSON(key: string, v: unknown) { localStorage.setItem(key, JSON.stringify(v)) }

export const getCourseOverrides  = (): Record<string, Partial<Course>> => getJSON(OVERRIDE_KEY, {})
export const setCourseOverrides  = (o: Record<string, Partial<Course>>) => setJSON(OVERRIDE_KEY, o)
export const getCustomCourses    = (): Course[] => getJSON(CUSTOM_KEY, [])
export const setCustomCourses    = (c: Course[]) => setJSON(CUSTOM_KEY, c)

// ── Admin 세션 ────────────────────────────────────────────
export const setAdmin   = () => sessionStorage.setItem('arcana_admin', '1')
export const isAdmin    = () => sessionStorage.getItem('arcana_admin') === '1'
export const clearAdmin = () => sessionStorage.removeItem('arcana_admin')

// ════════════════════════════════════════════════════════════
// 문의 — Supabase 비동기
// ════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToInquiry(r: any): Inquiry {
  return {
    id: r.id, userId: r.user_id, userName: r.user_name, userEmail: r.user_email,
    type: r.type, subject: r.subject, message: r.message,
    status: r.status as 'pending' | 'answered',
    answer: r.answer ?? '',
    answeredAt: r.answered_at ?? undefined,
    date: r.created_at,
    metadata: (r.course_id || r.order_date)
      ? { courseId: r.course_id ?? undefined, orderDate: r.order_date ?? undefined }
      : undefined,
  }
}

export async function getMyInquiries(userId: string): Promise<Inquiry[]> {
  const { data } = await supabase
    .from('inquiries').select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data ?? []).map(rowToInquiry)
}

export async function getInquiries(): Promise<Inquiry[]> {
  const { data } = await supabase
    .from('inquiries').select('*')
    .order('created_at', { ascending: false })
  return (data ?? []).map(rowToInquiry)
}

export async function addInquiry(
  userId: string, userName: string, userEmail: string,
  subject: string, message: string, type = 'general',
  metadata?: { courseId?: string; orderDate?: string }
): Promise<Inquiry | null> {
  const { data, error } = await supabase.from('inquiries').insert({
    user_id: userId, user_name: userName, user_email: userEmail,
    subject, message, type,
    course_id: metadata?.courseId ?? null,
    order_date: metadata?.orderDate ?? null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }).select().single() as any
  if (error || !data) return null
  return rowToInquiry(data)
}

export async function editInquiry(id: string, subject: string, message: string): Promise<boolean> {
  const { error } = await supabase.from('inquiries')
    .update({ subject, message })
    .eq('id', id).eq('status', 'pending')
  return !error
}

export async function answerInquiry(id: string, answer: string): Promise<boolean> {
  const { error } = await supabase.from('inquiries')
    .update({ status: 'answered', answer, answered_at: new Date().toISOString() })
    .eq('id', id)
  return !error
}

// ════════════════════════════════════════════════════════════
// 관리자 — Supabase 비동기
// ════════════════════════════════════════════════════════════

export async function getAllUsers() {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, avatar, email, created_at, enrollments(course_id, enrolled_at, expiry_date, progress, type, paused, pause_count, remaining_days)')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((u: any) => ({
    uid: u.id as string,
    name: u.name as string,
    avatar: u.avatar as string,
    email: (u.email ?? '') as string,
    createdAt: (u.created_at ?? '') as string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    enrollments: (u.enrollments ?? []).map((e: any) => ({
      courseId: e.course_id as string,
      enrolledAt: e.enrolled_at as string,
      expiryDate: e.expiry_date as string,
      progress: (e.progress ?? 0) as number,
      type: (e.type ?? 'payment') as string,
      paused: (e.paused ?? false) as boolean,
      pauseCount: (e.pause_count ?? 0) as number,
      remainingDays: (e.remaining_days ?? 0) as number,
    })),
  }))
}

export async function getAllEnrollmentsAdmin() {
  const { data } = await supabase
    .from('enrollments')
    .select('*, profiles(name, avatar, email)')
    .order('enrolled_at', { ascending: false })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((e: any) => ({
    courseId: e.course_id as string,
    enrolledAt: e.enrolled_at as string,
    expiryDate: e.expiry_date as string,
    progress: (e.progress ?? 0) as number,
    completedLessons: (e.completed_lessons ?? []) as string[],
    type: (e.type ?? 'payment') as string,
    paused: (e.paused ?? false) as boolean,
    pauseCount: (e.pause_count ?? 0) as number,
    remainingDays: (e.remaining_days ?? 0) as number,
    userId: (e.user_id ?? '') as string,
    user: {
      name: (e.profiles?.name ?? '') as string,
      avatar: (e.profiles?.avatar ?? '') as string,
      email: (e.profiles?.email ?? '') as string,
    },
  }))
}

export async function cancelEnrollment(userId: string, courseId: string): Promise<boolean> {
  const { error } = await supabase.from('enrollments')
    .delete()
    .eq('user_id', userId).eq('course_id', courseId)
  return !error
}

export async function updateEnrollmentAdmin(
  userId: string, courseId: string,
  updates: { expiryDate?: string; paused?: boolean; pauseCount?: number; remainingDays?: number }
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {}
  if (updates.expiryDate !== undefined) data.expiry_date = updates.expiryDate
  if (updates.paused !== undefined) data.paused = updates.paused
  if (updates.pauseCount !== undefined) data.pause_count = updates.pauseCount
  if (updates.remainingDays !== undefined) data.remaining_days = updates.remainingDays
  const { error } = await supabase.from('enrollments')
    .update(data)
    .eq('user_id', userId).eq('course_id', courseId)
  return !error
}

// ════════════════════════════════════════════════════════════
// 강사 — Supabase 비동기 (custom_courses와 동일 패턴)
// ════════════════════════════════════════════════════════════

export async function getInstructorsRemote(): Promise<Instructor[]> {
  const { data, error } = await supabase.from('instructors').select('id, data')
  if (error) { console.warn('fetch instructors failed:', error.message); return [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => r.data as Instructor)
}

export function saveInstructorRemote(inst: Instructor) {
  supabase.from('instructors').upsert(
    { id: inst.id, data: inst as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  ).then(({ error }) => { if (error) console.warn('instructor sync failed:', error.message) })
}

export function deleteInstructorRemote(id: string) {
  supabase.from('instructors').delete().eq('id', id)
    .then(({ error }) => { if (error) console.warn('delete instructor failed:', error.message) })
}
