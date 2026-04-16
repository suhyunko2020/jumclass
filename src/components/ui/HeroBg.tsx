import { useEffect, useRef } from 'react'

interface Star {
  x: number; y: number; r: number
  phase: number; speed: number
  ox: number; oy: number  // 원래 위치 (마우스 패럴랙스용)
}
interface Orb {
  x: number; y: number; r: number
  color: string; speed: number; phase: number
}

export default function HeroBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: 0.5, y: 0.5 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const onMouse = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      }
    }
    window.addEventListener('mousemove', onMouse)

    // ── 별 생성 ──────────────────────────────────────────────
    const stars: Star[] = Array.from({ length: 90 }, () => {
      const ox = Math.random()
      const oy = Math.random()
      return { x: ox, y: oy, ox, oy, r: Math.random() * 1.4 + 0.2, phase: Math.random() * Math.PI * 2, speed: Math.random() * 0.004 + 0.0015 }
    })

    // ── 오브 생성 ────────────────────────────────────────────
    const orbs: Orb[] = [
      { x: 0.18, y: 0.35, r: 220, color: 'rgba(124,111,205,', speed: 0.00025, phase: 0 },
      { x: 0.82, y: 0.55, r: 160, color: 'rgba(170,90,230,',  speed: 0.00040, phase: Math.PI },
      { x: 0.50, y: 0.85, r: 180, color: 'rgba(70,90,220,',   speed: 0.00030, phase: Math.PI * 0.6 },
    ]

    let frame = 0
    let raf: number

    function draw() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const W = canvas.width, H = canvas.height
      frame++

      // ── 오브 렌더 ──────────────────────────────────────────
      orbs.forEach(orb => {
        const dx = Math.sin(frame * orb.speed + orb.phase) * 40
        const dy = Math.cos(frame * orb.speed * 0.7 + orb.phase) * 28
        const x = orb.x * W + dx
        const y = orb.y * H + dy
        const g = ctx.createRadialGradient(x, y, 0, x, y, orb.r)
        g.addColorStop(0, orb.color + '0.13)')
        g.addColorStop(0.5, orb.color + '0.06)')
        g.addColorStop(1, orb.color + '0)')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(x, y, orb.r, 0, Math.PI * 2); ctx.fill()
      })

      // ── 별 패럴랙스 위치 갱신 ─────────────────────────────
      const mx = (mouseRef.current.x - 0.5) * 18
      const my = (mouseRef.current.y - 0.5) * 10
      stars.forEach(s => {
        s.x = s.ox + (mx / W) * (s.r * 1.2)
        s.y = s.oy + (my / H) * (s.r * 1.2)
      })

      // ── 별자리 선 ─────────────────────────────────────────
      ctx.strokeStyle = 'rgba(180,160,255,0.08)'
      ctx.lineWidth = 0.6
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = (stars[i].x - stars[j].x) * W
          const dy = (stars[i].y - stars[j].y) * H
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < W * 0.10) {
            const alpha = (1 - dist / (W * 0.10)) * 0.12
            ctx.globalAlpha = alpha
            ctx.beginPath()
            ctx.moveTo(stars[i].x * W, stars[i].y * H)
            ctx.lineTo(stars[j].x * W, stars[j].y * H)
            ctx.stroke()
          }
        }
      }

      // ── 별 렌더 ───────────────────────────────────────────
      stars.forEach(s => {
        const alpha = ((Math.sin(frame * s.speed + s.phase) + 1) / 2) * 0.75 + 0.2
        ctx.globalAlpha = alpha
        // 큰 별은 십자 글로우
        if (s.r > 1.1) {
          const glow = ctx.createRadialGradient(s.x * W, s.y * H, 0, s.x * W, s.y * H, s.r * 4)
          glow.addColorStop(0, 'rgba(220,210,255,0.6)')
          glow.addColorStop(1, 'rgba(220,210,255,0)')
          ctx.fillStyle = glow
          ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r * 4, 0, Math.PI * 2); ctx.fill()
        }
        ctx.fillStyle = '#e8e0ff'
        ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2); ctx.fill()
      })

      ctx.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouse)
    }
  }, [])

  return (
    <canvas ref={canvasRef} style={{
      position: 'absolute', inset: 0,
      width: '100%', height: '100%',
      pointerEvents: 'none', opacity: 0.9,
    }} />
  )
}
