import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useCourses } from '../hooks/useCourses'
import { useInstructors } from '../hooks/useInstructors'
import { getProgressPage, updateProgressPage } from '../utils/storage'
import type { InstructorProgressPage as ProgressPage } from '../data/types'

export default function InstructorProgressPageView() {
  const { token } = useParams<{ token: string }>()
  const { getCourse } = useCourses()
  const { getInstructor } = useInstructors()

  const [page, setPage] = useState<ProgressPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    document.title = '진도 관리 — JUMCLASS'
    if (!token) { setNotFound(true); setLoading(false); return }
    getProgressPage(token).then(p => {
      if (!p) { setNotFound(true) } else { setPage(p) }
      setLoading(false)
    })
  }, [token])

  if (loading) {
    return (
      <div className="loading" style={{ paddingTop: '120px' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (notFound || !page) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ textAlign: 'center', maxWidth: '360px' }}>
          <div style={{ fontSize: '2.4rem', marginBottom: '12px' }}>🔒</div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '8px' }}>접근할 수 없는 페이지입니다</h2>
          <p style={{ fontSize: '.86rem', color: 'var(--t2)', lineHeight: 1.6 }}>
            유효하지 않거나 만료된 링크입니다.<br />
            진도 관리가 필요하다면 운영자에게 문의해주세요.
          </p>
        </div>
      </div>
    )
  }

  const expired = page.expiresAt ? new Date(page.expiresAt).getTime() < Date.now() : false
  if (expired) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ textAlign: 'center', maxWidth: '360px' }}>
          <div style={{ fontSize: '2.4rem', marginBottom: '12px' }}>⏰</div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '8px' }}>만료된 페이지입니다</h2>
          <p style={{ fontSize: '.86rem', color: 'var(--t2)', lineHeight: 1.6 }}>
            모든 진도가 완료되어 수강 종료 7일 뒤 자동 만료되었습니다.<br />
            관리자 측에는 진도 기록이 그대로 보관됩니다.
          </p>
        </div>
      </div>
    )
  }

  const course = getCourse(page.courseId)
  const instructor = getInstructor(page.instructorId)

  const checkedCount = page.checklist.filter(i => i.checked).length
  const totalCount = page.checklist.length
  const progressPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0
  const allChecked = totalCount > 0 && checkedCount === totalCount

  async function save(next: ProgressPage) {
    setSaving(true)
    const prevAllChecked = !!page!.completedAt
    const nextAllChecked = next.checklist.length > 0 && next.checklist.every(i => i.checked)

    const updates: Parameters<typeof updateProgressPage>[1] = {
      checklist: next.checklist,
      notes: next.notes,
    }

    if (nextAllChecked && !prevAllChecked) {
      const now = new Date()
      const expiry = new Date(now.getTime() + 7 * 86400000)
      updates.completedAt = now.toISOString()
      updates.expiresAt = expiry.toISOString()
      next.completedAt = updates.completedAt as string
      next.expiresAt = updates.expiresAt as string
    } else if (!nextAllChecked && prevAllChecked) {
      updates.completedAt = null
      updates.expiresAt = null
      next.completedAt = undefined
      next.expiresAt = undefined
    }

    const ok = await updateProgressPage(next.id, updates)
    if (ok) {
      setPage({ ...next, updatedAt: new Date().toISOString() })
      setSavedAt(Date.now())
    }
    setSaving(false)
  }

  function toggleItem(id: string) {
    if (!page) return
    const nextChecklist = page.checklist.map(i =>
      i.id === id ? { ...i, checked: !i.checked, checkedAt: !i.checked ? new Date().toISOString() : undefined } : i
    )
    save({ ...page, checklist: nextChecklist })
  }

  function updateItemTitle(id: string, title: string) {
    if (!page) return
    const nextChecklist = page.checklist.map(i => i.id === id ? { ...i, title } : i)
    setPage({ ...page, checklist: nextChecklist })
  }

  function commitItemTitle() {
    if (!page) return
    save(page)
  }

  function updateNotes(notes: string) {
    if (!page) return
    setPage({ ...page, notes })
  }

  function commitNotes() {
    if (!page) return
    save(page)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', padding: '16px 14px 40px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        {/* 헤더 */}
        <div style={{ marginBottom: '16px', padding: '16px', background: 'var(--glass-1)', border: '1px solid var(--line)', borderRadius: 'var(--r3)' }}>
          <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--purple-2)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
            진도 관리
          </div>
          <h1 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-.02em', marginBottom: '4px' }}>
            {course?.title ?? '자격증 과정'}
          </h1>
          <div style={{ fontSize: '.78rem', color: 'var(--t3)' }}>
            담당 강사: <strong style={{ color: 'var(--t2)' }}>{instructor?.name ?? '-'}</strong>
          </div>
        </div>

        {/* 진도 진행 바 */}
        <div style={{ marginBottom: '16px', padding: '14px 16px', background: 'var(--glass-1)', border: '1px solid var(--line)', borderRadius: 'var(--r3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '.82rem', fontWeight: 700 }}>진행률</span>
            <span style={{ fontSize: '.82rem', fontWeight: 700, color: allChecked ? 'var(--ok)' : 'var(--t1)' }}>
              {checkedCount}/{totalCount} ({progressPct}%)
            </span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,.06)', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{
              width: `${progressPct}%`, height: '100%',
              background: allChecked ? 'var(--ok)' : 'var(--purple)',
              borderRadius: '99px', transition: 'width .3s',
            }} />
          </div>
          {allChecked && (
            <div style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(52,196,124,.08)', border: '1px solid rgba(52,196,124,.2)', borderRadius: 'var(--r2)', fontSize: '.76rem', color: 'var(--ok)', lineHeight: 1.6 }}>
              ✓ 모든 진도가 완료되었습니다.<br />
              진도 체크는 더 이상 변경할 수 없으며, 이 페이지는 7일 후 자동으로 만료됩니다.
            </div>
          )}
        </div>

        {/* 체크리스트 */}
        <div style={{ marginBottom: '16px', padding: '14px 16px', background: 'var(--glass-1)', border: '1px solid var(--line)', borderRadius: 'var(--r3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '.82rem', fontWeight: 700 }}>체크리스트</div>
            {!allChecked && (
              <div style={{ fontSize: '.68rem', color: 'var(--t3)' }}>
                텍스트를 탭하면 수정할 수 있어요
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {page.checklist.map((item) => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px',
                background: item.checked ? 'rgba(52,196,124,.06)' : 'rgba(255,255,255,.02)',
                border: `1px solid ${item.checked ? 'rgba(52,196,124,.2)' : 'var(--line)'}`,
                borderRadius: 'var(--r2)',
              }}>
                <input
                  type="checkbox"
                  checked={item.checked}
                  disabled={allChecked}
                  onChange={() => toggleItem(item.id)}
                  style={{
                    width: '18px', height: '18px',
                    accentColor: 'var(--ok)',
                    cursor: allChecked ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                    opacity: allChecked ? 0.7 : 1,
                  }}
                />
                <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={item.title}
                    onChange={e => updateItemTitle(item.id, e.target.value)}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = 'transparent'
                      e.currentTarget.style.background = 'transparent'
                      commitItemTitle()
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = 'rgba(124,111,205,.5)'
                      e.currentTarget.style.background = 'rgba(124,111,205,.08)'
                    }}
                    placeholder="항목 제목"
                    style={{
                      width: '100%', outline: 'none',
                      background: 'transparent',
                      border: '1px solid transparent',
                      borderRadius: 'var(--r1)',
                      padding: '6px 28px 6px 8px',
                      fontSize: '.88rem',
                      color: item.checked ? 'var(--t3)' : 'var(--t1)',
                      textDecoration: item.checked ? 'line-through' : 'none',
                      transition: 'border-color .15s, background .15s',
                      fontFamily: 'inherit',
                    }}
                  />
                  {!item.checked && (
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute', right: '8px',
                        fontSize: '.78rem', color: 'var(--t3)',
                        opacity: 0.45, pointerEvents: 'none',
                      }}
                    >✎</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 메모 */}
        <div style={{ marginBottom: '16px', padding: '14px 16px', background: 'var(--glass-1)', border: '1px solid var(--line)', borderRadius: 'var(--r3)' }}>
          <div style={{ fontSize: '.82rem', fontWeight: 700, marginBottom: '10px' }}>강사 메모</div>
          <textarea
            value={page.notes}
            onChange={e => updateNotes(e.target.value)}
            onBlur={commitNotes}
            placeholder="수강생별 특이사항이나 진행 기록을 자유롭게 남겨주세요."
            rows={6}
            style={{
              width: '100%', padding: '10px 12px', resize: 'vertical',
              background: 'rgba(6,7,15,.5)', border: '1px solid var(--line)',
              borderRadius: 'var(--r2)', color: 'var(--t1)', fontSize: '.88rem',
              lineHeight: 1.6, fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>

        {/* 저장 상태 / 안내 */}
        <div style={{ textAlign: 'center', fontSize: '.74rem', color: 'var(--t3)' }}>
          {saving ? '저장 중…' : savedAt ? '변경 사항이 자동 저장되었습니다.' : '입력 후 포커스를 벗어나면 자동 저장됩니다.'}
        </div>
        <div style={{ textAlign: 'center', fontSize: '.72rem', color: 'var(--t3)', marginTop: '14px' }}>
          수강생: {page.userId.slice(0, 8)}… · 마지막 수정: {new Date(page.updatedAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
        </div>
      </div>
    </div>
  )
}
