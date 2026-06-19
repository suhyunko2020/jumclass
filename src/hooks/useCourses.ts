import { useCallback, useEffect, useState } from 'react'
import { COURSES } from '../data/courses'
import type { Course, Review } from '../data/types'
import { supabase } from '../lib/supabase'
import { INSTRUCTOR_ORDER_ID } from '../utils/storage'

// 캐시(강의/리뷰) 갱신 알림 — 동기화/작성 후 캐시 기반 컴포넌트를 재렌더시킨다.
// (localStorage 캐시는 동기 읽기라 React가 변경을 감지 못 하므로 이벤트로 트리거)
const DATA_SYNC_EVENT = 'jum:data-synced'
export function notifyDataSynced() {
  try { window.dispatchEvent(new Event(DATA_SYNC_EVENT)) } catch { /* SSR/비브라우저 무시 */ }
}
// 이 훅을 쓰는 컴포넌트는 데이터 동기화/작성 시 자동으로 다시 렌더된다.
export function useDataSyncTick(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const h = () => setTick(t => t + 1)
    window.addEventListener(DATA_SYNC_EVENT, h)
    return () => window.removeEventListener(DATA_SYNC_EVENT, h)
  }, [])
  return tick
}

// ── localStorage 캐시 키 ──────────────────────────────────
const OVERRIDE_KEY = 'arcana_course_overrides'
const CUSTOM_KEY   = 'arcana_custom_courses'
const REVIEWS_KEY  = 'arcana_reviews'
const ATTACH_KEY   = 'arcana_lesson_attachments'
const ORDER_KEY    = 'arcana_course_order'
// 강의 순서를 course_overrides 테이블의 특수 행으로 저장 → 모든 사용자/기기에 동기화
const COURSE_ORDER_ID = '__course_order__'

function getJSON<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback }
  catch { return fallback }
}

function getCachedOverrides(): Record<string, Partial<Course>> {
  return getJSON(OVERRIDE_KEY, {})
}
function getCachedCustomCourses(): Course[] {
  return getJSON(CUSTOM_KEY, [])
}
function getCachedReviews(): Review[] {
  return getJSON(REVIEWS_KEY, [])
}

// url: 레거시 public URL (하위호환), path: Supabase Storage 경로 (신규, signed URL용)
// 다운로드 시점에 `path`가 있으면 signed URL 생성, 없으면 `url` 사용
export interface LessonAtt { name: string; ext: string; url?: string; path?: string }

const ATTACHMENT_BUCKET = 'lesson-attachments'
const SIGNED_URL_EXPIRES = 300  // 5분 유효 signed URL

function getAttachmentMeta(): Record<string, LessonAtt[]> {
  try { const v = localStorage.getItem(ATTACH_KEY); return v ? JSON.parse(v) : {} } catch { return {} }
}

function saveAttachmentMeta(store: Record<string, LessonAtt[]>) {
  try { localStorage.setItem(ATTACH_KEY, JSON.stringify(store)) } catch { /* meta only, small */ }
}

