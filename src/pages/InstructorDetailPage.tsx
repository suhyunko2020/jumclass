import { useParams, Link, useNavigate } from 'react-router-dom'
import { useInstructors } from '../hooks/useInstructors'
import { useCourses } from '../hooks/useCourses'
import { formatPrice, discountRate, calcTotalDuration } from '../utils/format'
import { useAuthModal } from '../components/auth/AuthModal'
import { useAuth } from '../hooks/useAuth'

export default function InstructorDetailPage() {
  const { instructorId } = useParams<{ instructorId: string }>()
  const { getInstructor } = useInstructors()
  const { getCourse } = useCourses()
  const { openAuth } = useAuthModal()
  const { user } = useAuth()
  const navigate = useNavigate()

  const inst = getInstructor(instructorId || '')

  if (!inst) {
    return (
      <div className="auth-gate" style={{ paddingTop: '140px' }}>
        <h2>강사를 찾을 수 없습니다</h2>
        <Link to="/instructors" className="btn btn-primary mt-16">강사 목록으로</Link>
      </div>
    )
  }

  const linkedCourses = inst.courseIds.map(id => getCourse(id)).filter(Boolean)

  function handleServiceClick(serviceId: string) {
    if (!user) { openAuth('login'); return }
    navigate(`/checkout?instructor=${inst!.id}&service=${serviceId}`)
  }

  return (
    <>
      <div className="detail-page-wrap">
        <div className="container">
          <div className="inst-detail-layout">
            {/* 좌측: 프로필 */}
            <div className="inst-detail-left">
              <div className="inst-detail-photo">
                {inst.photo
                  ? <img src={inst.photo} alt={inst.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--r3)' }} />
                  : <div className="inst-card-placeholder" style={{ width: '100%', height: '280px', fontSize: '4rem' }}>{inst.name.charAt(0)}</div>
                }
              </div>

              <div className="inst-detail-info">
                <h1 className="inst-detail-name">{inst.name}</h1>
                <div className="inst-detail-title">{inst.title}</div>
                <div className="inst-detail-exp">{inst.experience}</div>

                {/* 연락처 */}
                <div className="inst-detail-contacts">
                  {inst.phone && (
                    <a href={`tel:${inst.phone.replace(/[^0-9+]/g, '')}`} className="inst-contact-btn">
                      <span className="inst-contact-label" style={{ color: 'var(--ok)' }}>Phone</span>
                      <span className="inst-contact-value">{inst.phone}</span>
                    </a>
                  )}
                  {inst.instagram && (
                    <a href={`https://instagram.com/${inst.instagram.replace('@', '')}`}
                      target="_blank" rel="noopener noreferrer" className="inst-contact-btn">
                      <span className="inst-contact-label" style={{ background: 'linear-gradient(135deg, #E1306C, #F77737)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Instagram</span>
                      <span className="inst-contact-value">{inst.instagram}</span>
                    </a>
                  )}
                  {inst.kakao && (
                    <a href={inst.kakao} target="_blank" rel="noopener noreferrer" className="inst-contact-btn">
                      <span className="inst-contact-label" style={{ color: '#FEE500' }}>KakaoTalk</span>
                      <span className="inst-contact-value">오픈채팅 바로가기</span>
                    </a>
                  )}
                </div>

                {/* 상담 가능 여부 */}
                {(inst.consultOnline || inst.consultOffline) && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--t3)', marginBottom: '8px', letterSpacing: '.06em', textTransform: 'uppercase' }}>상담 방식</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {inst.consultOnline && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: 'var(--r2)', background: 'rgba(52,196,124,.06)', border: '1px solid rgba(52,196,124,.15)' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--ok)', flexShrink: 0 }} />
                          <span style={{ fontSize: '.82rem', color: 'var(--t1)' }}>온라인 상담 가능</span>
                        </div>
                      )}
                      {inst.consultOffline && (
                        <div style={{ borderRadius: 'var(--r2)', background: 'rgba(124,111,205,.06)', border: '1px solid rgba(124,111,205,.15)', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--purple-2)', flexShrink: 0 }} />
                            <span style={{ fontSize: '.82rem', color: 'var(--t1)' }}>오프라인 상담 가능</span>
                          </div>
                          {inst.offlineAddress && (
                            <>
                              <div style={{ padding: '0 12px 10px', fontSize: '.8rem', color: 'var(--t2)' }}>{inst.offlineAddress}</div>
                              <a href={`https://map.naver.com/p/search/${encodeURIComponent(inst.offlineAddress)}`}
                                target="_blank" rel="noopener noreferrer"
                                style={{ display: 'block', borderTop: '1px solid rgba(124,111,205,.1)' }}>
                                <iframe
                                  title="지도"
                                  style={{ width: '100%', height: '180px', border: 'none', pointerEvents: 'none' }}
                                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(inst.offlineAddress)}&layer=mapnik`}
                                />
                                <div style={{ padding: '8px 12px', fontSize: '.78rem', color: 'var(--purple-2)', fontWeight: 600, textAlign: 'center' }}>
                                  네이버 지도에서 보기 →
                                </div>
                              </a>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 전문 분야 */}
                <div style={{ marginTop: '20px' }}>
                  <div style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--t3)', marginBottom: '8px', letterSpacing: '.06em', textTransform: 'uppercase' }}>전문 분야</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {inst.specialties.map(s => <span key={s} className="inst-tag">{s}</span>)}
                  </div>
                </div>
              </div>
            </div>

            {/* 우측: 소개 + 서비스 + 연관 강의 */}
            <div className="inst-detail-right">
              {/* 소개 */}
              <div className="inst-section">
                <div className="inst-section-title">강사 소개</div>
                <p style={{ fontSize: '.9rem', color: 'var(--t2)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{inst.bio}</p>
              </div>

              {/* 서비스/상품 */}
              {inst.services.length > 0 && (
                <div className="inst-section">
                  <div className="inst-section-title">서비스 / 상품 ({inst.services.length})</div>
                  <div className="inst-services">
                    {inst.services.map(svc => {
                      const dr = discountRate(svc.originalPrice, svc.price)
                      return (
                        <div key={svc.id} className="inst-svc-card">
                          <div className="inst-svc-top">
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span className="inst-svc-type">{
                                svc.type === 'consultation' ? '상담' :
                                svc.type === 'reading' ? '리딩' :
                                svc.type === 'lesson' ? '레슨' : '기타'
                              }</span>
                              {svc.mode && (
                                <span style={{ fontSize: '.68rem', fontWeight: 600, padding: '2px 7px', borderRadius: 'var(--pill)', background: svc.mode === 'online' ? 'rgba(52,196,124,.08)' : svc.mode === 'offline' ? 'rgba(232,156,56,.08)' : 'rgba(124,111,205,.08)', color: svc.mode === 'online' ? 'var(--ok)' : svc.mode === 'offline' ? 'var(--warn)' : 'var(--purple-2)' }}>
                                  {svc.mode === 'online' ? '비대면(Zoom)' : svc.mode === 'offline' ? '대면' : '대면&비대면(Zoom)'}
                                </span>
                              )}
                            </div>
                            <span className="inst-svc-dur">{svc.duration}</span>
                          </div>
                          <div className="inst-svc-title">{svc.title}</div>
                          <p className="inst-svc-desc">{svc.description}</p>
                          <div className="inst-svc-bottom">
                            <div>
                              {svc.originalPrice > svc.price && (
                                <span style={{ fontSize: '.78rem', color: 'var(--t3)', textDecoration: 'line-through', marginRight: '6px' }}>{formatPrice(svc.originalPrice)}</span>
                              )}
                              <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{formatPrice(svc.price)}</span>
                              {dr > 0 && <span style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--ok)', marginLeft: '6px' }}>{dr}%</span>}
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={() => handleServiceClick(svc.id)}>
                              신청하기
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 연관 강의 */}
              {linkedCourses.length > 0 && (
                <div className="inst-section">
                  <div className="inst-section-title">담당 강의</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {linkedCourses.map(c => c && (
                      <Link to={`/course/${c.id}`} key={c.id} className="inst-course-link">
                        <span style={{ fontSize: '1.6rem' }}>{c.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '.9rem' }}>{c.title}</div>
                          <div style={{ fontSize: '.78rem', color: 'var(--t3)' }}>{c.level} · {c.lessons}강 · {calcTotalDuration(c.curriculum)}</div>
                        </div>
                        <span style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--gold)' }}>{formatPrice(c.price)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="footer" style={{ marginTop: 0 }}>
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
