// ── 스토리지 레이어 ─────────────────────────────────────────
// - 강의 override/custom: localStorage 캐시 (동기) + Supabase 백그라운드
// - 문의/리뷰/유저: Supabase (비동기)

import type { Inquiry, Course, Instructor, InstructorProgressPage, ProgressChecklistItem } from '../data/types'
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
    thread: Array.isArray(r.thread) ? r.thread : [],
    resolvedAt: r.resolved_at ?? undefined,
    refundedAt: r.refunded_at ?? undefined,
    date: r.created_at,
    metadata: (r.course_id || r.order_date)
      ? { courseId: r.course_id ?? undefined, orderDate: r.order_date ?? undefined }
      : undefined,
  }
}

// 알림톡 발송용 — 회원의 휴대폰 번호 조회 (관리자가 고객에게 발송할 때)
export async function getProfilePhone(userId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('phone').eq('id', userId).single()
  return (data?.phone ?? '') as string
}

// 알림톡 발송용 — 회원의 이름 + 휴대폰 번호 조회
export async function getProfileContact(userId: string): Promise<{ name: string; phone: string }> {
  const { data } = await supabase.from('profiles').select('name, phone').eq('id', userId).single()
  return { name: (data?.name ?? '') as string, phone: (data?.phone ?? '') as string }
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

// 1:1 문의 대댓글 추가 — 사용자/관리자가 스레드에 메시지를 덧붙인다.
// 사용자가 달면 status='pending'(관리자 대기), 관리자가 달면 'answered'.
// 완료(resolved_at) 처리된 문의에는 댓글을 달 수 없다.
export async function addInquiryReply(id: string, sender: 'user' | 'admin', body: string): Promise<{ ok: boolean; error?: string }> {
  const text = body.trim()
  if (!text) return { ok: false, error: '내용을 입력해주세요.' }
  const { data: cur, error: readErr } = await supabase
    .from('inquiries').select('thread, answer, resolved_at').eq('id', id).single()
  if (readErr || !cur) return { ok: false, error: '문의를 찾을 수 없습니다.' }
  if (cur.resolved_at) return { ok: false, error: '이미 완료된 문의입니다.' }
  const thread = Array.isArray(cur.thread) ? cur.thread : []
  // 턴 규칙 — 사용자는 '관리자가 마지막으로 답변한 뒤'에만 댓글을 달 수 있다(연속 알림톡 방지).
  if (sender === 'user') {
    const lastSender = thread.length ? thread[thread.length - 1].sender : (cur.answer ? 'admin' : 'user')
    if (lastSender !== 'admin') return { ok: false, error: '관리자 답변 후에 댓글을 남길 수 있습니다.' }
  }
  thread.push({ sender, body: text, at: new Date().toISOString() })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: any = { thread, status: sender === 'user' ? 'pending' : 'answered' }
  if (sender === 'admin') patch.answered_at = new Date().toISOString()
  const { error } = await supabase.from('inquiries').update(patch).eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

// 댓글 수정 — at(타임스탬프)로 메시지를 식별. requester가 'user'면 본인('user') 댓글만, 'admin'이면 모든 댓글.
export async function editInquiryReply(id: string, at: string, body: string, requester: 'user' | 'admin'): Promise<{ ok: boolean; error?: string }> {
  const text = body.trim()
  if (!text) return { ok: false, error: '내용을 입력해주세요.' }
  const { data: cur, error: readErr } = await supabase.from('inquiries').select('thread, resolved_at').eq('id', id).single()
  if (readErr || !cur) return { ok: false, error: '문의를 찾을 수 없습니다.' }
  if (cur.resolved_at) return { ok: false, error: '완료된 문의는 수정할 수 없습니다.' }
  const thread = Array.isArray(cur.thread) ? cur.thread : []
  const idx = thread.findIndex((m: { at: string }) => m.at === at)
  if (idx < 0) return { ok: false, error: '댓글을 찾을 수 없습니다.' }
  if (requester === 'user' && thread[idx].sender !== 'user') return { ok: false, error: '본인 댓글만 수정할 수 있습니다.' }
  thread[idx] = { ...thread[idx], body: text, editedAt: new Date().toISOString() }
  const { error } = await supabase.from('inquiries').update({ thread }).eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

// 댓글 삭제 — at으로 식별. 권한 규칙은 수정과 동일.
export async function deleteInquiryReply(id: string, at: string, requester: 'user' | 'admin'): Promise<{ ok: boolean; error?: string }> {
  const { data: cur, error: readErr } = await supabase.from('inquiries').select('thread, resolved_at').eq('id', id).single()
  if (readErr || !cur) return { ok: false, error: '문의를 찾을 수 없습니다.' }
  if (cur.resolved_at) return { ok: false, error: '완료된 문의는 수정할 수 없습니다.' }
  const thread = Array.isArray(cur.thread) ? cur.thread : []
  const idx = thread.findIndex((m: { at: string }) => m.at === at)
  if (idx < 0) return { ok: false, error: '댓글을 찾을 수 없습니다.' }
  if (requester === 'user' && thread[idx].sender !== 'user') return { ok: false, error: '본인 댓글만 삭제할 수 있습니다.' }
  thread.splice(idx, 1)
  const { error } = await supabase.from('inquiries').update({ thread }).eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

// 관리자 — 문의를 '답변 완료'로 닫는다. (더 이상 댓글 불가, 미처리 카운트에서 제외)
export async function resolveInquiry(id: string): Promise<boolean> {
  const { error } = await supabase.from('inquiries')
    .update({ resolved_at: new Date().toISOString(), status: 'answered' })
    .eq('id', id)
  return !error
}

// 환불 처리 — 환불 요청(type='refund') 문의를 환불 완료로 마킹.
// refunded_at이 채워지면 해당 결제건(courseId+orderDate)이 마이페이지/강의실에서 환불 처리됨.
export async function markInquiryRefunded(id: string, answer: string): Promise<boolean> {
  const now = new Date().toISOString()
  const { error } = await supabase.from('inquiries')
    .update({ status: 'answered', answer, answered_at: now, refunded_at: now })
    .eq('id', id)
  return !error
}

// 문의 삭제 (관리자) — 중복 접수/오접수 정리용
export async function deleteInquiry(id: string): Promise<boolean> {
  const { error } = await supabase.from('inquiries').delete().eq('id', id)
  if (error) console.warn('[deleteInquiry] 삭제 실패:', error.message)
  return !error
}

// 회원 이메일(로그인 ID) 변경 (관리자) — 서버 Admin API 경유.
// 관리자 본인 세션 토큰을 함께 보내 서버에서 권한 검증.
export async function adminChangeUserEmail(userId: string, email: string): Promise<{ ok: boolean; error?: string }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { ok: false, error: '관리자 로그인이 필요합니다.' }
  try {
    const res = await fetch('/api/admin-change-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ userId, email }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.ok) return { ok: false, error: body.error || `요청 실패 (${res.status})` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '네트워크 오류' }
  }
}

// ════════════════════════════════════════════════════════════
// 접속 로그 (어드민 분석) — access_logs 테이블, 관리자만 SELECT (RLS)
// ════════════════════════════════════════════════════════════

export interface AccessLog {
  id: number
  createdAt: string
  userId: string | null
  userName: string | null
  userEmail: string | null
  event: string
  courseId: string | null
  courseTitle: string | null
  lessonId: string | null
  lessonTitle: string | null
  path: string | null
  ip: string | null
  country: string | null
  city: string | null
  device: string | null
  os: string | null
  browser: string | null
}

// 최근 접속 로그 조회 (기본 300건). 에러(테이블 미생성/권한)는 error로 구분 반환.
export async function getAccessLogs(limit = 300): Promise<{ logs: AccessLog[]; error: string | null }> {
  const { data, error } = await supabase
    .from('access_logs')
    .select('id, created_at, user_id, user_name, user_email, event, course_id, course_title, lesson_id, lesson_title, path, ip, country, city, device, os, browser')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.warn('access_logs 조회 실패(테이블/권한 확인):', error.message); return { logs: [], error: error.message } }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = (data ?? []).map((r: any) => ({
    id: r.id, createdAt: r.created_at,
    userId: r.user_id, userName: r.user_name, userEmail: r.user_email,
    event: r.event, courseId: r.course_id, courseTitle: r.course_title,
    lessonId: r.lesson_id, lessonTitle: r.lesson_title, path: r.path,
    ip: r.ip, country: r.country, city: r.city,
    device: r.device, os: r.os, browser: r.browser,
  }))
  return { logs, error: null }
}

// ════════════════════════════════════════════════════════════
// 관리자 — Supabase 비동기
// ════════════════════════════════════════════════════════════

export async function getAllUsers() {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, avatar, email, created_at, enrollments(course_id, enrolled_at, expiry_date, progress, type, paused, pause_count, remaining_days, attachment_downloads, completed_lessons, assigned_instructor_id)')
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
      completedLessons: (e.completed_lessons ?? []) as string[],
      type: (e.type ?? 'payment') as string,
      paused: (e.paused ?? false) as boolean,
      pauseCount: (e.pause_count ?? 0) as number,
      remainingDays: (e.remaining_days ?? 0) as number,
      attachmentDownloads: (e.attachment_downloads ?? []) as { lessonId: string; attachmentName: string; downloadedAt: string }[],
      assignedInstructorId: (e.assigned_instructor_id ?? null) as string | null,
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
    policyAgreedAt: (e.policy_agreed_at ?? null) as string | null,
    policyAgreedKeys: (e.policy_agreed_keys ?? null) as string[] | null,
    attachmentDownloads: (e.attachment_downloads ?? []) as { lessonId: string; attachmentName: string; downloadedAt: string }[],
    assignedInstructorId: (e.assigned_instructor_id ?? null) as string | null,
    user: {
      name: (e.profiles?.name ?? '') as string,
      avatar: (e.profiles?.avatar ?? '') as string,
      email: (e.profiles?.email ?? '') as string,
    },
  }))
}

