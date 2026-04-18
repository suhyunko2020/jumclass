import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useCourses } from '../hooks/useCourses'
import { useInstructors } from '../hooks/useInstructors'
import { useAuth } from '../hooks/useAuth'
import { useAuthModal } from '../components/auth/AuthModal'
import { formatPrice, discountRate, formatDays, formatDaysShort, maskName, calcTotalDuration, getLevelColor } from '../utils/format'

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { getCourse, getEnrolledCount, getReviewsByCourse, getReviewStats } = useCourses()
  const { getPublicInstructors } = useInstructors()
  const { user, isEnrolled, getEnrollment } = useAuth()
  const { openAuth } = useAuthModal()

  // 미리보기/무료 강의 클릭 공통 가드 — 비회원이면 페이지 이동 대신 로그인 모달 오픈
  function openLesson(lessonId: string) {
    if (!user) {
      openAuth('login')
      return
    }
    navigate(`/lesson?course=${courseId}&lesson=${lessonId}`)
  }

  const course = getCourse(courseId || '')
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({ 0: true })
  const [tierIdx, setTierIdx] = useState(0)
  // 강사 페이지에서 진입한 경우 쿼리로 강사가 강제 지정됨 (셀렉트 잠금, 변경 불가)
  const forcedInstructorId = searchParams.get('assignedInstructor') || ''
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>(forcedInstructorId)

  useEffect(() => {
    if (course) document.title = course.title + ' — JUMCLASS'
  }, [course])

  if (!course) {
    return (
      <div className="auth-gate" style={{ paddingTop: '140px' }}>
        <div className="g-ico">😕</div>
        <h2>강의를 찾을 수 없습니다</h2>
        <Link to="/courses" className="btn btn-primary mt-16">강의 목록으로</Link>
      </div>
    )
  }

  const isCert = course.level === '자격증'
  // 자격증은 (강의, 강사) 조합일 때만 "이미 수강 중"으로 판단 → 다른 강사로 재결제 가능
  // 일반 강의는 기존처럼 강의 단위로 판단
  const enrolled = isCert && selectedInstructorId
    ? isEnrolled(course.id, selectedInstructorId)
    : isEnrolled(course.id)
  const myEnrollment = enrolled
    ? (isCert && selectedInstructorId ? getEnrollment(course.id, selectedInstructorId) : getEnrollment(course.id))
    : null
  const lockedInstructorId = myEnrollment?.assignedInstructorId
  const totalLessons = course.curriculum.reduce((s, sec) => s + sec.items.length, 0)
  const totalDuration = calcTotalDuration(course.curriculum)
  const freeLessons = course.curriculum.reduce((s, sec) => s + sec.items.filter(i => i.status === 'free').length, 0)
  const reviews = getReviewsByCourse(course.id)
  const reviewStats = getReviewStats(course.id)
  const courseInstructors = getPublicInstructors().filter(i => i.courseIds.includes(course.id))

  const tier = course.pricingTiers?.[tierIdx]
  const displayPrice = tier?.price ?? course.price
  const displayOriginal = tier?.originalPrice ?? course.originalPrice
  const displayDr = discountRate(displayOriginal, displayPrice)
  const displayDays = tier?.days ?? 365

  function toggleSection(idx: number) {
    setOpenSections(p => ({ ...p, [idx]: !p[idx] }))
  }

  const checkoutLink = `/checkout?course=${course.id}${tier ? `&tier=${tierIdx}` : ''}${isCert && selectedInstructorId ? `&assignedInstructor=${selectedInstructorId}` : ''}`

  return (
    <>
      <div className="detail-page-wrap detail-header-band">
        <div className="container">
          <div className="detail-two-col">
            {/* 좌측 */}
            <div className="detail-left">
              <div className="detail-breadcrumb">
                <Link to="/courses">강의</Link>
                <span>›</span>
                <span>{course.level}</span>
              </div>
              {(() => {
                const lc = getLevelColor(course.level)
                return (
                  <div className="detail-level" style={{ background: lc.bg, color: lc.color, border: `1px solid ${lc.color}33` }}>
                    {course.level}
                  </div>
                )
              })()}
              <h1 className="detail-title">{course.title}</h1>
              <p className="detail-subtitle" style={{ marginBottom: '12px' }}>{course.description}</p>
              <div className="detail-stats">
                <div className="detail-stat-item">
                  <span style={{ color: 'var(--gold)' }}>★</span>
                  <strong>{reviewStats ? reviewStats.avg : 0}</strong>
                  <span style={{ color: 'var(--t3)' }}>(수강생 {reviewStats ? reviewStats.count : 0}명 평가)</span>
                </div>
                <div className="detail-stat-item">👥 수강생 {getEnrolledCount(course.id)}명</div>
                <div className="detail-stat-item">🎬 총 {totalLessons}강</div>
                <div className="detail-stat-item">⏱ {totalDuration}</div>
              </div>
              <div className="detail-instructor-row" style={{ marginBottom: 0 }}>
                <div className="instructor-avatar">{course.instructorAvatar}</div>
                <span style={{ color: 'var(--t2)', fontSize: '.875rem' }}>강사 &nbsp;</span>
                <strong style={{ fontSize: '.9rem' }}>{course.instructor}</strong>
              </div>

              <div className="detail-divider" />

              {/* 학습 목표 */}
              <div className="detail-section">
                <div className="detail-section-title">이 강의에서 배우는 것</div>
                <div className="learn-grid">
                  {course.whatYouLearn.map((w, i) => (
                    <div key={i} className="learn-item">
                      <span className="check">✓</span>
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 기본 제공 강의 (자격증 과정일 때만) */}
              {isCert && course.includedCourseIds && course.includedCourseIds.length > 0 && (
                <div className="detail-section">
                  <div className="detail-section-title">
                    이 자격증 과정에 포함된 강의
                    <span style={{ fontSize: '.8rem', fontWeight: 400, color: 'var(--t3)', marginLeft: '10px' }}>
                      결제 시 함께 수강 가능
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {course.includedCourseIds.map(id => {
                      const inc = getCourse(id)
                      if (!inc) return null
                      const incTotal = inc.curriculum.reduce((s, sec) => s + sec.items.length, 0)
                      const incDur = calcTotalDuration(inc.curriculum)
                      return (
                        <Link
                          key={id}
                          to={`/course/${inc.id}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '14px',
                            padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 'var(--r3)',
                            background: 'var(--glass-1)', textDecoration: 'none', color: 'inherit',
                            transition: 'var(--t)',
                          }}
                        >
                          <div style={{
                            width: '48px', height: '48px', borderRadius: 'var(--r2)',
                            background: 'rgba(124,111,205,.1)', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0,
                          }}>
                            {inc.emoji}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '.68rem', padding: '2px 7px', borderRadius: 'var(--pill)', background: 'rgba(124,111,205,.12)', color: 'var(--purple-2)' }}>
                                {inc.level}
                              </span>
                              <span style={{ fontWeight: 700, fontSize: '.95rem' }}>{inc.title}</span>
                            </div>
                            <div style={{ fontSize: '.78rem', color: 'var(--t3)' }}>
                              총 {incTotal}강 · {incDur}
                            </div>
                          </div>
                          <span style={{ color: 'var(--t3)', fontSize: '1.1rem', flexShrink: 0 }}>›</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 커리큘럼 */}
              <div className="detail-section">
                <div className="detail-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{isCert ? '강의 진행 순서' : '강의 목차'}</span>
                  {!isCert && (
                    <span style={{ fontSize: '.8rem', fontWeight: 400, color: 'var(--t3)' }}>
                      {course.curriculum.length}섹션 · {totalLessons}강 · {totalDuration}
                    </span>
                  )}
                </div>
                {course.curriculum.map((sec, si) => (
                  <div key={si} className="curriculum-section">
                    <div className={`curr-section-head ${openSections[si] ? 'open' : ''}`} onClick={() => toggleSection(si)}>
                      <div>
                        <div className="curr-section-name">{sec.section}</div>
                        <div className="curr-section-meta">{sec.items.length}강</div>
                      </div>
                      <span className="curr-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
                    </div>
                    {openSections[si] && (
                      <div className="curr-items open">
                        {sec.items.map((item, ii) => {
                          if (isCert) {
                            const hasVimeo = !!item.vimeo
                            return (
                              <div key={item.id}
                                className="curr-item"
                                style={{ cursor: hasVimeo ? 'pointer' : 'default' }}
                                onClick={() => { if (hasVimeo) openLesson(item.id) }}
                              >
                                <div className="curr-item-icon" style={{
                                  background: 'rgba(124,111,205,.12)',
                                  color: 'var(--purple-2)',
                                  fontSize: '.78rem',
                                  fontWeight: 700,
                                  border: '1px solid rgba(124,111,205,.25)',
                                }}>
                                  {ii + 1}
                                </div>
                                <span className="curr-item-title">{item.title}</span>
                              </div>
                            )
                          }
                          const isFree = item.status === 'free'
                          const isLocked = !enrolled && !isFree
                          const canPlay = enrolled || isFree
                          return (
                            <div key={item.id}
                              className={`curr-item ${isLocked ? 'locked' : ''}`}
                              style={{ cursor: isLocked ? 'default' : 'pointer' }}
                              onClick={() => {
                                if (canPlay) openLesson(item.id)
                              }}
                            >
                              <div className={`curr-item-icon ${canPlay ? 'ic-free' : 'ic-lock'}`}>{canPlay ? '▶' : '🔒'}</div>
                              <span className="curr-item-title">{item.title}</span>
                              {!enrolled && isFree && <span className="free-tag">미리보기</span>}
                              <span className="curr-item-dur">{item.duration}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 강사 소개 */}
              <div className="detail-section">
                {isCert ? (
                  <>
                    <div className="detail-section-title">이 자격증 과정을 진행하는 강사</div>
                    {courseInstructors.length === 0 ? (
                      <div style={{ color: 'var(--t3)', fontSize: '.875rem', padding: '12px 0' }}>
                        등록된 강사가 아직 없습니다.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '14px' }}>
                        {courseInstructors.map(inst => (
                          <Link key={inst.id} to={`/instructor/${inst.id}`}
                            style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                              padding: '18px 14px', border: '1px solid var(--line)', borderRadius: 'var(--r3)',
                              background: 'var(--glass-1)', textDecoration: 'none', color: 'inherit',
                              transition: 'var(--t)',
                            }}>
                            <div style={{
                              width: '88px', height: '88px', borderRadius: '50%',
                              background: 'rgba(124,111,205,.1)', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', fontSize: '1.8rem', fontWeight: 800,
                              color: 'var(--purple-2)', overflow: 'hidden', flexShrink: 0,
                            }}>
                              {inst.photo
                                ? <img src={inst.photo} alt={inst.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : inst.name.charAt(0)}
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontWeight: 700, fontSize: '.92rem' }}>{inst.name}</div>
                              {inst.title && (
                                <div style={{ fontSize: '.76rem', color: 'var(--t3)', marginTop: '3px' }}>{inst.title}</div>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="detail-section-title">강사 소개</div>
                    {(() => {
                      // 등록된 강사 엔티티가 있으면 그 데이터를 우선 사용 (강사 관리에서 편집한 내용이 반영됨)
                      const primary = courseInstructors[0]
                      const name = primary?.name || course.instructor
                      const subtitle = primary?.title || '전문 타로 강사'
                      const bio = primary?.bio || course.instructorBio
                      return (
                        <div className="instructor-card">
                          <div className="instructor-big-avatar" style={primary?.photo ? { overflow: 'hidden' } : undefined}>
                            {primary?.photo
                              ? <img src={primary.photo} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : course.instructorAvatar}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div className="instructor-name">{name}</div>
                            <div style={{ fontSize: '.8rem', color: 'var(--t3)' }}>{subtitle}</div>
                            <p className="instructor-bio">{bio}</p>
                            {primary && (
                              <Link to={`/instructor/${primary.id}`}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  marginTop: '10px', fontSize: '.82rem', fontWeight: 600,
                                  color: 'var(--purple-2)', textDecoration: 'none',
                                }}>
                                프로필 보러가기 →
                              </Link>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>

              {/* 수강생 후기 */}
              {reviews.length > 0 && (
                <div className="detail-section" style={{ marginBottom: 0 }}>
                  <div className="detail-section-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>수강생 후기 ({reviews.length}개)</span>
                    {reviewStats && (
                      <span style={{ fontSize: '.85rem', color: 'var(--gold)', fontWeight: 400 }}>
                        ★ {reviewStats.avg} ({reviewStats.count}명)
                      </span>
                    )}
                  </div>
                  {reviews.map(r => (
                    <div key={r.id} className="review-card">
                      <div className="review-header">
                        <div className="review-avatar">{r.userAvatar}</div>
                        <div>
                          <div className="review-name">{maskName(r.userName)}</div>
                          <div className="review-date">{new Date(r.date).toLocaleDateString()} &nbsp;·&nbsp; {'★'.repeat(r.rating)}</div>
                        </div>
                      </div>
                      <p className="review-text">{r.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 우측 구매 카드 */}
            <div className="detail-right">
              <div className="purchase-card">
                <div className="purchase-thumb">{course.emoji}</div>
                <div className="purchase-body">
                  {course.pricingTiers && course.pricingTiers.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <label className="form-label">{isCert ? '수강 기간' : '수강 기간 선택'}</label>
                      {isCert ? (
                        <div style={{
                          width: '100%', fontSize: '.9rem', padding: '10px 12px',
                          background: 'rgba(124,111,205,.06)', border: '1px solid var(--line)',
                          borderRadius: 'var(--r2)', fontWeight: 600,
                        }}>
                          {(() => {
                            const d = course.pricingTiers[0].days
                            return d === 90 ? '3개월' : d === 120 ? '4개월' : `${d}일`
                          })()}
                        </div>
                      ) : (
                        <select className="form-input" style={{ width: '100%', fontSize: '.9rem', padding: '8px' }}
                          value={tierIdx} onChange={e => setTierIdx(Number(e.target.value))}>
                          {course.pricingTiers.map((t, idx) => (
                            <option key={idx} value={idx}>{formatDaysShort(t.days)}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {/* 자격증 과정 — 담당 강사 선택
                     · 강사 페이지에서 진입한 경우(forcedInstructorId): 해당 강사로 강제 잠금
                     · 일반 진입: 사용자가 선택. 이미 해당 강사 조합으로 수강 중이면 잠김 */}
                  {isCert && (() => {
                    const isForced = !!forcedInstructorId
                    const locked = isForced || enrolled
                    return (
                      <div style={{ marginBottom: '12px' }}>
                        <label className="form-label">
                          담당 강사 {isForced ? '(강사 페이지에서 지정됨)' : enrolled ? '(결제 완료)' : '선택'}
                        </label>
                        {courseInstructors.length === 0 ? (
                          <div style={{ width: '100%', fontSize: '.82rem', padding: '10px 12px', background: 'rgba(232,156,56,.06)', border: '1px solid rgba(232,156,56,.2)', borderRadius: 'var(--r2)', color: 'var(--warn)' }}>
                            등록된 담당 강사가 없습니다. 운영자에게 문의해주세요.
                          </div>
                        ) : (
                          <select
                            className="form-input"
                            style={{ width: '100%', fontSize: '.9rem', padding: '8px', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.8 : 1 }}
                            value={isForced ? forcedInstructorId : enrolled ? (lockedInstructorId || '') : selectedInstructorId}
                            onChange={e => { if (!locked) setSelectedInstructorId(e.target.value) }}
                            disabled={locked}
                          >
                            <option value="">강사를 선택해주세요</option>
                            {courseInstructors.map(inst => (
                              <option key={inst.id} value={inst.id}>
                                {inst.name}{inst.title ? ` · ${inst.title}` : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )
                  })()}

                  <div className="purchase-price">
                    <div style={{ marginBottom: '4px' }}>
                      <span className="orig">{formatPrice(displayOriginal)}</span>
                      <span style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--ok)', padding: '2px 8px', background: 'rgba(61,189,132,.1)', borderRadius: 'var(--pill)' }}>
                        {displayDr}% 할인
                      </span>
                    </div>
                    <div className="now">{formatPrice(displayPrice)}</div>
                  </div>

                  {enrolled ? (
                    isCert ? (
                      <button type="button" className="btn btn-primary w-full btn-xl" disabled style={{ opacity: 0.65, cursor: 'default' }}>
                        진행 중
                      </button>
                    ) : (
                      <Link to={`/lesson?course=${course.id}`} className="btn btn-primary w-full btn-xl">수강 계속하기 →</Link>
                    )
                  ) : isCert && !selectedInstructorId ? (
                    <button type="button" className="btn btn-gold w-full btn-xl" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                      담당 강사를 선택해주세요
                    </button>
                  ) : (
                    <Link to={checkoutLink} className="btn btn-gold w-full btn-xl">수강신청하기</Link>
                  )}

                  <div className="purchase-includes mt-16">
                    <div style={{ fontSize: '.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--t3)', marginBottom: '8px' }}>포함 내용</div>
                    {isCert ? (
                      <>
                        <div className="include-item"><span className="ic">👤</span>1:1 맞춤 수업</div>
                        <div className="include-item"><span className="ic">🏫</span>대면 &amp; 비대면 수업 가능</div>
                        <div className="include-item"><span className="ic">📜</span>수료증 발급</div>
                      </>
                    ) : (
                      <>
                        <div className="include-item"><span className="ic">🎬</span>{totalLessons}개 영상 강의 ({totalDuration})</div>
                        <div className="include-item"><span className="ic">📱</span>모바일·PC 어디서든 수강 가능</div>
                        <div className="include-item"><span className="ic">⏳</span>{formatDays(displayDays)}</div>
                      </>
                    )}
                    {course.attachments?.map((a, i) => (
                      <div key={i} className="include-item"><span className="ic">📄</span>{a.name}{a.ext ? ` (${a.ext.toUpperCase()})` : ''}</div>
                    ))}
                  </div>

                  {freeLessons > 0 && !enrolled && (
                    <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
                      <p style={{ fontSize: '.8rem', color: 'var(--t2)', marginBottom: '8px' }}>무료 미리보기 {freeLessons}강 제공</p>
                      <button className="btn btn-outline-purple w-full btn-sm"
                        onClick={() => openLesson(course.curriculum[0].items[0].id)}>
                        첫 강의 무료로 보기
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </>
  )
}
