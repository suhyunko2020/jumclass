// 메인 페이지 히어로 통계 & 인기 강의 캐시
// - 매월 1일 기준으로 갱신 (캐시 키에 "YYYY-MM" 포함, 월이 바뀌면 재계산)
// - 클라이언트 사이드 캐시 (localStorage). 서버 집계 X
// - Supabase 조회 실패 시 로컬 캐시(강사/리뷰)만으로 추정값 산출

import { supabase } from './supabase'

export interface HomeStats {
  studentCount: number        // 수강생 수 (중복 제거된 enrollments.user_id)
  instructorCount: number     // 공개 강사 수
  lessonCount: number         // 공개 강의 lesson 총합
  avgRating: number           // 전체 리뷰 평균 평점 (0 = 리뷰 없음)
  reviewCount: number         // 전체 리뷰 수 (표시용)
  topCourseIds: string[]      // 결제 많은 순 상위 10개
  month: string               // "YYYY-MM"
}

const CACHE_KEY_PREFIX = 'jum_home_stats_'

// 수강생 수 기준선 — 옛 AWS/구 강의 사이트 누적 수강생(약 1,200명 + α)
const STUDENT_BASELINE = 1252
// 이 시각(사이트 오픈, 2026-06-19 14:00 KST = 05:00 UTC) 이후 가입한 회원만 기준선에 추가
const STUDENT_BASELINE_SINCE = '2026-06-19T05:00:00Z'

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function readCachedStats(): HomeStats | null {
  const month = currentMonth()
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + month)
    if (!raw) return null
    const parsed = JSON.parse(raw) as HomeStats
    if (parsed.month !== month) return null
    return parsed
  } catch {
    return null
  }
}

// 통계 캐시 강제 무효화 — 리뷰/등록 변경 후 즉시 갱신이 필요할 때 호출
export function invalidateStatsCache() {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i)
    if (k && k.startsWith(CACHE_KEY_PREFIX)) localStorage.removeItem(k)
  }
}

function writeCache(stats: HomeStats) {
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + stats.month, JSON.stringify(stats))
    // 이전 달 캐시 정리 (최대 2개월치만 유지)
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(CACHE_KEY_PREFIX)) continue
      if (k === CACHE_KEY_PREFIX + stats.month) continue
      // 같은 prefix의 옛날 캐시는 제거
      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      const prevMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (k !== CACHE_KEY_PREFIX + prevMonth) {
        localStorage.removeItem(k)
      }
    }
  } catch {}
}

export async function computeAndCacheStats(opts: {
  publicCourses: { id: string; lessons?: number }[]
  instructorCount: number
}): Promise<HomeStats> {
  const month = currentMonth()

  // 1) 강사/강의 수 — 클라이언트 인자로 전달받음 (이미 캐시에서 계산된 값)
  const instructorCount = opts.instructorCount
  const publicCourseIds = new Set(opts.publicCourses.map(c => c.id))
  const lessonCount = opts.publicCourses.reduce((sum, c) => sum + (c.lessons ?? 0), 0)

  // 2) 수강생 수 & 인기 강의
  // - enrollments user_id 합집합 + reviews 행 카운트 (1리뷰=1수강생 가정)
  //   reviews.user_id는 RLS로 anon에 마스킹될 수 있어 신뢰 불가 → 행 카운트 사용
  // - 인기 강의: enrollments(payment) + reviews 카운트 둘 다 합산
  const courseEnrollCount = new Map<string, number>()

  try {
    const { data } = await supabase
      .from('enrollments')
      .select('course_id, type')
    if (Array.isArray(data)) {
      for (const row of data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = row as any
        const cid = r.course_id as string | undefined
        const type = (r.type ?? 'payment') as string
        if (cid && type === 'payment' && publicCourseIds.has(cid)) {
          courseEnrollCount.set(cid, (courseEnrollCount.get(cid) ?? 0) + 1)
        }
      }
    }
  } catch { /* 무시 */ }

  try {
    const { data } = await supabase
      .from('reviews')
      .select('course_id')
    if (Array.isArray(data)) {
      for (const row of data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = row as any
        const cid = r.course_id as string | undefined
        if (cid && publicCourseIds.has(cid)) {
          courseEnrollCount.set(cid, (courseEnrollCount.get(cid) ?? 0) + 1)
        }
      }
    }
  } catch { /* 무시 */ }

  // 수강생 수 = 기준선(1,252명, 옛 사이트 누적) + 오픈 이후 신규 가입 회원 수
  let newMembers = 0
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .gte('created_at', STUDENT_BASELINE_SINCE)
    if (Array.isArray(data)) newMembers = data.length
  } catch { /* 무시 */ }
  const studentCount = STUDENT_BASELINE + newMembers

  // 인기 강의 정렬 (결제 많은 순, 동률이면 원래 순서 유지)
  const topCourseIds = Array.from(courseEnrollCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  // 3) 리뷰 평균 평점
  let avgRating = 0
  let reviewCount = 0
  try {
    const { data } = await supabase
      .from('reviews')
      .select('rating')
    if (Array.isArray(data) && data.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ratings = (data as any[]).map(r => Number(r.rating) || 0).filter(n => n > 0)
      if (ratings.length > 0) {
        avgRating = Math.round((ratings.reduce((s, n) => s + n, 0) / ratings.length) * 10) / 10
        reviewCount = ratings.length
      }
    }
  } catch {}

  const stats: HomeStats = {
    studentCount, instructorCount, lessonCount,
    avgRating, reviewCount, topCourseIds, month,
  }
  writeCache(stats)
  return stats
}
