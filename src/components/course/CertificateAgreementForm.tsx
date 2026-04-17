import { useState } from 'react'
import SignaturePad from './SignaturePad'
import { CERTIFICATE_AGREEMENT } from '../../data/certificateAgreement'

export interface AgreementFormValue {
  name: string
  birthdate: string        // YYYY-MM-DD
  phone: string
  signatureDataUrl: string | null
}

interface Props {
  value: AgreementFormValue
  onChange: (v: AgreementFormValue) => void
}

export default function CertificateAgreementForm({ value, onChange }: Props) {
  const [agreementOpen, setAgreementOpen] = useState(false)
  const a = CERTIFICATE_AGREEMENT

  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: 'var(--r2)',
      background: 'rgba(6,7,15,.6)',
      border: '1px solid rgba(255,255,255,.06)',
    }}>
      <div style={{ fontSize: '.88rem', fontWeight: 700, color: 'var(--t1)', marginBottom: '4px' }}>
        자격증 수강 동의서 서명
      </div>
      <div style={{ fontSize: '.74rem', color: 'var(--t3)', marginBottom: '12px' }}>
        민간자격 취득을 위한 교육훈련·자격검정 계약 체결을 위해 아래 정보와 서명이 필요합니다.
      </div>

      {/* 약관 본문 (토글) */}
      <div style={{
        background: 'rgba(0,0,0,.28)',
        border: '1px solid rgba(255,255,255,.06)',
        borderRadius: 'var(--r2)',
        marginBottom: '14px',
        overflow: 'hidden',
      }}>
        <button
          type="button"
          onClick={() => setAgreementOpen(o => !o)}
          style={{
            width: '100%', padding: '10px 12px', textAlign: 'left',
            background: 'transparent', border: 'none', color: 'var(--t1)',
            fontSize: '.82rem', fontWeight: 600, cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>{a.title} (버전 {a.version})</span>
          <span style={{ fontSize: '.72rem', color: 'var(--t3)' }}>
            {agreementOpen ? '접기 ▲' : '본문 보기 ▼'}
          </span>
        </button>
        {agreementOpen && (
          <div style={{
            maxHeight: '320px', overflowY: 'auto',
            padding: '12px 14px',
            borderTop: '1px solid rgba(255,255,255,.06)',
            fontSize: '.78rem', color: 'var(--t2)', lineHeight: 1.7,
          }}>
            <p style={{ marginBottom: '12px' }}>{a.preamble}</p>
            {a.chapters.map((ch, ci) => (
              <div key={ci} style={{ marginBottom: '14px' }}>
                <div style={{ fontWeight: 700, color: 'var(--t1)', margin: '10px 0 6px' }}>
                  {ch.title}
                </div>
                {ch.articles.map((art, ai) => (
                  <div key={ai} style={{ marginBottom: '10px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--t1)', marginBottom: '3px' }}>
                      {art.number} [{art.subject}]
                    </div>
                    {art.paragraphs.map((p, pi) => (
                      <p key={pi} style={{ whiteSpace: 'pre-wrap', margin: '2px 0' }}>{p}</p>
                    ))}
                  </div>
                ))}
              </div>
            ))}
            {a.closing.map((c, i) => (
              <p key={i} style={{ margin: '8px 0' }}>{c}</p>
            ))}
          </div>
        )}
      </div>

      {/* 입력 필드 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '.74rem', color: 'var(--t3)', marginBottom: '4px' }}>
            성명 <span style={{ color: 'var(--fail)' }}>*</span>
          </label>
          <input
            type="text"
            value={value.name}
            onChange={e => onChange({ ...value, name: e.target.value })}
            placeholder="실명 입력"
            style={{
              width: '100%', padding: '10px 12px',
              background: 'rgba(6,7,15,.4)', border: '1px solid var(--line)',
              borderRadius: 'var(--r2)', color: 'var(--t1)', fontSize: '.88rem',
              outline: 'none',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '.74rem', color: 'var(--t3)', marginBottom: '4px' }}>
            생년월일 <span style={{ color: 'var(--fail)' }}>*</span>
          </label>
          <input
            type="date"
            value={value.birthdate}
            onChange={e => onChange({ ...value, birthdate: e.target.value })}
            style={{
              width: '100%', padding: '10px 12px',
              background: 'rgba(6,7,15,.4)', border: '1px solid var(--line)',
              borderRadius: 'var(--r2)', color: 'var(--t1)', fontSize: '.88rem',
              outline: 'none',
              colorScheme: 'dark',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '.74rem', color: 'var(--t3)', marginBottom: '4px' }}>
            연락처 <span style={{ color: 'var(--fail)' }}>*</span>
          </label>
          <input
            type="tel"
            value={value.phone}
            onChange={e => onChange({ ...value, phone: e.target.value })}
            placeholder="010-0000-0000"
            style={{
              width: '100%', padding: '10px 12px',
              background: 'rgba(6,7,15,.4)', border: '1px solid var(--line)',
              borderRadius: 'var(--r2)', color: 'var(--t1)', fontSize: '.88rem',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* 서명 */}
      <div>
        <label style={{ display: 'block', fontSize: '.74rem', color: 'var(--t3)', marginBottom: '6px' }}>
          서명 <span style={{ color: 'var(--fail)' }}>*</span>
        </label>
        <SignaturePad
          onChange={dataUrl => onChange({ ...value, signatureDataUrl: dataUrl })}
        />
      </div>

      <div style={{
        marginTop: '14px', padding: '10px 12px',
        background: 'rgba(232,156,56,.06)', border: '1px solid rgba(232,156,56,.2)',
        borderRadius: 'var(--r2)', fontSize: '.74rem', color: 'var(--t2)', lineHeight: 1.6,
      }}>
        서명을 완료하면 위 약관 전문에 동의한 것으로 간주되며,
        서명 이미지와 약관 본문이 함께 보관되어 추후 분쟁 시 증빙 자료로 활용될 수 있습니다.
      </div>
    </div>
  )
}
