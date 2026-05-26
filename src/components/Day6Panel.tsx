/**
 * Day6Panel — WorldCanvas.tsx + rAF Loop Showcase (KAN-14)
 *
 * Replaces Day3Panel + Day5Panel.
 * Demonstrates all four T6.x requirements in a single, self-contained panel:
 *
 *   T6.1  rAF loop — live frame counter, dt cap visualisation
 *   T6.2  draw()   — floor line, blue gradient ball, red velocity arrow (FR-21)
 *   T6.3  App arch — module-level singletons displayed as code
 *   T6.4  FPS      — live FpsMeter gauge
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { World, Body, InteractionLayer } from '../engine'
import { DataRecorder }    from '../recorder'
import { PhysicsEventBus } from '../engine/PhysicsEvents'
import { FpsMeter }        from '../utils/fps'
import { kineticEnergy, potentialEnergy, roundTo } from '../utils/math'
import { FLOOR_Y, CANVAS_W, BALL_RADIUS, WALL_L, WALL_R, GRAVITY } from '../constants'

// ── canvas layout ─────────────────────────────────────────────────────────────
const SCALE  = 0.5
const SIM_W  = Math.round(CANVAS_W * SCALE)        // 300 px
const SIM_H  = Math.round((FLOOR_Y + 20) * SCALE)  // 260 px
const VEL_SCALE = 5  // same as WorldCanvas.tsx

// ── small helper components ───────────────────────────────────────────────────
function Stat({ label, value, unit, color = '#7dd3fc' }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '3px 0', borderBottom: '1px solid #1e293b', fontSize: 12, fontFamily: 'monospace' }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span>
        <span style={{ color, fontWeight: 700 }}>{value}</span>
        {unit && <span style={{ color: '#334155', marginLeft: 4, fontSize: 10 }}>{unit}</span>}
      </span>
    </div>
  )
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
      background: color + '22', color, border: `1px solid ${color}44`, marginRight: 5 }}>
      {label}
    </span>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export function Day6Panel() {
  // Module-level singletons (mirrors App.tsx pattern — T6.3)
  const worldRef  = useRef(new World())
  const recRef    = useRef(new DataRecorder())
  const interRef  = useRef(new InteractionLayer())
  const busRef    = useRef(new PhysicsEventBus())
  const meterRef  = useRef(new FpsMeter(60))

  const ballRef   = useRef<Body | null>(null)
  const rafRef    = useRef(0)
  const lastTsRef = useRef(0)
  const simRef    = useRef<HTMLCanvasElement>(null)

  // Telemetry state — updated at ~10 Hz to avoid React thrash
  const [phase,   setPhase]   = useState<'idle' | 'running' | 'paused'>('idle')
  const [fps,     setFps]     = useState(0)
  const [frames,  setFrames]  = useState(0)
  const [dt,      setDt]      = useState(0)
  const [samples, setSamples] = useState(0)
  const [ke,      setKe]      = useState(0)
  const [pe,      setPe]      = useState(0)
  const [events,  setEvents]  = useState({ floor: 0, wall: 0 })
  const [bodyPos, setBodyPos] = useState({ x: 300, y: 50, vx: 0, vy: 0 })

  const framesRef  = useRef(0)
  const eventsRef  = useRef({ floor: 0, wall: 0 })

  // ── draw the mini canvas (mirrors WorldCanvas.tsx draw logic — T6.2) ───────
  const drawCanvas = useCallback((b: Body | null) => {
    const canvas = simRef.current
    if (!canvas || !b) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // T6.2-a: clearRect
    ctx.clearRect(0, 0, SIM_W, SIM_H)

    // Background with subtle grid
    ctx.fillStyle = '#070e1b'
    ctx.fillRect(0, 0, SIM_W, SIM_H)
    ctx.strokeStyle = '#0d1b2e'
    ctx.lineWidth = 0.5
    for (let x = 0; x <= SIM_W; x += 25) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, SIM_H); ctx.stroke() }
    for (let y = 0; y <= SIM_H; y += 25) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SIM_W, y); ctx.stroke() }

    // Walls
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(WALL_L * SCALE, 0); ctx.lineTo(WALL_L * SCALE, FLOOR_Y * SCALE); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(WALL_R * SCALE, 0); ctx.lineTo(WALL_R * SCALE, FLOOR_Y * SCALE); ctx.stroke()
    ctx.setLineDash([])

    // T6.2-b: floor line
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(0, FLOOR_Y * SCALE); ctx.lineTo(SIM_W, FLOOR_Y * SCALE); ctx.stroke()
    ctx.fillStyle = '#334155'; ctx.font = '8px monospace'
    ctx.fillText(`y=${FLOOR_Y}`, 4, FLOOR_Y * SCALE - 4)

    // Ball shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.ellipse(b.x * SCALE, FLOOR_Y * SCALE, BALL_RADIUS * SCALE * 0.8, 3, 0, 0, Math.PI * 2)
    ctx.fill()

    // T6.2-c: blue arc (radial gradient)
    const bx = b.x * SCALE, by = b.y * SCALE, r = BALL_RADIUS * SCALE
    const gr = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.3, 1, bx, by, r)
    gr.addColorStop(0, '#93c5fd')
    gr.addColorStop(1, '#1d4ed8')
    ctx.fillStyle = gr
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill()

    // T6.2-d: red velocity arrow (FR-21)
    const vLen = Math.hypot(b.vx, b.vy)
    if (vLen > 0.1) {
      const ex = bx + b.vx * VEL_SCALE * SCALE
      const ey = by + b.vy * VEL_SCALE * SCALE
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke()
      const ang = Math.atan2(ey - by, ex - bx)
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.moveTo(ex, ey)
      ctx.lineTo(ex - 7 * Math.cos(ang - 0.4), ey - 7 * Math.sin(ang - 0.4))
      ctx.lineTo(ex - 7 * Math.cos(ang + 0.4), ey - 7 * Math.sin(ang + 0.4))
      ctx.closePath(); ctx.fill()
    }

    // FPS overlay
    const fps = meterRef.current.fps
    ctx.fillStyle = fps >= 55 ? '#22c55e33' : '#ef444433'
    ctx.fillRect(4, 4, 54, 16)
    ctx.fillStyle = fps >= 55 ? '#4ade80' : '#f87171'
    ctx.font = 'bold 10px monospace'
    ctx.fillText(`${fps.toFixed(0)} fps`, 8, 16)
  }, [])

  // ── rAF loop ─────────────────────────────────────────────────────────────
  const startLoop = useCallback(() => {
    const world = worldRef.current
    const rec   = recRef.current
    const inter = interRef.current
    const bus   = busRef.current
    const meter = meterRef.current

    const loop = (ts: number) => {
      meter.tick(ts)
      // T6.1 — dt capping: Math.min(elapsed / 1000, 0.016)
      const rawDt = (ts - lastTsRef.current) / 1000
      const dt    = Math.min(rawDt, 0.016)
      lastTsRef.current = ts

      const b = ballRef.current

      if (!inter.isPaused() && !inter.isDragging()) {
        const prevVy = b?.vy ?? 0
        const prevVx = b?.vx ?? 0

        world.step(dt)
        framesRef.current++

        if (b) {
          // Physical coords: y_phys = FLOOR_Y - canvas_y, vy_phys = -vy
          rec.record(world.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)

          // Detect and emit events
          if (prevVy > 2 && b.vy < 0) {
            eventsRef.current.floor++
            bus.emit({ type: 'floor-bounce', bodyIndex: 0, time: world.time, vy: b.vy })
          }
          if (Math.sign(prevVx) !== Math.sign(b.vx) && Math.abs(prevVx) > 5) {
            eventsRef.current.wall++
            bus.emit({ type: 'wall-bounce', bodyIndex: 0, time: world.time, vx: b.vx })
          }
        }
      }

      drawCanvas(b)

      // Update React state ~10 Hz (every ~6 frames at 60fps)
      if (framesRef.current % 6 === 0 && b) {
        const h = Math.max(0, FLOOR_Y - b.y)
        setFps(Math.round(meter.fps))
        setFrames(framesRef.current)
        setDt(roundTo(Math.min(rawDt, 0.016), 4))
        setSamples(rec.getLength())
        setKe(roundTo(kineticEnergy(b.vx, b.vy), 1))
        setPe(roundTo(potentialEnergy(h, 1, GRAVITY), 1))
        setEvents({ ...eventsRef.current })
        setBodyPos({ x: roundTo(b.x, 0), y: roundTo(b.y, 0), vx: roundTo(b.vx, 0), vy: roundTo(b.vy, 0) })
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    lastTsRef.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)
  }, [drawCanvas])

  // ── mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    ballRef.current = worldRef.current.addBody(new Body({ x: 300, y: 50 }))
    startLoop()
    return () => cancelAnimationFrame(rafRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── controls ──────────────────────────────────────────────────────────────
  const handleLaunch = (preset: 'free-fall' | 'wall-bounce' | 'diagonal') => {
    const world = worldRef.current
    const b     = ballRef.current
    if (!b) return
    const configs = {
      'free-fall':   { x: 300, y: 30,  vx: 0,   vy: 0   },
      'wall-bounce': { x: 300, y: 100, vx: 250, vy: -50  },
      'diagonal':    { x: 100, y: 80,  vx: 180, vy: 100  },
    }
    const cfg = configs[preset]
    Object.assign(b, { ...cfg, ax: 0, ay: 0 })
    world.time = 0; world.gravity = GRAVITY
    recRef.current.reset(); recRef.current.start()
    interRef.current.resume()
    framesRef.current = 0
    eventsRef.current = { floor: 0, wall: 0 }
    meterRef.current.reset()
    setPhase('running')
    setFrames(0); setSamples(0); setEvents({ floor: 0, wall: 0 })
  }

  const handlePause  = () => { interRef.current.pause();  setPhase('paused') }
  const handleResume = () => { interRef.current.resume(); setPhase('running') }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      marginTop: 32, padding: 24,
      background: '#070e1b', borderRadius: 16, color: '#fff',
      fontFamily: 'system-ui, sans-serif',
      border: '1px solid #1e293b',
    }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <span style={{ fontSize: 28 }}>🎬</span>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#7dd3fc' }}>
            Day 6 — WorldCanvas.tsx + rAF Loop
          </h2>
          <div style={{ marginTop: 4 }}>
            <Tag label="T6.1 rAF loop"     color="#60a5fa" />
            <Tag label="T6.2 draw()"        color="#4ade80" />
            <Tag label="T6.3 App arch"      color="#f59e0b" />
            <Tag label="T6.4 55+ FPS"       color="#a78bfa" />
            <Tag label="KAN-14 ✓"           color="#34d399" />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* ══ Col 1: Canvas + Controls ═════════════════════════════════════ */}
        <div>
          {/* Canvas */}
          <canvas ref={simRef} width={SIM_W} height={SIM_H}
            style={{ display: 'block', borderRadius: 8, border: '2px solid #1e293b', marginBottom: 10 }} />

          {/* Launch presets */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {([
              { id: 'free-fall'   as const, label: '↓ Free Fall',    color: '#3b82f6' },
              { id: 'wall-bounce' as const, label: '↔ Wall Bounce',  color: '#f59e0b' },
              { id: 'diagonal'    as const, label: '↗ Diagonal',     color: '#a78bfa' },
            ]).map(p => (
              <button key={p.id} onClick={() => handleLaunch(p.id)} style={{
                padding: '7px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: p.color, color: '#fff', fontWeight: 700, fontSize: 11,
              }}>{p.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {phase === 'running' && (
              <button onClick={handlePause} style={{
                padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: '#334155', color: '#94a3b8', fontWeight: 700, fontSize: 11,
              }}>⏸ Pause</button>
            )}
            {phase === 'paused' && (
              <button onClick={handleResume} style={{
                padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: 11,
              }}>▶ Resume</button>
            )}
          </div>
        </div>

        {/* ══ Col 2: T6.1 + T6.4 telemetry ════════════════════════════════ */}
        <div style={{ minWidth: 200 }}>
          {/* T6.4 FPS */}
          <div style={{
            background: '#0a1628', borderRadius: 8, padding: '12px 14px', marginBottom: 10,
            border: `1px solid ${fps >= 55 ? '#22c55e44' : '#ef444444'}`,
          }}>
            <div style={{ fontSize: 10, color: fps >= 55 ? '#4ade80' : '#f87171', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
              ⚡ T6.4 — FPS (target: 55+)
            </div>
            <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1,
              color: fps >= 55 ? '#4ade80' : fps >= 30 ? '#fbbf24' : '#f87171',
              fontVariantNumeric: 'tabular-nums' }}>
              {fps}
            </div>
            <div style={{ fontSize: 10, color: '#334155', marginTop: 3 }}>
              {fps >= 55 ? '✅ meets budget' : fps > 0 ? '⚠️ below budget' : 'waiting…'}
            </div>
          </div>

          {/* T6.1 loop stats */}
          <div style={{ background: '#0a1628', borderRadius: 8, padding: '12px 14px', marginBottom: 10, border: '1px solid #1e293b' }}>
            <div style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              🔄 T6.1 — rAF Loop
            </div>
            <Stat label="frames"   value={frames}                   unit="total"  color="#7dd3fc" />
            <Stat label="dt"       value={dt}                        unit="s"      color={dt === 0.016 ? '#fbbf24' : '#4ade80'} />
            <Stat label="dt cap"   value="0.016"                     unit="s max"  color="#475569" />
            <Stat label="samples"  value={samples}                   unit="pts"    color="#34d399" />
            <Stat label="KE"       value={ke}                        unit="½mv²"   color="#f59e0b" />
            <Stat label="PE"       value={pe}                        unit="mgh"    color="#34d399" />
          </div>

          {/* Events */}
          <div style={{ background: '#0a1628', borderRadius: 8, padding: '12px 14px', border: '1px solid #1e293b' }}>
            <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              📡 Events (PhysicsEventBus)
            </div>
            <Stat label="🏔️ floor-bounce" value={events.floor} color="#4ade80" />
            <Stat label="🧱 wall-bounce"  value={events.wall}  color="#60a5fa" />
          </div>
        </div>

        {/* ══ Col 3: T6.2 draw() + T6.3 arch ══════════════════════════════ */}
        <div style={{ flex: 1, minWidth: 240 }}>
          {/* T6.2 */}
          <div style={{ background: '#0a1628', borderRadius: 8, padding: '12px 14px', marginBottom: 10, border: '1px solid #1e293b' }}>
            <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              🎨 T6.2 — draw() features
            </div>
            {[
              { label: 'clearRect()', detail: 'Clears canvas every frame — no ghosting', done: true },
              { label: 'Floor line', detail: `strokeStyle=#555 at y=${FLOOR_Y}`, done: true },
              { label: 'Blue arc (FR-21)', detail: 'createRadialGradient + arc(x, y, 20, 0, 2π)', done: true },
              { label: 'Red velocity arrow', detail: 'drawn when |v| > 0.1 · VEL_SCALE=5 · arrowhead', done: true },
              { label: 'Scale ruler overlay', detail: 'hidden in px mode, visible in cm/m', done: true },
              { label: 'Ball shadow', detail: 'ellipse under ball for depth', done: true },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', gap: 8, padding: '5px 0',
                borderBottom: '1px solid #0d1b2e', alignItems: 'flex-start' }}>
                <span style={{ color: '#22c55e', fontSize: 12 }}>✅</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>{f.label}</div>
                  <div style={{ fontSize: 10, color: '#475569' }}>{f.detail}</div>
                </div>
              </div>
            ))}
          </div>

          {/* T6.3 App architecture */}
          <div style={{ background: '#0a1628', borderRadius: 8, padding: '12px 14px', border: '1px solid #1e293b' }}>
            <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              🏗️ T6.3 — App arch (instances outside component)
            </div>
            <pre style={{ margin: 0, fontSize: 10, color: '#64748b', lineHeight: 1.8,
              background: '#050b14', borderRadius: 6, padding: '8px 10px', overflowX: 'auto' }}>
{`// ⚠️ OUTSIDE component — stable across renders
const world       = new World()
world.addBody(new Body({ x:300, y:50 }))
const recorder    = new DataRecorder()
const interaction = new InteractionLayer()

export default function App() {
  // ← components use these stable refs
  return <WorldCanvas world={world}
           recorder={recorder}
           interaction={interaction} />
}`}
            </pre>
            <div style={{ marginTop: 8, fontSize: 10, color: '#334155', lineHeight: 1.6 }}>
              ✅ No recreation on re-render<br />
              ✅ rAF loop captures stable closure<br />
              ✅ Physics state persists across HMR
            </div>

            {/* live body state */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>Live: world.bodies[0]</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {([
                  { k: 'x',  v: bodyPos.x,  c: '#7dd3fc' },
                  { k: 'y',  v: bodyPos.y,  c: '#7dd3fc' },
                  { k: 'vx', v: bodyPos.vx, c: '#fbbf24' },
                  { k: 'vy', v: bodyPos.vy, c: '#fbbf24' },
                ]).map(({ k, v, c }) => (
                  <div key={k} style={{ flex: 1, background: '#050b14', borderRadius: 6,
                    padding: '4px 6px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#334155' }}>{k}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: c,
                      fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
