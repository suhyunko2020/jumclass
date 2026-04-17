import { useEffect, useRef, useState } from 'react'

interface Props {
  onChange: (dataUrl: string | null) => void
  height?: number
}

// 터치/마우스로 서명을 받고 PNG data URL로 반환
export default function SignaturePad({ onChange, height = 180 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastRef = useRef<{ x: number; y: number } | null>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    let lastWidth = 0
    const resize = () => {
      const ratio = window.devicePixelRatio || 1
      const width = parent.clientWidth
      // 폭이 0이거나 이전과 동일하면 불필요한 재드로우 방지
      if (width === 0 || width === lastWidth) return
      lastWidth = width
      canvas.width = width * ratio
      canvas.height = height * ratio
      canvas.style.width = width + 'px'
      canvas.style.height = height + 'px'
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(ratio, ratio)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#0b0b12'
        ctx.lineWidth = 2.2
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
      }
    }
    resize()
    // grid 레이아웃 변경처럼 window resize 없이 부모 폭만 바뀌는 경우도 감지
    const ro = new ResizeObserver(resize)
    ro.observe(parent)
    window.addEventListener('resize', resize)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [height])

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handleStart(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    drawingRef.current = true
    lastRef.current = getPos(e)
  }

  function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    const last = lastRef.current
    if (!last) { lastRef.current = pos; return }
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastRef.current = pos
    if (isEmpty) setIsEmpty(false)
  }

  function handleEnd() {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastRef.current = null
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    onChange(dataUrl)
  }

  function clear() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const width = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.clearRect(0, 0, width, h)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, h)
    setIsEmpty(true)
    onChange(null)
  }

  return (
    <div>
      <div style={{
        width: '100%',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r2)',
        background: '#ffffff',
        overflow: 'hidden',
        position: 'relative',
        touchAction: 'none',
      }}>
        <canvas
          ref={canvasRef}
          onPointerDown={handleStart}
          onPointerMove={handleMove}
          onPointerUp={handleEnd}
          onPointerCancel={handleEnd}
          onPointerLeave={handleEnd}
          style={{ display: 'block', width: '100%', height: `${height}px`, cursor: 'crosshair' }}
        />
        {isEmpty && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
            color: '#9aa0a6', fontSize: '.85rem',
          }}>
            여기에 서명해주세요
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
        <span style={{ fontSize: '.72rem', color: 'var(--t3)' }}>
          손가락 또는 마우스로 서명해주세요
        </span>
        <button
          type="button"
          onClick={clear}
          style={{
            fontSize: '.74rem', padding: '4px 10px',
            background: 'rgba(255,255,255,.04)',
            border: '1px solid var(--line)', borderRadius: 'var(--r1)',
            color: 'var(--t2)', cursor: 'pointer',
          }}
        >
          다시 쓰기
        </button>
      </div>
    </div>
  )
}
