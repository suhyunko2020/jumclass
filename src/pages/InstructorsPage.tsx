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
                    ? <img src={inst.photo} alt={inst.name} />
                    : <div className="inst-card-placeholder">{inst.name.charAt(0)}</div>
                  }
                  <div className="inst-card-overlay">
                    <div className="inst-card-overlay-name">{inst.name}</div>
                    <div className="inst-card-overlay-title">{inst.title}</div>
                  </div>
                </div>
                <div className="inst-card-body">
                  {/* 전문분야 + 경력 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div className="inst-card-specialties" style={{ marginBottom: 0 }}>
                      {inst.specialties.slice(0, 3).map(s => (
                        <span key={s} className="inst-tag">{s}</span>
                      ))}
                    </div>
                    <span style={{ fontSize: '.75rem', color: 'var(--t3)', flexShrink: 0 }}>{inst.experience}</span>
                  </div>

                  {/* 연락처 + 상담 아이콘 라인 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '.78rem', color: 'var(--t3)', marginBottom: '12px' }}>
                    {inst.phone && <span style={{ color: 'var(--ok)' }}>Phone</span>}
                    {inst.instagram && <span style={{ background: 'linear-gradient(135deg, #E1306C, #F77737)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Instagram</span>}
                    {inst.kakao && <span style={{ color: '#FEE500' }}>KakaoTalk</span>}
                  </div>

                  {/* 하단: 상담 방식 + 서비스 수 */}
                  <div className="inst-card-footer">
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {inst.consultOnline && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '.72rem', color: 'var(--ok)' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--ok)' }} />온라인
                        </span>
                      )}
                      {inst.consultOffline && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '.72rem', color: 'var(--purple-2)' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--purple-2)' }} />오프라인
                        </span>
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
          <div className="footer-bottom" style={{ borderTop: 'none', paddingTop: 0 }}>
            <Link to="/" style={{ fontSize: '.95rem', fontWeight: 800, color: 'var(--t1)' }}>JUMCLASS</Link>
            <span>© 2026 JUMCLASS. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </>
  )
}
