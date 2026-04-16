import { Link } from 'react-router-dom'
import { useInstructors } from '../hooks/useInstructors'

export default function InstructorsPage() {
  const { getPublicInstructors } = useInstructors()
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
                    ? <img src={inst.photo} alt={inst.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div className="inst-card-placeholder">{inst.name.charAt(0)}</div>
                  }
                </div>
                <div className="inst-card-body">
                  <div className="inst-card-name">{inst.name}</div>
                  <div className="inst-card-title">{inst.title}</div>
                  <div className="inst-card-specialties">
                    {inst.specialties.slice(0, 3).map(s => (
                      <span key={s} className="inst-tag">{s}</span>
                    ))}
                  </div>
                  <p className="inst-card-bio">{inst.bio.slice(0, 80)}{inst.bio.length > 80 ? '...' : ''}</p>
                  <div className="inst-card-links">
                    {inst.instagram && <span className="inst-social">Instagram</span>}
                    {inst.kakao && <span className="inst-social">KakaoTalk</span>}
                  </div>
                  <div className="inst-card-footer">
                    <span className="inst-card-exp">{inst.experience}</span>
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
          <div className="footer-bottom" style={{ borderTop: 'none', paddingTop: 0 }}>
            <Link to="/" style={{ fontSize: '.95rem', fontWeight: 800, color: 'var(--t1)' }}>JUMCLASS</Link>
            <span>© 2026 JUMCLASS. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </>
  )
}
