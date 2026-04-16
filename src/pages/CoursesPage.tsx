import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCourses } from '../hooks/useCourses'
import CourseCard from '../components/course/CourseCard'

const FILTERS = ['전체', '입문', '중급', '고급']

export default function CoursesPage() {
  const { getPublicCourses, getEnrolledCount } = useCourses()
  const [filter, setFilter] = useState('전체')

  const all = getPublicCourses()
  const filtered = filter === '전체' ? all : all.filter(c => c.level === filter)

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="section-kicker">전체 강의</span>
          <h1 style={{ marginTop: '10px' }}>강의 목록</h1>
          <p>입문부터 자격증까지 — 수준에 맞는 강의를 찾아보세요.</p>
        </div>
      </section>

      {/* 필터 */}
      <div className="container" style={{ marginBottom: '32px', marginTop: '28px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '.8rem', color: 'var(--t3)', marginRight: '4px' }}>필터</span>
          {FILTERS.map(f => (
            <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
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
            해당 레벨의 강의가 없습니다.
          </div>
        )}
      </div>

      {/* 자격증 섹션 */}
      <section className="section" style={{ background: 'rgba(255,255,255,.018)', borderTop: '1px solid var(--line)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 'clamp(28px, 5vw, 60px)', alignItems: 'center', maxWidth: '920px', margin: '0 auto' }}>
            <div>
              <span className="section-kicker">자격증 과정</span>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-.03em', margin: '12px 0 14px' }}>
                공인<br />
                <span style={{ background: 'linear-gradient(135deg,var(--gold-2),var(--purple-2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  전문 리더
                </span>가 되세요
              </h2>
              <p style={{ color: 'var(--t2)', marginBottom: '20px', lineHeight: 1.8 }}>
                전문 리더 자격증 과정 40강으로 타로 리더로서의 커리어를 시작하세요. 윤리부터 비즈니스 구축까지 모두 포함되어 있습니다.
              </p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '26px' }}>
                {['총 40강 심층 영상 강의', '국내외 인정 공인 자격증', '비즈니스 & 마케팅 모듈 포함', '클라이언트 관리 실전 가이드'].map(t => (
                  <li key={t} style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '.875rem', color: 'var(--t2)', listStyle: 'none' }}>
                    <span style={{ color: 'var(--ok)' }}>✓</span> {t}
                  </li>
                ))}
              </ul>
              <Link to="/course/tarot-business" className="btn btn-gold btn-lg">자격증 과정 보기 →</Link>
            </div>
            <div style={{ background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 'var(--r3)', padding: '36px', textAlign: 'center' }}>
              <div style={{ fontSize: '4.5rem', marginBottom: '18px' }}>👑</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '5px' }}>전문 타로 리더</div>
              <div style={{ fontSize: '.84rem', color: 'var(--t3)', marginBottom: '24px' }}>자격증 과정</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[['40강', '총 강의수'], ['20시간', '강의 분량'], ['310명', '수료생'], ['4.9★', '평점']].map(([v, l]) => (
                  <div key={l} style={{ padding: '14px', background: 'rgba(255,255,255,.04)', border: '1px solid var(--line)', borderRadius: 'var(--r2)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--gold)' }}>{v}</div>
                    <div style={{ fontSize: '.74rem', color: 'var(--t3)', marginTop: '2px' }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 미니 푸터 */}
      <footer className="footer">
        <div className="container">
          <div className="footer-bottom" style={{ borderTop: 'none', paddingTop: 0 }}>
            <Link to="/" style={{ fontSize: '.95rem', fontWeight: 800, color: 'var(--t1)' }}>JUMCLASS</Link>
            <span>© 2026 JUMCLASS. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </>
  )
}