// 자격증 중복 결제 지원: assignedInstructorId가 제공되면 해당 강사 조합만 삭제/수정
export async function cancelEnrollment(
  userId: string, courseId: string, assignedInstructorId?: string | null,
): Promise<boolean> {
  let query = supabase.from('enrollments').delete()
    .eq('user_id', userId).eq('course_id', courseId)
  if (assignedInstructorId) query = query.eq('assigned_instructor_id', assignedInstructorId)
  else if (assignedInstructorId === null) query = query.is('assigned_instructor_id', null)
  const { error } = await query
  return !error
}

export async function updateEnrollmentAdmin(
  userId: string, courseId: string,
  updates: { expiryDate?: string; paused?: boolean; pauseCount?: number; remainingDays?: number },
  assignedInstructorId?: string | null,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {}
  if (updates.expiryDate !== undefined) data.expiry_date = updates.expiryDate
  if (updates.paused !== undefined) data.paused = updates.paused
  if (updates.pauseCount !== undefined) data.pause_count = updates.pauseCount
  if (updates.remainingDays !== undefined) data.remaining_days = updates.remainingDays
  let query = supabase.from('enrollments').update(data)
    .eq('user_id', userId).eq('course_id', courseId)
  if (assignedInstructorId) query = query.eq('assigned_instructor_id', assignedInstructorId)
  else if (assignedInstructorId === null) query = query.is('assigned_instructor_id', null)
  const { error } = await query
  return !error
}

