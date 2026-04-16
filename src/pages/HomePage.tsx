import { Link } from 'react-router-dom'
import { useCourses } from '../hooks/useCourses'
import { useAuthModal } from '../components/auth/AuthModal'
import { useToast } from '../components/ui/Toast'
import CourseCard from '../components/course/CourseCard'
import { TESTIMONIALS } from '../data/courses'
import { useState } from 'react'
import HeroBg from '../components/ui/HeroBg'

export default function HomePage() {
  const { getAllCourses, getEnrolledCount } = useCourses()
  const { openAuth } = useAuthModal()
  const toast = useToast()
  const courses = getAllCourses().slice(0, 3)

  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' })

  function handleContact(e: React.FormEvent) {
    e.preventDefault()
    toast('문의가 접수됐습니다. 24시간 내로 답변드릴게요 ✦', 'ok')
    setContactForm({ name: '', email: '', message: '' })
  }

  return (
    <>
      {/* Hero */}
      <section className="hero" style={{ position: 'relative', overflow: 'hidden' }}>
        <HeroBg />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="hero-inner page-enter">
            <div className="hero-kicker">✦ &nbsp;국내 1위 타로 강의 플랫폼</div>
            <h1>타로의 언어를<br /><em>내 것으로</em> 만드세요</h1>
            <p className="hero-desc">전문 강사의 HD 영상 강의로 입문부터 공인 자격증까지. 체계적인 커리큘럼으로 진짜 타로 실력을 키우세요.</p>
            <div className="hero-cta">
              <Link to="/courses" className="btn btn-gold btn-xl">강의 둘러보기 →</Link>
              <button className="btn btn-ghost btn-xl" onClick={() => openAuth('signup')}>무료로 시작하기</button>
            </div>
            <div className="hero-stats">
              <div className="hero-stat"><div className="num">3,800+</div><div className="lbl">수강생</div></div>
              <div className="hero-stat"><div className="num">4</div><div className="lbl">전문 강사</div></div>
              <div className="hero-stat"><div className="num">98강</div><div className="lbl">총 강의</div></div>
              <div className="hero-stat"><div className="num">4.9★</div><div className="lbl">평균 평점</div></div>
            </div>
          </div>
        </div>
        <div className="hero-glow" />
      </section>

      {/* 인기 강의 */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-kicker">인기 강의</span>
            <h2>지금 가장 많이 듣는 강의</h2>
            <p>체계적인 영상 강의로 타로 입문부터 자격증까지 한 번에 해결하세요.</p>
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

      {/* 특징 */}
      <section className="section" style={{ background: 'rgba(255,255,255,.018)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <div className="section-header">
            <span className="section-kicker">JUMCLASS가 다른 이유</span>
            <h2>제대로 된 타로 교육의 기준</h2>
            <p>수천 명의 수강생이 선택한 방법으로 타로를 배우세요.</p>
          </div>
          <div className="feat-grid">
            {[
              { ic: '🎬', t: '고화질 영상 강의', d: '전문 스튜디오에서 제작된 선명한 HD 강의. PC, 모바일 어디서든 편하게 수강하세요.' },
              { ic: '📜', t: '공인 자격증 과정', d: '타로 업계에서 인정받는 전문 리더 자격증 과정. 수료 후 바로 활동 가능합니다.' },
              { ic: '🔮', t: '10년+ 현직 강사진', d: '수천 번의 실제 리딩 경험을 가진 현직 전문 리더들이 직접 가르칩니다.' },
              { ic: '⏳', t: '365일 무제한 수강', d: '한 번 결제로 1년간 무제한 반복 수강. 업데이트된 콘텐츠도 추가 비용 없이 제공됩니다.' },
              { ic: '📱', t: '모바일 최적화', d: 'PC, 태블릿, 스마트폰 어디서든 끊김 없이 수강할 수 있습니다.' },
              { ic: '📎', t: '학습 자료 제공', d: '모든 강의에 PDF 참고 자료, 워크시트, 저널링 템플릿이 포함되어 있습니다.' },
            ].map(f => (
              <div key={f.t} className="feat-card">
                <span className="feat-ic">{f.ic}</span>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 후기 */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-kicker">수강생 후기</span>
            <h2>실제 수강생의 변화</h2>
          </div>
          <div className="testi-grid">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="testi-card">
                <p className="testi-quote">"{t.quote}"</p>
                <div className="testi-author">
                  <div className="testi-av">{t.avatar}</div>
                  <div>
                    <div className="testi-name">{t.name}</div>
                    <div className="testi-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA 배너 */}
      <section style={{ padding: '16px 0 80px' }}>
        <div className="container">
          <div style={{
            padding: '56px 48px', textAlign: 'center', borderRadius: 'var(--r4)',
            background: 'var(--bg-3)', border: '1px solid var(--line)', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: '-100px', left: '-80px', width: '320px', height: '320px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(124,111,205,.12) 0%,transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-80px', right: '-60px', width: '260px', height: '260px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(201,168,76,.09) 0%,transparent 70%)', pointerEvents: 'none' }} />
            <span className="section-kicker">지금 시작하세요</span>
            <h2 style={{ fontSize: 'clamp(1.7rem,3.5vw,2.4rem)', fontWeight: 800, letterSpacing: '-.03em', margin: '12px 0 14px' }}>타로를 배울 준비가 됐나요?</h2>
            <p style={{ color: 'var(--t2)', maxWidth: '420px', margin: '0 auto 28px', lineHeight: 1.75 }}>3,800명이 선택한 JUMCLASS에서 첫 강의를 무료로 시작하세요.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-gold btn-xl" onClick={() => openAuth('signup')}>무료 회원가입</button>
              <Link to="/courses" className="btn btn-ghost btn-xl">강의 보기</Link>
            </div>
          </div>
        </div>
      </section>

      {/* 문의 */}
      <section className="section" id="contact" style={{ paddingTop: 0 }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
            <div>
              <span className="section-kicker">문의</span>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-.03em', margin: '12px 0 14px' }}>궁금한 점이 있으신가요?</h2>
              <p style={{ color: 'var(--t2)', marginBottom: '22px', lineHeight: 1.75 }}>어떤 강의를 들어야 할지 모르겠거나 강의 관련 문의가 있으시면 언제든 연락 주세요. 24시간 내로 답변드립니다.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '.875rem', color: 'var(--t2)' }}>📧 &nbsp;hello@jumclass.kr</div>
                <div style={{ fontSize: '.875rem', color: 'var(--t2)' }}>💬 &nbsp;평일 오전 9시 – 오후 6시 (채팅 상담)</div>
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
              <button type="submit" className="btn btn-primary w-full">문의 보내기</button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <span className="logo">JUMCLASS</span>
              <p>타로를 제대로 배우고 싶은 분들을 위한 프리미엄 인터넷 강의 플랫폼. 전문 강사진과 체계적인 커리큘럼으로 진짜 실력을 키우세요.</p>
            </div>
            <div className="footer-col">
              <h4>강의</h4>
              {getAllCourses().map(c => <Link key={c.id} to={`/course/${c.id}`}>{c.title}</Link>)}
            </div>
            <div className="footer-col">
              <h4>플랫폼</h4>
              <Link to="/classroom">내 강의실</Link>
              <button style={{ textAlign: 'left', fontSize: '.83rem', color: 'var(--t2)', display: 'block', marginBottom: '9px' }} onClick={() => openAuth('signup')}>무료 시작</button>
              <a href="#contact">문의</a>
            </div>
            <div className="footer-col">
              <h4>정책</h4>
              <a href="#">개인정보처리방침</a>
              <a href="#">이용약관</a>
              <a href="#">환불 정책</a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 JUMCLASS. All rights reserved.</span>
            <span>사업자등록번호: 000-00-00000</span>
          </div>
        </div>
      </footer>
    </>
  )
}
