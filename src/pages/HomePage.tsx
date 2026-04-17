import { Link } from 'react-router-dom'
import { useCourses } from '../hooks/useCourses'
import { useAuth } from '../hooks/useAuth'
import { useAuthModal } from '../components/auth/AuthModal'
import { useToast } from '../components/ui/Toast'
import CourseCard from '../components/course/CourseCard'
import { TESTIMONIALS } from '../data/courses'
import { useState } from 'react'
import HeroBg from '../components/ui/HeroBg'

export default function HomePage() {
  const { getPublicCourses, getEnrolledCount } = useCourses()
  const { openAuth } = useAuthModal()
  const { user } = useAuth()
  const toast = useToast()
  const courses = getPublicCourses().slice(0, 3)

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
            <div className="hero-kicker">타로 전문 교육 플랫폼</div>
            <h1>타로의 언어를<br /><em>내 것으로</em> 만드세요</h1>
            <p className="hero-desc">입문부터 자격증까지, 현직 리더의 영상 강의로 배우는 타로. 혼자 공부하다 막힐 때, 여기서 답을 찾으세요.</p>
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

      {/* 특징 */}
      <section className="section" style={{ background: 'rgba(255,255,255,.018)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <div className="section-header">
            <span className="section-kicker">왜 JUMCLASS인가</span>
            <h2>이런 점이 다릅니다</h2>
            <p>독학이 어려운 타로, 제대로 배울 수 있는 환경을 만들었습니다.</p>
          </div>
          <div className="feat-grid">
            {[
              { ic: '🎬', t: 'HD 영상 강의', d: '촬영 퀄리티에 신경 쓴 깨끗한 영상. PC, 모바일 어디서든 수강 가능합니다.' },
              { ic: '📜', t: '자격증 과정', d: '수료 후 바로 활동할 수 있는 전문 리더 자격증 과정을 운영합니다.' },
              { ic: '🔮', t: '현직 강사진', d: '실제 리딩 현장에서 활동 중인 강사들이 직접 가르칩니다.' },
              { ic: '⏳', t: '넉넉한 수강 기간', d: '한 번 결제하면 수강 기간 내 무제한 반복. 업데이트 영상도 추가 비용 없이 제공.' },
              { ic: '📱', t: '어디서든 수강', d: 'PC, 태블릿, 스마트폰 — 기기 제한 없이 이어서 볼 수 있습니다.' },
              { ic: '📎', t: '학습 자료 포함', d: 'PDF 자료, 워크시트, 저널링 템플릿이 강의에 포함되어 있습니다.' },
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
            <h2>수강생들의 이야기</h2>
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
            padding: 'clamp(32px, 5vw, 56px) clamp(20px, 4vw, 48px)', textAlign: 'center', borderRadius: 'var(--r4)',
            background: 'var(--bg-3)', border: '1px solid var(--line)', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: '-100px', left: '-80px', width: '320px', height: '320px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(124,111,205,.12) 0%,transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-80px', right: '-60px', width: '260px', height: '260px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(201,168,76,.09) 0%,transparent 70%)', pointerEvents: 'none' }} />
            <span className="section-kicker">{user ? '다음 강의' : '시작하기'}</span>
            <h2 style={{ fontSize: 'clamp(1.7rem,3.5vw,2.4rem)', fontWeight: 800, letterSpacing: '-.03em', margin: '12px 0 14px' }}>
              {user ? '다음 강의를 찾고 계신가요?' : '타로, 한번 배워볼까요?'}
            </h2>
            <p style={{ color: 'var(--t2)', maxWidth: '420px', margin: '0 auto 28px', lineHeight: 1.75 }}>
              {user ? '새로운 강의가 기다리고 있습니다.' : '회원가입 후 무료 미리보기 강의를 바로 들어보세요.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {user ? (
                <>
                  <Link to="/courses" className="btn btn-gold btn-xl">강의 둘러보기 →</Link>
                  <Link to="/classroom" className="btn btn-ghost btn-xl">내 강의실</Link>
                </>
              ) : (
                <>
                  <button className="btn btn-gold btn-xl" onClick={() => openAuth('signup')}>무료 회원가입</button>
                  <Link to="/courses" className="btn btn-ghost btn-xl">강의 보기</Link>
                </>
              )}
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

    </>
  )
}
