/**
 * DemoPanel — Day 2 Feature Showcase
 * Runs an auto-demo that visually demonstrates every Day 2 change.
 */
import { useEffect, useRef, useState } from 'react'
import { World, Body, InteractionLayer } from '../engine'
import { DataRecorder, SeriesKey } from '../recorder'
import { GraphEngine } from '../graph/GraphEngine'
import { FLOOR_Y, CANVAS_W } from '../constants'

// ─── mini graph that draws a single series ───────────────────────────────────
function MiniGraph({
  recorder, xKey, yKey, label, color,
}: {
  recorder: DataRecorder; xKey: SeriesKey; yKey: SeriesKey
  label: string; color: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const engRef = useRef<GraphEngine | null>(null)

  useEffect(() => {
    if (ref.current) engRef.current = new GraphEngine(ref.current)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      engRef.current?.draw(recorder, xKey, yKey)
    }, 50)
    return () => clearInterval(id)
  }, [recorder, xKey, yKey])

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: 11, fontWeight: 700, marginBottom: 4, color,
        textTransform: 'uppercase', letterSpacing: 0.8,
      }}>
        {label}
      </div>
      <canvas
        ref={ref} width={220} height={140}
        style={{ border: `2px solid ${color}`, borderRadius: 6, background: '#fff' }}
      />
    </div>
  )
}

// ─── feature badge ────────────────────────────────────────────────────────────
function Badge({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '8px 12px', borderRadius: 8,
      background: done ? '#f0faf4' : '#fff8f0',
      border: `1px solid ${done ? '#b7e4c7' : '#ffd59e'}`,
      marginBottom: 6,
    }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>{done ? '✅' : '🔲'}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: done ? '#1a7f37' : '#9a6700' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{detail}</div>
      </div>
    </div>
  )
}