// ════════════════════════════════════════════════════════════
// 강사 — Supabase 비동기 (custom_courses와 동일 패턴)
// ════════════════════════════════════════════════════════════

// 강사 정렬 순서는 instructors 테이블의 특수 행(id='__order__')에 보관 — 전 사용자 동기화용.
export const INSTRUCTOR_ORDER_ID = '__order__'

export async function getInstructorsRemote(): Promise<Instructor[]> {
  const { data, error } = await supabase.from('instructors').select('id, data')
  if (error) { console.warn('fetch instructors failed:', error.message); return [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).filter((r: any) => r.id !== INSTRUCTOR_ORDER_ID).map((r: any) => r.data as Instructor)
}

// 강사 드래그앤드롭 순서를 Supabase에 저장 (course order와 동일 패턴)
export function saveInstructorOrderRemote(ids: string[]) {
  supabase.from('instructors').upsert(
    { id: INSTRUCTOR_ORDER_ID, data: { ids } as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
    { onConflict: 'id' },
  ).then(({ error }) => { if (error) console.warn('instructor order sync failed:', error.message) })
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

// ════════════════════════════════════════════════════════════
// 강사 진도 관리 페이지 (자격증 과정, 토큰 기반)
// ════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProgressPage(r: any): InstructorProgressPage {
  return {
    id: r.id,
    userId: r.user_id,
    courseId: r.course_id,
    instructorId: r.instructor_id,
    checklist: (r.checklist ?? []) as ProgressChecklistItem[],
    notes: (r.notes ?? '') as string,
    completedAt: r.completed_at ?? undefined,
    expiresAt: r.expires_at ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let t = ''
  for (let i = 0; i < 32; i++) t += chars[Math.floor(Math.random() * chars.length)]
  return t
}

export async function createProgressPage(params: {
  userId: string
  courseId: string
  instructorId: string
  checklist: ProgressChecklistItem[]
}): Promise<InstructorProgressPage | null> {
  const token = generateToken()
  const { data, error } = await supabase.from('instructor_progress_pages').insert({
    id: token,
    user_id: params.userId,
    course_id: params.courseId,
    instructor_id: params.instructorId,
    checklist: params.checklist,
    notes: '',
  }).select().single()
  if (error || !data) { console.warn('createProgressPage failed:', error?.message); return null }
  return rowToProgressPage(data)
}

export async function getProgressPage(id: string): Promise<InstructorProgressPage | null> {
  const { data, error } = await supabase.from('instructor_progress_pages')
    .select('*').eq('id', id).single()
  if (error || !data) return null
  return rowToProgressPage(data)
}

export async function getProgressPageByEnrollment(
  userId: string,
  courseId: string,
  instructorId?: string,
): Promise<InstructorProgressPage | null> {
  let query = supabase.from('instructor_progress_pages')
    .select('*')
    .eq('user_id', userId).eq('course_id', courseId)
  if (instructorId) query = query.eq('instructor_id', instructorId)
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return rowToProgressPage(data)
}

export async function updateProgressPage(id: string, updates: {
  checklist?: ProgressChecklistItem[]
  notes?: string
  completedAt?: string | null
  expiresAt?: string | null
}): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = { updated_at: new Date().toISOString() }
  if (updates.checklist !== undefined) row.checklist = updates.checklist
  if (updates.notes !== undefined) row.notes = updates.notes
  if (updates.completedAt !== undefined) row.completed_at = updates.completedAt
  if (updates.expiresAt !== undefined) row.expires_at = updates.expiresAt
  const { error } = await supabase.from('instructor_progress_pages').update(row).eq('id', id)
  return !error
}

// ════════════════════════════════════════════════════════════
// 자격증 수강 동의서 서명
// ════════════════════════════════════════════════════════════

export interface CertificateAgreementRecord {
  id: string
  userId: string
  courseId: string
  signerName: string
  signerBirthdate: string
  signerPhone: string
  signatureUrl: string
  agreementVersion: string
  signedAt: string
  assignedInstructorId?: string | null
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',')
  const mime = head.match(/data:(.*?);base64/)?.[1] || 'image/png'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export async function uploadSignatureImage(userId: string, courseId: string, dataUrl: string): Promise<string | null> {
  const blob = dataUrlToBlob(dataUrl)
  const path = `${userId}/${courseId}-${Date.now()}.png`
  const { error } = await supabase.storage.from('certificate-signatures').upload(path, blob, {
    contentType: 'image/png',
    upsert: false,
  })
  if (error) { console.warn('signature upload failed:', error.message); return null }
  const { data } = supabase.storage.from('certificate-signatures').getPublicUrl(path)
  return data.publicUrl
}

// 공용 이미지 업로드 (관리자) — 팝업/공지 등. public 버킷에 저장 후 public URL 반환.
export async function uploadPublicImage(file: File, prefix = 'misc'): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${prefix}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('certificate-signatures').upload(path, file, {
    contentType: file.type || 'image/png',
    upsert: true,
  })
  if (error) { console.warn('이미지 업로드 실패:', error.message); return null }
  const { data } = supabase.storage.from('certificate-signatures').getPublicUrl(path)
  return data.publicUrl
}

// 수료증 A4 템플릿 이미지 업로드 (관리자) → public URL 반환
export async function uploadCertificateTemplate(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `templates/certificate-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('certificate-signatures').upload(path, file, {
    contentType: file.type || 'image/png',
    upsert: true,
  })
  if (error) { console.warn('certificate template upload failed:', error.message); return null }
  const { data } = supabase.storage.from('certificate-signatures').getPublicUrl(path)
  return data.publicUrl
}

export async function saveCertificateAgreement(params: {
  userId: string
  courseId: string
  signerName: string
  signerBirthdate: string
  signerPhone: string
  signatureUrl: string
  agreementVersion: string
  agreementSnapshot: unknown
  assignedInstructorId?: string | null
}): Promise<boolean> {
  const { error } = await supabase.from('certificate_agreements').insert({
    user_id: params.userId,
    course_id: params.courseId,
    signer_name: params.signerName,
    signer_birthdate: params.signerBirthdate,
    signer_phone: params.signerPhone,
    signature_url: params.signatureUrl,
    agreement_version: params.agreementVersion,
    agreement_snapshot: params.agreementSnapshot,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    assigned_instructor_id: params.assignedInstructorId || null,
  })
  if (error) { console.warn('saveCertificateAgreement failed:', error.message); return false }
  return true
}

// 자격증 중복 결제 지원: instructorId 전달 시 해당 강사의 서명만 조회
// (미전달 시 기존 동작 — user_id+course_id 기준 최신 1건)
export async function getCertificateAgreementByEnrollment(
  userId: string,
  courseId: string,
  instructorId?: string,
): Promise<CertificateAgreementRecord | null> {
  let query = supabase.from('certificate_agreements')
    .select('id, user_id, course_id, signer_name, signer_birthdate, signer_phone, signature_url, agreement_version, signed_at, assigned_instructor_id')
    .eq('user_id', userId).eq('course_id', courseId)
  if (instructorId) query = query.eq('assigned_instructor_id', instructorId)
  const { data, error } = await query
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return {
    id: data.id,
    userId: data.user_id,
    courseId: data.course_id,
    signerName: data.signer_name,
    signerBirthdate: data.signer_birthdate,
    signerPhone: data.signer_phone,
    signatureUrl: data.signature_url,
    agreementVersion: data.agreement_version,
    signedAt: data.signed_at,
    assignedInstructorId: data.assigned_instructor_id ?? null,
  }
}
