import { useState, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCourses, useDataSyncTick } from '../hooks/useCourses'
import CourseCard from '../components/course/CourseCard'
import { formatPrice } from '../utils/format'
import { usePageSeo } from '../components/ui/SeoHead'

// 자격증은 별도 섹션으로 분리하므로 필터에서 제외 (인터넷 강의만 노출)
const FILTERS = ['전체', '입문', '중급', '고급']

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        fontSize: '.84rem',
        color: 'var(--t2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: '12px',
      }}
    >
      <span style={{ color: 'var(--t3)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: 'var(--text)', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

export default function CoursesPage() {
  usePageSeo({
    title: '타로 강의 전체보기 | 점클래스',
    description: '입문부터 자격증까지, 점클래스의 모든 타로·오라클카드 온라인 강의를 한눈에. 레벨별 커리큘럼으로 원하는 강의를 골라 시작하세요.',
  })
  const { getPublicCourses, getEnrolledCount } = useCourses()
  useDataSyncTick()  // Supabase 동기화(순서/강의) 완료 시 재렌더 → 최신 순서 반영
  const [searchParams] = useSearchParams()
  // URL 쿼리 ?filter=자격증 등으로 진입 시 해당 필터로 시작
  const initialFilter = searchParams.get('filter') || '전체'
  const [filter, setFilter] = useState(FILTERS.includes(initialFilter) ? initialFilter : '전체')
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  function toggleSearch() {
    setSearchOpen(open => {
      const next = !open
      if (next) setTimeout(() => searchRef.current?.focus(), 60)
      else setSearch('')  // 닫으면 검색어 초기화 → 필터 해제
      return next
    })
  }

  const all = getPublicCourses()
  // 메인 그리드는 인터넷 강의만 (자격증은 하단 별도 섹션에서 카드로 안내)
  const internetCourses = all.filter(c => c.level !== '자격증')
  const byLevel = filter === '전체' ? internetCourses : internetCourses.filter(c => c.level === filter)
  const q = search.trim().toLowerCase()
  const filtered = q ? byLevel.filter(c => c.title.toLowerCase().includes(q)) : byLevel

  // 자격증 섹션 — 각 자격증을 개별 카드로 보여주고, 데이터 없는 항목은 표시 자체를 생략
  const certs = all.filter(c => c.level === '자격증')
  const certCount = certs.length

  const certInfos = certs.map(c => {
    const lessonCount = c.curriculum.reduce((n, sec) => n + sec.items.length, 0)
    // 자격증 과정은 1회차당 1시간이 소요되므로, 회차 수를 그대로 시간으로 환산
    const duration = lessonCount > 0 ? `${lessonCount}시간` : ''
    const enrolled = Number(getEnrolledCount(c.id)) || 0
    const reviews = c.reviews ?? []
    const rating = reviews.length
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : null
    const tiers = c.pricingTiers ?? []
    const tierMonths = Array.from(new Set(tiers.map(t => Math.round(t.days / 30))))
      .sort((a, b) => a - b)
    const minPrice = tiers.length ? Math.min(...tiers.map(t => t.price)) : null
    const includedCount = c.includedCourseIds?.length ?? 0
    return {
      course: c,
      lessonCount,
      duration,
      enrolled,
      rating,
      reviewCount: reviews.length,
      tierMonths,
      minPrice,
      includedCount,
    }
  })

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="section-kicker">인터넷 강의</span>
          <h1 style={{ marginTop: '10px' }}>강의 목록</h1>
          <p>입문·중급·고급 인터넷 강의를 한눈에 확인하세요. 자격증 과정은 아래 섹션에서 안내합니다.</p>
        </div>
      </section>

      {/* 필터 */}
      <div className="container" style={{ marginBottom: '32px', marginTop: '28px' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {FILTERS.map(f => (
            <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
          {/* 검색 — 아이콘 클릭 시 입력바가 펼쳐짐, 제목으로 필터 */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className={`course-search ${searchOpen ? 'open' : ''}`}>
              <input
                ref={searchRef}
                className="course-search-input"
                placeholder="강의 제목 검색"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') toggleSearch() }}
              />
            </div>
            <button
              type="button"
              className="course-search-btn"
              onClick={toggleSearch}
              aria-label={searchOpen ? '검색 닫기' : '강의 검색'}
            >
              {searchOpen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: '100px' }}>
        {filtered.length > 0 ? (
          <div className="courses-grid">
            {filtered.map(c => (
              <CourseCard key={c.id} course={c} enrolledCount={getEnrolledCount(c.id)} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--t2)' }}>
            {q ? `'${search.trim()}' 검색 결과가 없습니다.` : '해당 레벨의 강의가 없습니다.'}
          </div>
        )}
      </div>

      {/* 자격증 섹션 — 각 자격증을 개별 카드로 자세히 안내 */}
      <section className="section" style={{ background: 'rgba(255,255,255,.018)', borderTop: '1px solid var(--line)' }}>
        <div className="container">
          {/* 섹션 헤더 */}
          <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 36px' }}>
            <span className="section-kicker">자격증 과정</span>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-.03em', margin: '12px 0 14px' }}>
              담당 강사와 함께<br />
              <span style={{ background: 'linear-gradient(135deg,var(--gold-2),var(--purple-2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                전문 타로 상담사
              </span>로 성장하세요
            </h2>
            <p style={{ color: 'var(--t2)', lineHeight: 1.8, margin: 0 }}>
              {certCount > 0
                ? `현재 ${certCount}개의 자격증 과정이 운영 중입니다. 결제 시 담당 강사가 매칭되어 모든 회차 진도를 1:1로 관리합니다.`
                : '담당 강사 1:1 진도 관리와 수료 동의서까지 포함된 자격증 과정이 곧 오픈됩니다.'}
            </p>
          </div>

          {/* 자격증 카드 그리드 */}
          {certCount > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
                gap: '20px',
                maxWidth: '1100px',
                margin: '0 auto',
              }}
            >
              {certInfos.map(info => {
                const c = info.course
                return (
                  <Link
                    key={c.id}
                    to={`/course/${c.id}`}
                    style={{
                      background: 'var(--bg-3)',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--r3)',
                      padding: '28px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: '2.6rem', marginBottom: '14px', lineHeight: 1 }}>
                      {c.emoji || '👑'}
                    </div>
                    <div
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        letterSpacing: '-.02em',
                        marginBottom: '6px',
                        lineHeight: 1.35,
                      }}
                    >
                      {c.title}
                    </div>
                    {c.subtitle && (
                      <div
                        style={{
                          fontSize: '.84rem',
                          color: 'var(--t3)',
                          marginBottom: '4px',
                          lineHeight: 1.55,
                        }}
                      >
                        {c.subtitle}
                      </div>
                    )}

                    {/* 통계 — 데이터가 있는 항목만 표시 */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        marginTop: 'auto',
                        paddingTop: '18px',
                      }}
                    >
                      {info.lessonCount > 0 && (
                        <Stat
                          label="커리큘럼"
                          value={
                            info.duration
                              ? `${info.lessonCount}회차 · ${info.duration}`
                              : `${info.lessonCount}회차`
                          }
                        />
                      )}
                      {info.tierMonths.length > 0 && (
                        <Stat
                          label="수강 기간"
                          value={info.tierMonths.map(m => `${m}개월`).join(' / ')}
                        />
                      )}
                      {info.minPrice !== null && info.minPrice > 0 && (
                        <Stat label="최저 결제가" value={`${formatPrice(info.minPrice)}~`} />
                      )}
                      {info.rating && (
                        <Stat
                          label="평점"
                          value={`${info.rating}★ (${info.reviewCount})`}
                        />
                      )}
                      {info.includedCount > 0 && (
                        <Stat label="포함 강의" value={`${info.includedCount}개 패키지`} />
                      )}
                      {/* 자격증은 누적 수강생 표기 안 함 — 평점(리뷰)만 노출 */}
                    </div>

                    <div
                      style={{
                        marginTop: '20px',
                        paddingTop: '16px',
                        borderTop: '1px solid var(--line)',
                        fontSize: '.86rem',
                        fontWeight: 700,
                        color: 'var(--gold)',
                        textAlign: 'right',
                      }}
                    >
                      자세히 보기 →
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: 'var(--t3)',
                background: 'var(--bg-3)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r3)',
                maxWidth: '520px',
                margin: '0 auto',
              }}
            >
              자격증 과정 오픈 준비 중입니다
            </div>
          )}

          {/* 공통 특징 — 모든 자격증에 적용되는 운영 정책 */}
          {certCount > 0 && (
            <ul
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '10px 22px',
                marginTop: '36px',
                padding: 0,
                maxWidth: '900px',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              {[
                '1:1 진도리스트 제공 및 관리',
                '간편한 수강동의서 작성',
                '수강생에 맞춘 교육프로그램',
                '화상수업 및 대면 수업 가능',
              ].map(t => (
                <li
                  key={t}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '.86rem',
                    color: 'var(--t2)',
                    listStyle: 'none',
                  }}
                >
                  <span style={{ color: 'var(--ok)' }}>✓</span> {t}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

    </>
  )
}
