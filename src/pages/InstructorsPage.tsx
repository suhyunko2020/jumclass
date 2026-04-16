import { Link } from 'react-router-dom'
import { useInstructors } from '../hooks/useInstructors'
import { useSiteSettings } from '../hooks/useSiteSettings'

export default function InstructorsPage() {
  const { getPublicInstructors } = useInstructors()
  const { get: getSettings } = useSiteSettings()
  const siteSettings = getSettings()
  const instructors = getPublicInstructors()

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="section-kicker">Instructor</span>
          <h1 style={{ marginTop: '10px' }}>전문 강사진</h1>
          <p>수천 건의 리딩 경험을 가진 현직 전문 타로 리더들을 소개합니다.</p>
        </div>
      </section>

      <div className="container" style={{ paddingTop: '40px', paddingBottom: '100px' }}>
        {instructors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--t2)' }}>
            등록된 강사가 없습니다.
          </div>
        ) : (
          <div className="instructor-grid">
            {instructors.map(inst => (
              <Link to={`/instructor/${inst.id}`} key={inst.id} className="inst-card">
                <div className="inst-card-photo">
                  {inst.photo
                    ? <img src={inst.photo} alt={inst.name} />
                    : <div className="inst-card-placeholder">{inst.name.charAt(0)}</div>
                  }
                  <div className="inst-card-overlay">
                    <div className="inst-card-overlay-name">{inst.name}</div>
                    <div className="inst-card-overlay-title">{inst.title}</div>
                  </div>
                </div>
                <div className="inst-card-body">
                  {/* 전문분야 */}
                  <div className="inst-card-specialties">
                    {inst.specialties.slice(0, 3).map(s => (
                      <span key={s} className="inst-tag">{s}</span>
                    ))}
                  </div>

                  {/* 하단 */}
                  <div className="inst-card-footer" style={{ marginTop: 'auto' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '.75rem' }}>
                      <span style={{ color: 'var(--t3)' }}>{inst.experience}</span>
                      {(inst.consultOnline || inst.consultOffline) && (
                        <>
                          <span style={{ color: 'var(--line-2)' }}>·</span>
                          {inst.consultOnline && inst.consultOffline ? (
                            <span style={{ color: 'var(--purple-2)' }}>온·오프라인 상담</span>
                          ) : inst.consultOnline ? (
                            <span style={{ color: 'var(--ok)' }}>온라인 상담</span>
                          ) : (
                            <span style={{ color: 'var(--warn)' }}>오프라인 상담</span>
                          )}
                        </>
                      )}
                    </div>
                    <span className="inst-card-services">{inst.services.length}개 서비스</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <span className="logo">JUMCLASS</span>
              <p>{siteSettings.brandDescription}</p>
            </div>
            <div className="footer-col">
              <h4>강의</h4>
              <Link to="/courses">전체 강의</Link>
              <Link to="/instructors">강사 소개</Link>
            </div>
            <div className="footer-col">
              <h4>플랫폼</h4>
              <Link to="/classroom">내 강의실</Link>
              <Link to="/instructors">강사 소개</Link>
            </div>
            <div className="footer-col">
              <h4>정책</h4>
              <Link to="/policy/privacy">개인정보처리방침</Link>
              <Link to="/policy/terms">이용약관</Link>
              <Link to="/policy/refund">환불 정책</Link>
              <Link to="/policy/copyright">저작권 안내</Link>
            </div>
          </div>
          <div className="footer-bottom">
            <span>{siteSettings.copyright}</span>
            <span>{siteSettings.businessInfo}</span>
          </div>
        </div>
      </footer>
    </>
  )
}