export async function uploadLessonAttachment(lessonId: string, file: File): Promise<LessonAtt | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  const safeLessonId = lessonId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const fileName = `${safeLessonId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) {
    console.warn('첨부파일 업로드 실패:', error.message)
    return null
  }

  // path만 저장. 다운로드 시점에 signed URL 생성 (private 버킷 대비)
  const att: LessonAtt = { name: file.name.replace(/\.[^.]+$/, ''), ext, path: fileName }

  const store = getAttachmentMeta()
  if (!store[lessonId]) store[lessonId] = []
  store[lessonId].push(att)
  saveAttachmentMeta(store)

  return att
}

// 다운로드용 URL 반환 — path 기반이면 signed URL 생성, 레거시 url이면 그대로
export async function getAttachmentDownloadUrl(att: LessonAtt): Promise<string | null> {
  if (att.path) {
    const { data, error } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(att.path, SIGNED_URL_EXPIRES)
    if (error || !data) {
      console.warn('signed URL 생성 실패:', error?.message)
      return att.url ?? null
    }
    return data.signedUrl
  }
  return att.url ?? null
}

export function saveAllLessonAttachments(items: { id: string; attachments?: LessonAtt[] }[]) {
  const store = getAttachmentMeta()
  for (const item of items) {
    if (item.attachments && item.attachments.length > 0) {
      store[item.id] = item.attachments
    } else {
      // 첨부를 모두 삭제한 항목은 캐시에서도 제거 — 안 그러면 옛 첨부가 폴백으로 되살아남
      delete store[item.id]
    }
  }
  saveAttachmentMeta(store)
}

export function getLessonAttachments(lessonId: string): LessonAtt[] {
  return getAttachmentMeta()[lessonId] || []
}

export function useCourses() {
  // ── 강의 조회 (캐시 우선, 동기) ────────────────────────────
  const getCourse = useCallback((id: string): Course | null => {
    const custom = getCachedCustomCourses().find(c => c.id === id)
    if (custom) return custom
    const base = COURSES.find(c => c.id === id)
    if (!base) return null
    const overrides = getCachedOverrides()
    if (overrides[id]) return { ...base, ...overrides[id] } as Course
    return base
  }, [])

  const getAllCourses = useCallback((): Course[] => {
    const base = COURSES.map(c => getCourse(c.id)!)
    const all = [...base, ...getCachedCustomCourses()]
    const order: string[] = getJSON(ORDER_KEY, [])
    if (order.length > 0) {
      all.sort((a, b) => {
        const ai = order.indexOf(a.id), bi = order.indexOf(b.id)
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      })
    }
    return all
  }, [getCourse])

  const getPublicCourses = useCallback((): Course[] => {
    return getAllCourses().filter(c => c.status !== 'private')
  }, [getAllCourses])

  const saveCourseOrder = useCallback((ids: string[]) => {
    localStorage.setItem(ORDER_KEY, JSON.stringify(ids))
    // 백그라운드 Supabase 저장 — course_overrides 특수 행에 순서 보관 (전 사용자 동기화)
    supabase.from('course_overrides').upsert(
      { course_id: COURSE_ORDER_ID, data: { ids } as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: 'course_id' },
    ).then(({ error }) => { if (error) console.warn('course order sync failed:', error.message) })
  }, [])

  // ── override 저장 (로컬 즉시 + Supabase 백그라운드) ────────
  const saveCourseOverride = useCallback((id: string, data: Partial<Course>) => {
    const overrides = getCachedOverrides()
    overrides[id] = { ...overrides[id], ...data }
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides))

    // 백그라운드 Supabase 저장
    supabase.from('course_overrides').upsert(
      { course_id: id, data: overrides[id] as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: 'course_id' }
    ).then(({ error }) => { if (error) console.warn('override sync failed:', error.message) })
  }, [])

  // ── 커스텀 강의 저장 ──────────────────────────────────────
  const saveCustomCourse = useCallback((course: Course) => {
    const all = getCachedCustomCourses()
    const idx = all.findIndex(c => c.id === course.id)
    if (idx >= 0) all[idx] = course
    else all.push(course)
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(all))

    supabase.from('custom_courses').upsert(
      { id: course.id, data: course as unknown as Record<string, unknown> },
      { onConflict: 'id' }
    ).then(({ error }) => { if (error) console.warn('custom course sync failed:', error.message) })
  }, [])

  const deleteCustomCourse = useCallback((id: string) => {
    const all = getCachedCustomCourses().filter(c => c.id !== id)
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(all))
    supabase.from('custom_courses').delete().eq('id', id)
      .then(({ error }) => { if (error) console.warn('delete custom course failed:', error.message) })
  }, [])

  // ── Supabase → 로컬 캐시 동기화 (앱 시작 시 1회 호출) ─────
  const syncFromSupabase = useCallback(async () => {
    const [overridesRes, customRes, reviewsRes, instructorsRes] = await Promise.all([
      supabase.from('course_overrides').select('course_id, data'),
      supabase.from('custom_courses').select('id, data'),
      supabase.from('reviews').select('*').order('created_at', { ascending: false }),
      supabase.from('instructors').select('id, data'),
    ])

    if (overridesRes.data) {
      const map: Record<string, Partial<Course>> = {}
      let orderIds: string[] | null = null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      overridesRes.data.forEach((r: any) => {
        // 강의 순서 특수 행은 오버라이드 맵에 넣지 않고 ORDER_KEY로 분리 저장
        if (r.course_id === COURSE_ORDER_ID) {
          const ids = r.data?.ids
          if (Array.isArray(ids)) orderIds = ids
          return
        }
        map[r.course_id] = r.data as Partial<Course>
      })
      localStorage.setItem(OVERRIDE_KEY, JSON.stringify(map))
      // 관리자가 지정한 순서를 모든 사용자에게 반영
      if (orderIds) localStorage.setItem(ORDER_KEY, JSON.stringify(orderIds))
    }
    if (customRes.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const courses = customRes.data.map((r: any) => r.data as Course)
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(courses))
    }
    if (reviewsRes.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reviews = reviewsRes.data.map((r: any): Review => ({
        id: r.id, courseId: r.course_id, userId: r.user_id,
        userName: r.user_name, userAvatar: r.user_avatar ?? '',
        rating: r.rating, text: r.text, date: r.created_at,
        source: r.source ?? 'user',
      }))
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews))
    }
    if (instructorsRes.data) {
      // 강사 정렬 순서 특수 행(__order__)은 목록에서 분리해 ORDER_KEY로 저장 (전 사용자 동기화)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orderRow = instructorsRes.data.find((r: any) => r.id === INSTRUCTOR_ORDER_ID)
      const orderIds = (orderRow?.data as { ids?: string[] } | undefined)?.ids
      if (Array.isArray(orderIds)) localStorage.setItem('arcana_instructor_order', JSON.stringify(orderIds))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const instructors = instructorsRes.data.filter((r: any) => r.id !== INSTRUCTOR_ORDER_ID).map((r: any) => r.data)
      localStorage.setItem('arcana_instructors', JSON.stringify(instructors))
    }
    // 캐시 갱신 완료 — 캐시 기반 컴포넌트(강의/리뷰 표시) 재렌더 트리거
    notifyDataSynced()
  }, [])

  // ── 수강생 수 ─────────────────────────────────────────────
  // 강의별 리뷰 수를 수강생 수로 사용 (한 명당 한 리뷰 가정)
  // → 메인 페이지 통계와 일관성 유지
  const getEnrolledCount = useCallback((courseId: string): string => {
    const reviews = getCachedReviews()
    const count = reviews.filter(r => r.courseId === courseId).length
    return String(count)
  }, [])

  // ── 리뷰 API (캐시 기반 동기 — syncFromSupabase 후 최신) ───
  const getReviewsByCourse = useCallback((courseId: string): Review[] => {
    return getCachedReviews()
      .filter(r => r.courseId === courseId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [])

  // 전체 리뷰 (메인 페이지 후기 노출용) — 최신순
  const getAllReviews = useCallback((): Review[] => {
    return [...getCachedReviews()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [])

  // 리뷰 수정 (관리자)
  const updateReview = useCallback(async (
    id: string,
    patch: { rating?: number; text?: string; userName?: string; createdAt?: string }
  ): Promise<boolean> => {
    const all = getCachedReviews()
    const idx = all.findIndex(r => r.id === id)
    if (idx < 0) return false

    // Supabase 업데이트 — 변경된 필드만
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbPatch: any = {}
    if (typeof patch.rating === 'number') dbPatch.rating = patch.rating
    if (typeof patch.text === 'string') dbPatch.text = patch.text
    if (typeof patch.userName === 'string') dbPatch.user_name = patch.userName
    if (typeof patch.createdAt === 'string') dbPatch.created_at = patch.createdAt
    const { error } = await supabase.from('reviews').update(dbPatch).eq('id', id)
    if (error) return false

    // 로컬 캐시 업데이트
    if (typeof patch.rating === 'number') all[idx].rating = patch.rating
    if (typeof patch.text === 'string') all[idx].text = patch.text
    if (typeof patch.userName === 'string') all[idx].userName = patch.userName
    if (typeof patch.createdAt === 'string') all[idx].date = patch.createdAt
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(all))
    return true
  }, [])

  const addReview = useCallback(async (
    courseId: string, userId: string, userName: string,
    userAvatar: string, rating: number, text: string,
    source: 'user' | 'admin' = 'user',
    createdAt?: string,  // ISO 문자열 — 시드 리뷰의 랜덤 날짜 지정용
  ): Promise<Review | null> => {
    const all = getCachedReviews()
    if (source === 'user' && all.some(r => r.courseId === courseId && r.userId === userId)) return null

    // Supabase에 저장 — createdAt이 있으면 함께 전달
    const insertPayload: Record<string, unknown> = {
      course_id: courseId, user_id: userId, user_name: userName,
      user_avatar: userAvatar, rating, text, source,
    }
    if (createdAt) insertPayload.created_at = createdAt

    const { data, error } = await supabase.from('reviews').insert(insertPayload).select().single() as
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any

    if (error || !data) {
      console.warn('[addReview] Supabase insert 실패:', error?.message, error)
      return null
    }

    const review: Review = {
      id: data.id, courseId: data.course_id, userId: data.user_id,
      userName: data.user_name, userAvatar: data.user_avatar ?? '',
      rating: data.rating, text: data.text, date: data.created_at,
      source: data.source ?? 'user',
    }

    // 로컬 캐시 업데이트 + 표시 컴포넌트 재렌더 알림
    all.push(review)
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(all))
    notifyDataSynced()
    return review
  }, [])

  const hasReviewed = useCallback((courseId: string, userId: string): boolean => {
    return getCachedReviews().some(r => r.courseId === courseId && r.userId === userId)
  }, [])

  const getReviewStats = useCallback((courseId: string) => {
    const reviews = getReviewsByCourse(courseId)
    if (reviews.length === 0) return null
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    return { avg: Math.round(avg * 10) / 10, count: reviews.length }
  }, [getReviewsByCourse])

  // 리뷰 삭제 (관리자)
  const deleteReviewById = useCallback(async (id: string) => {
    const all = getCachedReviews().filter(r => r.id !== id)
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(all))
    await supabase.from('reviews').delete().eq('id', id)
  }, [])

  return {
    getCourse, getAllCourses, getPublicCourses, saveCourseOrder,
    saveCourseOverride, saveCustomCourse, deleteCustomCourse,
    syncFromSupabase,
    getEnrolledCount,
    getReviewsByCourse, getAllReviews, addReview, updateReview, hasReviewed, getReviewStats, deleteReviewById,
  }
}