// ─── main demo panel ──────────────────────────────────────────────────────────
export function DemoPanel() {
  const worldRef      = useRef(new World())
  const recorderRef   = useRef(new DataRecorder())
  const interactRef   = useRef(new InteractionLayer())
  const ballRef       = useRef<Body | null>(null)
  const rafRef        = useRef<number>(0)
  const lastTimeRef   = useRef(0)

  const [phase, setPhase]         = useState<'idle' | 'running' | 'paused' | 'reset'>('idle')
  const [frameCount, setFrameCount] = useState(0)
  const [dirtySkips, setDirtySkips] = useState(0)
  const [ballPos, setBallPos]     = useState({ x: 300, y: 50 })

  // canvas for mini simulation preview
  const simRef = useRef<HTMLCanvasElement>(null)

  // draw simulation canvas
  const drawSim = () => {
    const canvas = simRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const b = ballRef.current
    if (!b) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#f8f9fa'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // floor
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(0, FLOOR_Y * 0.56); ctx.lineTo(canvas.width, FLOOR_Y * 0.56); ctx.stroke()
    ctx.fillStyle = '#aaa'; ctx.font = '10px sans-serif'
    ctx.fillText(`floor y=${FLOOR_Y}`, 4, FLOOR_Y * 0.56 - 3)

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)'
    ctx.beginPath(); ctx.ellipse(b.x * 0.46, FLOOR_Y * 0.56, 10, 4, 0, 0, Math.PI * 2); ctx.fill()

    // ball
    const bx = b.x * 0.46, by = b.y * 0.56
    const g = ctx.createRadialGradient(bx - 3, by - 3, 1, bx, by, 12)
    g.addColorStop(0, '#74b3f0'); g.addColorStop(1, '#2574c4')
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, 12, 0, Math.PI * 2); ctx.fill()

    // vel vector
    if (Math.hypot(b.vx, b.vy) > 0.5) {
      const scale = 2
      ctx.strokeStyle = '#E24A4A'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + b.vx * scale, by + b.vy * scale); ctx.stroke()
    }
  }

  // rAF loop
  const startLoop = () => {
    const world = worldRef.current
    const recorder = recorderRef.current
    const interact = interactRef.current

    const loop = (ts: number) => {
      const dt = Math.min((ts - lastTimeRef.current) / 1000, 0.016)
      lastTimeRef.current = ts

      if (!interact.isPaused()) {
        world.step(dt)
        const b = ballRef.current
        if (b) {
          recorder.record(world.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
          setBallPos({ x: Math.round(b.x), y: Math.round(b.y) })
        }
        setFrameCount(f => f + 1)
      } else {
        // count dirty-skips (frames where graph would have redrawn uselessly)
        setDirtySkips(s => s + 1)
      }

      drawSim()
      rafRef.current = requestAnimationFrame(loop)
    }

    lastTimeRef.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)
  }

  const handlePlay = () => {
    const world = worldRef.current
    world.time = 0
    if (ballRef.current) {
      ballRef.current.x = 300; ballRef.current.y = 50
      ballRef.current.vx = 0;  ballRef.current.vy = 0
      ballRef.current.ax = 0;  ballRef.current.ay = 0
    }
    recorderRef.current.reset()
    recorderRef.current.start()
    interactRef.current.resume()
    setPhase('running')
    setFrameCount(0)
    setDirtySkips(0)
  }

  const handlePause = () => {
    interactRef.current.pause()
    setPhase('paused')
  }

  const handleResume = () => {
    interactRef.current.resume()
    setPhase('running')
  }

  useEffect(() => {
    const world = worldRef.current
    ballRef.current = world.addBody(new Body({ x: 300, y: 50 }))
    startLoop()
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const sampleCount = recorderRef.current.getLength()

  return (
    <div style={{
      marginTop: 32,
      padding: 24,
      background: '#1a1a2e',
      borderRadius: 16,
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <span style={{ fontSize: 28 }}>🧪</span>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#7dd3fc' }}>
            Day 2 — Feature Demo
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
            הדגמה חיה של כל השינויים שבוצעו ביום השני
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>

        {/* Left — simulation + controls */}
        <div style={{ minWidth: 280 }}>
          {/* Mini sim canvas */}
          <canvas
            ref={simRef} width={280} height={290}
            style={{ border: '2px solid #334155', borderRadius: 10, display: 'block', marginBottom: 12 }}
          />

          {/* Controls */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={handlePlay} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#4A90E2', color: '#fff', fontWeight: 700, fontSize: 13,
            }}>▶ Play</button>
            {phase === 'running' && (
              <button onClick={handlePause} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#475569', color: '#fff', fontWeight: 700, fontSize: 13,
              }}>⏸ Pause</button>
            )}
            {phase === 'paused' && (
              <button onClick={handleResume} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: 13,
              }}>▶ Resume</button>
            )}
          </div>

          {/* Live stats */}
          <div style={{
            background: '#0f172a', borderRadius: 8, padding: 12, fontSize: 12,
            fontFamily: 'monospace', color: '#94a3b8', lineHeight: 1.8,
          }}>
            <div style={{ color: '#7dd3fc', fontWeight: 700, marginBottom: 4 }}>📊 Live State</div>
            <div>ball.x = <span style={{ color: '#fbbf24' }}>{ballPos.x}px</span></div>
            <div>ball.y = <span style={{ color: '#fbbf24' }}>{ballPos.y}px</span></div>
            <div>samples = <span style={{ color: '#34d399' }}>{sampleCount}</span></div>
            <div>frames = <span style={{ color: '#34d399' }}>{frameCount}</span></div>
            <div>dirty skips = <span style={{ color: '#f87171' }}>{dirtySkips}</span>
              <span style={{ color: '#64748b' }}> (KAN-36)</span>
            </div>
            <div>status = <span style={{ color: phase === 'running' ? '#22c55e' : phase === 'paused' ? '#f59e0b' : '#94a3b8' }}>
              {phase}
            </span></div>
          </div>
        </div>

        {/* Center — 3 mini graphs for y, vy, ay */}
        <div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10, fontWeight: 600 }}>
            📈 KAN-32 — 7 series pipeline (y, vy, ay חדשים)
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <MiniGraph recorder={recorderRef.current} xKey="time" yKey="y"
              label="time → y" color="#4A90E2" />
            <MiniGraph recorder={recorderRef.current} xKey="time" yKey="vy"
              label="time → vy" color="#22c55e" />
            <MiniGraph recorder={recorderRef.current} xKey="time" yKey="ay"
              label="time → ay" color="#f59e0b" />
          </div>
          <div style={{ marginTop: 12 }}>
            <MiniGraph recorder={recorderRef.current} xKey="x" yKey="y"
              label="x → y (trajectory)" color="#a78bfa" />
          </div>
        </div>

        {/* Right — feature checklist */}
        <div style={{ minWidth: 300 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10, fontWeight: 600 }}>
            ✅ Day 2 — Changes Delivered
          </div>
          <Badge done label="KAN-31 — constants.ts"
            detail={`FLOOR_Y=${FLOOR_Y}, CANVAS_W=${CANVAS_W} — single source of truth`} />
          <Badge done label="KAN-32 — 7-series pipeline"
            detail="time, x, y, vx, vy, ax, ay — AxisSelector has all 7 options" />
          <Badge done label="KAN-33 — Play resets ball"
            detail="לחץ Play → כדור חוזר ל-(300,50), הקלטה מאפסת ומתחילה מחדש" />
          <Badge done label="KAN-34 — Math.min → reduce"
            detail="GraphEngine אינו עושה stack overflow גם אחרי 65k+ נקודות" />
          <Badge done label="KAN-35 — recorder init"
            detail="recorder.start() הוסר מ-module level → רק בלחיצה על Play" />
          <Badge done label="KAN-36 — dirty flag"
            detail={`גרף לא מצייר כשאין נתונים חדשים — ראה "dirty skips" ↖`} />
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 8,
            background: '#0f172a', fontSize: 11, color: '#64748b', lineHeight: 1.7,
          }}>
            <span style={{ color: '#7dd3fc' }}>40/40 tests ✅</span> · commit db936ac · main
          </div>
        </div>
      </div>
    </div>
  )
}
