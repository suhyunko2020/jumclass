import { useEffect, useRef } from 'react'

interface Ring {
  cx: number; cy: number; rx: number; ry: number
  rotX: number; rotY: number; rotZ: number
  speedX: number; speedY: number; speedZ: number
  color: string; alpha: number; lineW: number
}

interface Particle {
  x: number; y: number; z: number
  ox: number; oy: number; oz: number
  r: number; phase: number; speed: number; color: string
}

export default function HeroBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: 0.5, y: 0.5 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)

    const onMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight }
    }
    window.addEventListener('mousemove', onMouse)

    const rings: Ring[] = [
      { cx: 0.35, cy: 0.5, rx: 180, ry: 60, rotX: 0, rotY: 0, rotZ: 0, speedX: 0.003, speedY: 0.005, speedZ: 0.002, color: '124,111,205', alpha: 0.12, lineW: 1 },
      { cx: 0.35, cy: 0.5, rx: 140, ry: 50, rotX: 1.2, rotY: 0.5, rotZ: 0, speedX: -0.004, speedY: 0.003, speedZ: 0.006, color: '170,90,230', alpha: 0.08, lineW: 0.8 },
      { cx: 0.35, cy: 0.5, rx: 220, ry: 75, rotX: 0.5, rotY: 1.5, rotZ: 0, speedX: 0.002, speedY: -0.003, speedZ: 0.004, color: '201,168,76', alpha: 0.06, lineW: 0.7 },
      { cx: 0.65, cy: 0.6, rx: 100, ry: 35, rotX: 0.8, rotY: 0, rotZ: 0, speedX: 0.005, speedY: 0.004, speedZ: -0.003, color: '124,111,205', alpha: 0.07, lineW: 0.6 },
    ]

    const particles: Particle[] = Array.from({ length: 60 }, () => {
      const ox = Math.random()
      const oy = Math.random()
      const oz = Math.random() * 0.8 + 0.2
      const colors = ['200,190,255', '170,140,255', '220,200,120', '180,160,240']
      return {
        x: ox, y: oy, z: oz, ox, oy, oz,
        r: Math.random() * 1.5 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.003 + 0.001,
        color: colors[Math.floor(Math.random() * colors.length)],
      }
    })

    let frame = 0
    let raf: number

    function project(x: number, y: number, z: number): [number, number, number] {
      const perspective = 600
      const scale = perspective / (perspective + z * 200)
      return [x * scale, y * scale, scale]
    }

    function draw() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const W = canvas.width, H = canvas.height
      frame++

      const mx = (mouseRef.current.x - 0.5) * 0.3
      const my = (mouseRef.current.y - 0.5) * 0.2

      // rings
      rings.forEach(ring => {
        ring.rotX += ring.speedX
        ring.rotY += ring.speedY
        ring.rotZ += ring.speedZ

        const cx = ring.cx * W + mx * 40
        const cy = ring.cy * H + my * 25
        const cosX = Math.cos(ring.rotX + my), sinX = Math.sin(ring.rotX + my)
        const cosY = Math.cos(ring.rotY + mx), sinY = Math.sin(ring.rotY + mx)
        const cosZ = Math.cos(ring.rotZ), sinZ = Math.sin(ring.rotZ)

        ctx.strokeStyle = `rgba(${ring.color},${ring.alpha})`
        ctx.lineWidth = ring.lineW
        ctx.beginPath()

        const segments = 80
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2
          let px = Math.cos(angle) * ring.rx
          let py = Math.sin(angle) * ring.ry
          let pz = 0

          // rotate X
          const y1 = py * cosX - pz * sinX
          const z1 = py * sinX + pz * cosX
          py = y1; pz = z1
          // rotate Y
          const x2 = px * cosY + pz * sinY
          const z2 = -px * sinY + pz * cosY
          px = x2; pz = z2
          // rotate Z
          const x3 = px * cosZ - py * sinZ
          const y3 = px * sinZ + py * cosZ
          px = x3; py = y3

          const [sx, sy] = project(px, py, pz)

          if (i === 0) ctx.moveTo(cx + sx, cy + sy)
          else ctx.lineTo(cx + sx, cy + sy)
        }
        ctx.stroke()
      })

      // particles with depth
      particles.forEach(p => {
        const parallaxX = mx * p.z * 30
        const parallaxY = my * p.z * 20
        p.x = p.ox + parallaxX / W
        p.y = p.oy + parallaxY / H

        const breathe = Math.sin(frame * p.speed + p.phase)
        const alpha = (breathe + 1) / 2 * 0.6 + 0.15
        const depthScale = 0.5 + p.z * 0.5
        const r = p.r * depthScale
        const px = p.x * W
        const py = p.y * H

        ctx.globalAlpha = alpha * depthScale

        if (r > 1.2) {
          const g = ctx.createRadialGradient(px, py, 0, px, py, r * 5)
          g.addColorStop(0, `rgba(${p.color},0.4)`)
          g.addColorStop(1, `rgba(${p.color},0)`)
          ctx.fillStyle = g
          ctx.beginPath(); ctx.arc(px, py, r * 5, 0, Math.PI * 2); ctx.fill()
        }

        ctx.fillStyle = `rgba(${p.color},0.9)`
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill()
      })

      // subtle connecting lines between nearby particles
      ctx.lineWidth = 0.4
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = (particles[i].x - particles[j].x) * W
          const dy = (particles[i].y - particles[j].y) * H
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < W * 0.08) {
            const a = (1 - dist / (W * 0.08)) * 0.06
            ctx.globalAlpha = a
            ctx.strokeStyle = `rgba(180,160,255,1)`
            ctx.beginPath()
            ctx.moveTo(particles[i].x * W, particles[i].y * H)
            ctx.lineTo(particles[j].x * W, particles[j].y * H)
            ctx.stroke()
          }
        }
      }

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
      pointerEvents: 'none', opacity: 0.85,
    }} />
  )
}
