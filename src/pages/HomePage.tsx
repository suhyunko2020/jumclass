import { Link } from 'react-router-dom'
import { useCourses } from '../hooks/useCourses'
import { useInstructors } from '../hooks/useInstructors'
import { useAuth } from '../hooks/useAuth'
import { useAuthModal } from '../components/auth/AuthModal'
import { useToast } from '../components/ui/Toast'
import CourseCard from '../components/course/CourseCard'
import { useEffect, useState } from 'react'
import HeroBg from '../components/ui/HeroBg'
import { readCachedStats, computeAndCacheStats, type HomeStats } from '../lib/homeStats'
import { maskName } from '../utils/format'

export default function HomePage() {
  const { getPublicCourses, getEnrolledCount, getAllReviews, getCourse } = useCourses()
  const { getPublicInstructors } = useInstructors()
  const { openAuth } = useAuthModal()
  const { user } = useAuth()
  const toast = useToast()
  const publicCourses = getPublicCourses()
  const [stats, setStats] = useState<HomeStats | null>(() => readCachedStats())

  // 인기 강의 — stats.topCourseIds 있으면 그 순서로, 없으면 기본 순서로 상위 3
  const courses = (() => {
    if (stats && stats.topCourseIds.length > 0) {
      const idOrder = new Map(stats.topCourseIds.map((id, i) => [id, i]))
      const sorted = [...publicCourses].sort((a, b) => {
        const ia = idOrder.has(a.id) ? idOrder.get(a.id)! : Infinity
        const ib = idOrder.has(b.id) ? idOrder.get(b.id)! : Infinity
        return ia - ib
      })
      return sorted.slice(0, 3)
    }
    return publicCourses.slice(0, 3)
  })()

  // 통계 로드 — 매 mount 시 백그라운드에서 새로 fetch (stale-while-revalidate)
  // 캐시는 즉시 표시용으로만 사용하고, 항상 최신 데이터로 갱신
  useEffect(() => {
    const instructorCount = getPublicInstructors().length
    computeAndCacheStats({
      publicCourses: publicCourses.map(c => ({ id: c.id, lessons: c.lessons })),
      instructorCount,
    }).then(setStats).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' })

  // 문의 보안 코드 — 스팸 봇 차단용. 페이지 진입 시 랜덤 4자리 생성, 제출 성공/취소 시 재발급
  const [captchaCode, setCaptchaCode] = useState(() => genCaptcha())
  const [captchaInput, setCaptchaInput] = useState('')

  function genCaptcha() {
    // 혼동 방지: 0/O, 1/l/I 제외
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    let out = ''
    for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
    return out
  }

  function handleContact(e: React.FormEvent) {
    e.preventDefault()
    if (captchaInput.trim().toUpperCase() !== captchaCode) {
      toast('보안 코드가 일치하지 않습니다. 다시 확인해주세요.', 'err')
      setCaptchaInput('')
      setCaptchaCode(genCaptcha())
      return
    }
    toast('문의가 접수됐습니다. 24시간 내로 답변드릴게요 ✦', 'ok')
    setContactForm({ name: '', email: '', message: '' })
    setCaptchaInput('')
    setCaptchaCode(genCaptcha())
  }

  return (
    <>
      {/* Hero */}
      <section className="hero" style={{ position: 'relative', overflow: 'hidden' }}>
        <HeroBg />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="hero-inner page-enter">
            <div className="hero-text">
              <div className="hero-kicker">타로 전문 교육 플랫폼</div>
              <h1>타로 리딩,<br /><em>제대로</em> 배워보세요</h1>
              <p className="hero-desc">입문부터 자격증까지, 현직 리더의 영상 강의로 배우는 타로.<br />혼자 공부하다 막힐 때, 여기서 답을 찾으세요.</p>
              <div className="hero-cta">
                <Link to="/courses" className="btn btn-gold btn-xl">강의 둘러보기 →</Link>
                <button className="btn btn-ghost btn-xl" onClick={() => openAuth('signup')}>무료로 시작하기</button>
              </div>
              <div className="hero-stats">
                <div className="hero-stat">
                  <div className="num">{stats ? stats.studentCount.toLocaleString() : '—'}</div>
                  <div className="lbl">수강생</div>
                </div>
                <div className="hero-stat">
                  <div className="num">{stats ? stats.instructorCount : '—'}</div>
                  <div className="lbl">전문 강사</div>
                </div>
                <div className="hero-stat">
                  <div className="num">{stats ? `${stats.lessonCount}강` : '—'}</div>
                  <div className="lbl">총 강의</div>
                </div>
                <div className="hero-stat">
                  <div className="num">{stats && stats.reviewCount > 0 ? `${stats.avgRating.toFixed(1)}★` : '—'}</div>
                  <div className="lbl">평균 평점</div>
                </div>
              </div>
            </div>

            {/* 우측: 강의 시청 화면 목업 (장식용 — 가공된 예시 화면) */}
            <HeroMockup />
          </div>
        </div>
      </section>

      {/* 인기 강의 */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-kicker">인기 강의</span>
            <h2>지금 가장 많이 듣는 강의</h2>
            <p>수강생들이 실제로 선택한 강의를 확인해보세요.</p>
          </div>
          <div className="courses-grid">
            {courses.map(c => (
              <CourseCard key={c.id} course={c} enrolledCount={getEnrolledCount(c.id)} />
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '36px' }}>
            <Link to="/courses" className="btn btn-ghost btn-lg">전체 강의 보기 →</Link>
          </div>
        </div>
      </section>

      {/* 특징 — 실제 등록된 강의 기준 팩트 */}
      <section className="section" style={{ background: 'rgba(255,255,255,.018)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <div className="section-header">
            <span className="section-kicker">점클래스 소개</span>
            <h2>숫자로 보는 점클래스</h2>
            <p>현재 운영 중인 강의와 환경을 한눈에 확인해보세요.</p>
          </div>
          {(() => {
            const totalLessons = publicCourses.reduce((s, c) => s + (c.lessons ?? 0), 0)
            const certCourses = publicCourses.filter(c => c.level === '자격증')
            const certLessons = certCourses.reduce((s, c) => s + (c.lessons ?? 0), 0)
            const instructorCount = getPublicInstructors().length
            // 최장 수강 기간 — pricingTiers에서 무제한(9999+) 있으면 무제한, 없으면 최대 일수
            const maxDays = publicCourses.reduce((max, c) => {
              const tierDays = (c.pricingTiers ?? []).map(t => t.days)
              const cand = Math.max(0, ...tierDays)
              return Math.max(max, cand)
            }, 0)
            const periodLabel = maxDays >= 9999
              ? '무제한 수강'
              : maxDays > 0 ? `최대 ${maxDays}일` : '수강 기간 안내'
            const avgLabel = stats && stats.reviewCount > 0
              ? `${stats.avgRating.toFixed(1)}★`
              : '—'
            const feats = [
              {
                ic: '📹',
                headline: `${publicCourses.length}개 강의`,
                sub: `총 ${totalLessons}강 수록`,
                d: '입문부터 고급·자격증까지 체계적인 커리큘럼.',
              },
              {
                ic: '📜',
                headline: certCourses.length > 0 ? `자격증 과정 ${certCourses.length}개` : '자격증 과정',
                sub: certCourses.length > 0 ? `${certLessons}강 심화 커리큘럼` : '곧 오픈 예정',
                d: '수료 후 전문 리더로 활동할 수 있는 과정.',
              },
              {
                ic: '🔮',
                headline: `현직 강사 ${instructorCount}명`,
                sub: '실제 리딩 현장 경험',
                d: '매일 리딩을 진행하는 프로 강사가 직접 가르칩니다.',
              },
              {
                ic: '⏳',
                headline: periodLabel,
                sub: '반복 수강 가능',
                d: '한 번 결제로 수강 기간 내 무제한 반복 학습.',
              },
              {
                ic: '⭐',
                headline: avgLabel,
                sub: stats && stats.reviewCount > 0 ? `리뷰 ${stats.reviewCount}건 기준` : '수강생 평점',
                d: '실제 수강생들이 남긴 평점과 후기.',
              },
              {
                ic: '📱',
                headline: '멀티 디바이스',
                sub: 'PC · 태블릿 · 모바일',
                d: '기기 제한 없이 언제 어디서든 이어서 수강.',
              },
            ]
            return (
              <div className="feat-grid">
                {feats.map(f => (
                  <div key={f.headline} className="feat-card" style={{ paddingTop: '24px' }}>
                    <span className="feat-ic">{f.ic}</span>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-.02em', color: 'var(--t1)', marginBottom: '4px' }}>
                      {f.headline}
                    </div>
                    <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--purple-2)', marginBottom: '10px' }}>
                      {f.sub}
                    </div>
                    <p style={{ fontSize: '.84rem', color: 'var(--t2)', lineHeight: 1.65, margin: 0 }}>{f.d}</p>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </section>

      {/* 후기 — 실제 리뷰 데이터 기반 (최신 6개) */}
      {(() => {
        const reviews = getAllReviews().slice(0, 6)
        if (reviews.length === 0) return null
        return (
          <section className="section">
            <div className="container">
              <div className="section-header">
                <span className="section-kicker">수강생 후기</span>
                <h2>수강생들의 이야기</h2>
                <p>실제 수강생들이 남긴 평점과 후기를 확인해보세요.</p>
              </div>
              <div className="testi-grid">
                {reviews.map(r => {
                  const c = getCourse(r.courseId)
                  return (
                    <div key={r.id} className="testi-card">
                      <div style={{ fontSize: '.9rem', color: 'var(--gold)', marginBottom: '10px', letterSpacing: '2px' }}>
                        {'★'.repeat(r.rating)}
                        <span style={{ color: 'rgba(255,255,255,.12)' }}>{'★'.repeat(5 - r.rating)}</span>
                      </div>
                      <p className="testi-quote">"{r.text}"</p>
                      <div className="testi-author">
                        <div className="testi-av">{r.userAvatar || maskName(r.userName).charAt(0)}</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0, flex: 1 }}>
                          <div className="testi-name">{maskName(r.userName)}</div>
                          {c && (
                            <span style={{
                              fontSize: '.72rem', color: 'var(--t3)', fontWeight: 400, opacity: .75,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              minWidth: 0, flex: 1,
                            }}>
                              · {c.title}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )
      })()}

      {/* CTA 배너 — 로그인/비로그인 분기 + 간단한 혜택 요약 */}
      <section style={{ padding: '16px 0 80px' }}>
        <div className="container">
          <div style={{
            padding: 'clamp(40px, 6vw, 72px) clamp(22px, 5vw, 56px)', textAlign: 'center', borderRadius: 'var(--r4)',
            background: 'linear-gradient(135deg, rgba(124,111,205,.08), rgba(201,168,76,.04) 60%, rgba(0,0,0,.3))',
            border: '1px solid var(--line)', position: 'relative', overflow: 'hidden',
          }}>
            {/* 글로우 블롭 (좀 더 중심 쪽으로 배치 — 밋밋함 개선) */}
            <div style={{ position: 'absolute', top: '-40%', left: '50%', transform: 'translateX(-50%)', width: 'min(640px, 90%)', height: '560px', borderRadius: '50%', background: 'radial-gradient(ellipse,rgba(124,111,205,.18) 0%,transparent 65%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-50%', right: '-10%', width: '420px', height: '420px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(201,168,76,.14) 0%,transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <span className="section-kicker">{user ? '추천 강의' : '지금 시작하기'}</span>
              <h2 style={{ fontSize: 'clamp(1.8rem,3.8vw,2.6rem)', fontWeight: 800, letterSpacing: '-.03em', margin: '14px 0 16px', lineHeight: 1.3 }}>
                {user
                  ? <>다음엔 어떤 강의를<br />들어볼까요?</>
                  : <>타로, 이제 제대로<br />배워볼 시간이에요</>
                }
              </h2>
              <p style={{ color: 'var(--t2)', maxWidth: '480px', margin: '0 auto 26px', lineHeight: 1.75, fontSize: '.95rem' }}>
                {user
                  ? '학습 중인 강의를 이어가거나, 새로운 과정을 둘러보세요.'
                  : '회원가입 후 무료 미리보기로 부담 없이 시작할 수 있어요.'}
              </p>

              {/* 혜택 요약 태그 — 비로그인 유저에게 추가 정보 노출 */}
              {!user && (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '28px' }}>
                  {['무료 회원가입', '미리보기 제공', '수강 기간 내 무제한 반복'].map(t => (
                    <span key={t} style={{
                      fontSize: '.76rem', fontWeight: 600, color: 'var(--t2)',
                      padding: '7px 14px', borderRadius: '999px',
                      background: 'rgba(255,255,255,.04)', border: '1px solid var(--line)',
                    }}>✓ {t}</span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {user ? (
                  <>
                    <Link to="/classroom" className="btn btn-gold btn-xl">내 강의실로 이동 →</Link>
                    <Link to="/courses" className="btn btn-ghost btn-xl">새 강의 둘러보기</Link>
                  </>
                ) : (
                  <>
                    <button className="btn btn-gold btn-xl" onClick={() => openAuth('signup')}>무료 회원가입 →</button>
                    <Link to="/courses" className="btn btn-ghost btn-xl">강의 먼저 보기</Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 문의 */}
      <section className="section" id="contact" style={{ paddingTop: 0 }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 'clamp(28px, 5vw, 60px)', alignItems: 'center' }}>
            <div>
              <span className="section-kicker">문의</span>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-.03em', margin: '12px 0 14px' }}>궁금한 게 있으신가요?</h2>
              <p style={{ color: 'var(--t2)', marginBottom: '22px', lineHeight: 1.75 }}>어떤 강의를 들어야 할지 잘 모르겠다면 편하게 문의해주세요. 영업일 기준 24시간 내로 답변드립니다.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '.875rem', color: 'var(--t2)' }}>📧 &nbsp;support@jumclass.com</div>
                <div style={{ fontSize: '.875rem', color: 'var(--t2)' }}>💬 &nbsp;영업일 기준 오전 10시 – 오후 4시</div>
              </div>
            </div>
            <form style={{ background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 'var(--r3)', padding: '28px' }} onSubmit={handleContact}>
              <div className="form-group">
                <label className="form-label">이름</label>
                <input className="form-input" type="text" placeholder="이름을 입력해주세요" required
                  value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">이메일</label>
                <input className="form-input" type="email" placeholder="이메일 주소" required
                  value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">문의 내용</label>
                <textarea className="form-input" rows={4} placeholder="문의 내용을 입력해주세요" required
                  style={{ resize: 'vertical' }}
                  value={contactForm.message} onChange={e => setContactForm(p => ({ ...p, message: e.target.value }))} />
              </div>

              {/* 보안 코드 — 스팸 봇 차단용 자체 캡차 */}
              <div className="form-group">
                <label className="form-label">보안 코드</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{
                    padding: '10px 18px',
                    background: 'linear-gradient(135deg, rgba(124,111,205,.14), rgba(232,156,56,.08))',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r2)',
                    fontFamily: 'monospace',
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    letterSpacing: '6px',
                    color: 'var(--t1)',
                    textDecoration: 'line-through wavy rgba(255,255,255,.1)',
                    userSelect: 'none',
                    flexShrink: 0,
                  }}>
                    {captchaCode}
                  </div>
                  <input className="form-input" type="text" placeholder="위 코드를 입력"
                    required maxLength={4}
                    value={captchaInput}
                    onChange={e => setCaptchaInput(e.target.value.toUpperCase())}
                    style={{ flex: 1, fontFamily: 'monospace', letterSpacing: '2px' }} />
                  <button type="button"
                    onClick={() => { setCaptchaCode(genCaptcha()); setCaptchaInput('') }}
                    title="코드 새로고침"
                    style={{
                      padding: '10px 12px', background: 'transparent',
                      border: '1px solid var(--line)', borderRadius: 'var(--r2)',
                      color: 'var(--t2)', cursor: 'pointer', fontSize: '1rem',
                    }}>
                    ↻
                  </button>
                </div>
                <div style={{ fontSize: '.72rem', color: 'var(--t3)', marginTop: '6px' }}>
                  스팸 차단을 위한 보안 코드입니다. 대소문자 구분 없이 입력해주세요.
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full">문의 보내기</button>
            </form>
          </div>
        </div>
      </section>

    </>
  )
}

// 강의 시청 화면 목업 — 인터넷강의 시청 페이지 분위기를 재현한 장식용 가공 화면
function HeroMockup() {
  return (
    <div className="hero-mockup">
      <div className="hero-mockup-card">
        {/* 윈도우 바 */}
        <div className="hero-mockup-bar">
          <span className="dot dot-r" />
          <span className="dot dot-y" />
          <span className="dot dot-g" />
          <div className="url">jumclass.com / lesson</div>
        </div>

        {/* 비디오 영역 */}
        <div className="hero-mockup-video">
          <div className="hero-mockup-chip hero-mockup-chip-tl">CHAPTER 02</div>
          <div className="hero-mockup-chip hero-mockup-chip-tr">1.0×</div>
          <button className="hero-mockup-play" aria-label="재생" />
          <div className="hero-mockup-controls">
            <span className="hero-mockup-time">12:34 / 28:00</span>
            <div className="hero-mockup-ctrl-icons">
              <span title="자막">CC</span>
              <span title="화질">HD</span>
              <span title="전체화면">⛶</span>
            </div>
          </div>
        </div>

        {/* 진도바 */}
        <div className="hero-mockup-progress">
          <div className="hero-mockup-progress-fill" style={{ width: '44%' }} />
        </div>

        {/* 강의 정보 */}
        <div className="hero-mockup-info">
          <div className="hero-mockup-info-chapter">Chapter 02 · 06강</div>
          <div className="hero-mockup-info-title">연인(The Lovers) — 선택과 관계의 상징</div>
          <div className="hero-mockup-info-meta">
            <span className="badge">유니버셜웨이트</span>
            <span>스완 강사</span>
            <span>·</span>
            <span>6/22회차</span>
          </div>

          {/* 다음 강의 미리보기 */}
          <div className="hero-mockup-next">
            <div className="hero-mockup-next-label">다음 강의</div>
            <div className="hero-mockup-next-row">
              <span className="hero-mockup-next-num">07</span>
              <div className="hero-mockup-next-text">
                <div className="hero-mockup-next-title">전차(The Chariot) — 의지와 추진력</div>
                <div className="hero-mockup-next-dur">24분</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 떠 있는 미니 카드 — 좌상단: 평점, 우하단: 학습 진행 */}
      <div className="hero-mockup-float hero-mockup-float-tl">
        <div className="hero-mockup-float-icon gold">★</div>
        <div className="hero-mockup-float-text">
          <strong>4.9 / 5.0</strong>
          <span>수강생 평균 평점</span>
        </div>
      </div>
      <div className="hero-mockup-float hero-mockup-float-br">
        <div className="hero-mockup-float-icon ok">✓</div>
        <div className="hero-mockup-float-text">
          <strong>오늘 1회차 완료</strong>
          <span>꾸준히 한 걸음씩</span>
        </div>
      </div>
    </div>
  )
}
