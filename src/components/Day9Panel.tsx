/**
 * Day9Panel — IForce System + Spring Physics Showcase (Day 9)
 *
 * Demonstrates all Day 9 requirements in a self-contained live demo:
 *
 *   T9.1  IForce interface  — GravityForce + SpringForce (anchored) registered via world.addForce()
 *   T9.2  Spring entity     — Hooke's law, anchored, live PE / extension readout
 *   T9.3  Impulse/momentum  — collision impulse displayed in event log, momentum readout
 *   T9.4  World force pipeline — bus integration, step + floor-bounce events
 *   T9.5  Energy conservation — KE + Spring PE + Gravity PE tracked live
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { World, Body, InteractionLayer } from '../engine'
import { GravityForce, DragForce }       from '../engine'
import { Spring }                         from '../engine/Spring'
import { PhysicsEventBus }               from '../engine/PhysicsEvents'
import type { PhysicsEvent }             from '../engine/PhysicsEvents'
import { FpsMeter }                       from '../utils/fps'
import {
  kineticEnergy, springPotentialEnergy as springPE,
  momentum, speed, roundTo,
} from '../utils/math'
import { FLOOR_Y, CANVAS_W, BALL_RADIUS } from '../constants'

// ── Canvas layout ─────────────────────────────────────────────────────────────
const SCALE = 0.5
const SIM_W = Math.round(CANVAS_W * SCALE)        // 300 px
const SIM_H = Math.round((FLOOR_Y + 20) * SCALE)  // 260 px

// Spring anchor in full-canvas coords
const ANCHOR_X = CANVAS_W / 2   // 300
const ANCHOR_Y = 60

// ── Helper components (same style as Day7Panel) ───────────────────────────────
function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
      background: color + '22', color, border: `1px solid ${color}44`, marginRight: 5,
    }}>{label}</span>
  )
}

function Stat({ label, value, unit, color = '#7dd3fc' }: {
  label: string; value: string | number; unit?: string; color?: string
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '3px 0', borderBottom: '1px solid #1e293b', fontSize: 12, fontFamily: 'monospace',
    }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span>
        <span style={{ color, fontWeight: 700 }}>{value}</span>
        {unit && <span style={{ color: '#334155', marginLeft: 4, fontSize: 10 }}>{unit}</span>}
      </span>
    </div>
  )
}

function PhaseBadge({ phase }: { phase: 'idle' | 'running' | 'paused' }) {
  const cfg = {
    idle:    { color: '#64748b', label: '⬜ IDLE' },
    running: { color: '#4ade80', label: '▶ RUNNING' },
    paused:  { color: '#f59e0b', label: '‖ PAUSED' },
  }[phase]
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
      background: cfg.color + '22', color: cfg.color, border: `1px solid ${cfg.color}44`,
    }}>{cfg.label}</span>
  )
}

// ── Draw spring as zigzag coil on canvas ──────────────────────────────────────
function drawSpringCoil(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  coils = 8,
  amplitude = 8,
  color = '#f59e0b',
) {
  const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
  if (len < 1) return
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len
  const px = -uy, py = ux  // perpendicular unit vector

  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x1, y1)

  const totalSegments = coils * 2
  for (let i = 0; i <= totalSegments; i++) {
    const t = i / totalSegments
    const along = len * t
    const side = (i % 2 === 0 ? 1 : -1) * amplitude
    const cx = x1 + ux * along + px * side
    const cy = y1 + uy * along + py * side
    ctx.lineTo(cx, cy)
  }
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

// ── Main component ────────────────────────────────────────────────────────────
export function Day9Panel() {
  // ── Stable engine refs ──────────────────────────────────────────────────────
  const worldRef  = useRef(new World())
  const busRef    = useRef(new PhysicsEventBus())
  const interRef  = useRef(new InteractionLayer())
  const meterRef  = useRef(new FpsMeter(60))
  const ballRef   = useRef<Body | null>(null)
  const springRef = useRef<Spring | null>(null)
  const simRef    = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef(0)
  const lastTsRef = useRef(0)
  const framesRef = useRef(0)

  // ── Slider refs (mirrors for rAF closure) ───────────────────────────────────
  const stiffnessRef  = useRef(5.0)
  const restLenRef    = useRef(120)
  const dampingRef    = useRef(0.5)
  const massRef       = useRef(1.0)
  const useDragRef    = useRef(false)

  // ── UI state ────────────────────────────────────────────────────────────────
  const [stiffness,  setStiffness]  = useState(5.0)
  const [restLen,    setRestLen]    = useState(120)
  const [damping,    setDamping]    = useState(0.5)
  const [mass,       setMass]       = useState(1.0)
  const [useDrag,    setUseDrag]    = useState(false)
  const [phase,      setPhase]      = useState<'idle' | 'running' | 'paused'>('idle')
  const [fps,        setFps]        = useState(0)
  const [ke,         setKe]         = useState(0)
  const [springPeV,  setSpringPe]   = useState(0)
  const [totalE,     setTotalE]     = useState(0)
  const [spd,        setSpd]        = useState(0)
  const [mom,        setMom]        = useState(0)
  const [ext,        setExt]        = useState(0)
  const [impulseLog, setImpulseLog] = useState<string[]>([])

  // ── buildScene — wires world with sliders ───────────────────────────────────
  const buildScene = useCallback(() => {
    const world = worldRef.current
    // Clear previous scene
    world.bodies.length = 0
    world.forces.length = 0
    world.time = 0

    const k   = stiffnessRef.current
    const rl  = restLenRef.current
    const d   = dampingRef.current
    const m   = massRef.current
    const drag = useDragRef.current

    // Ball starts at rest-length below anchor
    const startY = Math.min(ANCHOR_Y + rl + 30, FLOOR_Y - BALL_RADIUS)
    const b = world.addBody(new Body({ x: ANCHOR_X, y: startY, mass: m }))
    ballRef.current = b

    // Spring entity (anchored mode)
    const sp = new Spring({
      bodyA:      b,
      stiffness:  k,
      restLength: rl,
      damping:    d,
      anchorX:    ANCHOR_X,
      anchorY:    ANCHOR_Y,
    })
    springRef.current = sp

    // Register force pipeline: Gravity + Spring + optional Drag
    world.addForce(new GravityForce())
    world.addForce(sp.makeForce())
    if (drag) world.addForce(new DragForce(0.5))

    // Attach event bus
    world.bus = busRef.current
  }, [])

  // ── Bus subscription for impulse log ────────────────────────────────────────
  useEffect(() => {
    const bus = busRef.current
    const handler = (e: PhysicsEvent) => {
      const j = (e.impulse ?? 0).toFixed(2)
      setImpulseLog(prev => [
        `t=${e.time.toFixed(2)}s  J=${j}`,
        ...prev.slice(0, 4),
      ])
    }
    bus.on('floor-bounce', handler)
    return () => bus.off('floor-bounce', handler)
  }, [])

  // ── Canvas draw ──────────────────────────────────────────────────────────────
  const drawSim = useCallback((b: Body | null, sp: Spring | null) => {
    const canvas = simRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)

    // Background
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, W, H)

    // Grid
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 0.5
    for (let x = 0; x <= W; x += 25) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
    for (let y = 0; y <= H; y += 25) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

    // Floor
    const floorY = FLOOR_Y * SCALE
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(W, floorY); ctx.stroke()

    if (!b || !sp) return

    const bx = b.x * SCALE, by = b.y * SCALE
    const ax = ANCHOR_X * SCALE, ay = ANCHOR_Y * SCALE

    // Anchor point
    ctx.fillStyle = '#60a5fa'
    ctx.beginPath()
    ctx.arc(ax, ay, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#1e40af'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Spring coil — color by extension: green=at rest, red=stretched, blue=compressed
    const extV = sp.extension
    const springColor = extV > 5 ? '#f87171' : extV < -5 ? '#60a5fa' : '#4ade80'
    drawSpringCoil(ctx, ax, ay, bx, by, 8, 6, springColor)

    // Ball with radial gradient
    const grad = ctx.createRadialGradient(bx - 3, by - 3, 2, bx, by, BALL_RADIUS * SCALE)
    grad.addColorStop(0, '#93c5fd')
    grad.addColorStop(1, '#1d4ed8')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(bx, by, BALL_RADIUS * SCALE, 0, Math.PI * 2)
    ctx.fill()

    // Velocity arrow
    const spd2 = speed(b.vx, b.vy)
    if (spd2 > 1) {
      const arrowScale = 3 * SCALE
      const ex = bx + b.vx * arrowScale, ey = by + b.vy * arrowScale
      ctx.strokeStyle = '#f87171'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke()
    }
  }, [])

  // ── rAF loop ─────────────────────────────────────────────────────────────────
  const startLoop = useCallback(() => {
    const loop = (ts: number) => {
      const world  = worldRef.current
      const inter  = interRef.current
      const meter  = meterRef.current
      meter.tick(ts)

      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.016)
      lastTsRef.current = ts

      const b  = ballRef.current
      const sp = springRef.current

      if (!inter.isPaused() && !inter.isDragging() && b && sp) {
        world.step(dt)
        framesRef.current++

        // Update readout every 6 frames (~10 Hz)
        if (framesRef.current % 6 === 0) {
          const kinE = kineticEnergy(b.vx, b.vy, b.mass)
          const spe  = springPE(sp.stiffness, sp.extension)
          setKe(roundTo(kinE, 1))
          setSpringPe(roundTo(spe, 1))
          setTotalE(roundTo(kinE + spe, 1))
          setSpd(roundTo(speed(b.vx, b.vy), 1))
          setMom(roundTo(momentum(b.vx, b.vy, b.mass), 1))
          setExt(roundTo(sp.extension, 1))
          setFps(Math.round(meter.fps))
        }
      }

      drawSim(b, sp)
      rafRef.current = requestAnimationFrame(loop)
    }
    lastTsRef.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)
  }, [drawSim])

  // ── Mount ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    buildScene()
    setPhase('running')
    startLoop()
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Slider handlers (update ref mirror immediately) ──────────────────────────
  const handleStiffness  = (v: number) => { stiffnessRef.current = v;  setStiffness(v) }
  const handleRestLen    = (v: number) => { restLenRef.current   = v;  setRestLen(v) }
  const handleDamping    = (v: number) => { dampingRef.current   = v;  setDamping(v) }
  const handleMass       = (v: number) => { massRef.current      = v;  setMass(v) }
  const handleDrag       = (v: boolean) => { useDragRef.current  = v;  setUseDrag(v) }

  // ── Buttons ──────────────────────────────────────────────────────────────────
  const handleRestart = () => {
    interRef.current.resume()
    buildScene()
    framesRef.current = 0
    setImpulseLog([])
    setPhase('running')
  }
  const handlePause  = () => { interRef.current.pause();  setPhase('paused') }
  const handleResume = () => { interRef.current.resume(); setPhase('running') }

  const btnStyle = (color: string) => ({
    padding: '5px 14px', borderRadius: 5, border: 'none', cursor: 'pointer',
    background: color + '22', color, fontWeight: 700, fontSize: 11, marginRight: 6,
  })

  const sliderRow = (label: string, value: number, min: number, max: number, step: number,
    onChange: (v: number) => void, unit = '') => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ color: '#7dd3fc', fontWeight: 700 }}>{value.toFixed(step < 1 ? 1 : 0)}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#3b82f6' }} />
    </div>
  )

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10,
      padding: 20, fontFamily: 'monospace', color: '#e2e8f0',
      maxWidth: 820, margin: '20px auto',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
          ⚙️ Day 9 — Force System + Spring Physics
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
          <Tag label="T9.1 IForce"    color="#a78bfa" />
          <Tag label="T9.2 Spring"    color="#f59e0b" />
          <Tag label="T9.3 Impulse"   color="#f87171" />
          <Tag label="T9.4 Pipeline"  color="#4ade80" />
          <Tag label="T9.5 Energy"    color="#7dd3fc" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Col 1 — Simulation canvas */}
        <div>
          <canvas
            ref={simRef}
            width={SIM_W}
            height={SIM_H}
            style={{ display: 'block', borderRadius: 6, border: '1px solid #1e293b' }}
          />
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <PhaseBadge phase={phase} />
            <span style={{ fontSize: 10, color: '#475569' }}>{fps} fps</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <button style={btnStyle('#4ade80')} onClick={handleRestart}>Restart</button>
            {phase === 'running'
              ? <button style={btnStyle('#f59e0b')} onClick={handlePause}>Pause</button>
              : <button style={btnStyle('#60a5fa')} onClick={handleResume}>Resume</button>
            }
          </div>
        </div>

        {/* Col 2 — Sliders */}
        <div style={{ minWidth: 200, flex: 1 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontWeight: 700 }}>
            SPRING PARAMETERS
          </div>
          {sliderRow('Stiffness k', stiffness, 0.5, 30, 0.5, handleStiffness)}
          {sliderRow('Rest Length', restLen, 20, 220, 5, handleRestLen, ' px')}
          {sliderRow('Damping', damping, 0, 5, 0.1, handleDamping)}
          {sliderRow('Mass', mass, 0.1, 5, 0.1, handleMass, ' kg')}
          <div style={{ marginTop: 10 }}>
            <label style={{ fontSize: 11, color: '#94a3b8', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={useDrag} onChange={e => handleDrag(e.target.checked)} />
              Add air drag (DragForce)
            </label>
          </div>
          <button
            style={{ ...btnStyle('#4ade80'), marginTop: 10, display: 'block', width: '100%' }}
            onClick={handleRestart}
          >
            Apply &amp; Restart
          </button>
        </div>

        {/* Col 3 — Physics readout */}
        <div style={{ minWidth: 200, flex: 1 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 700 }}>
            ENERGY
          </div>
          <Stat label="Kinetic E"   value={ke}       unit="J"  color="#4ade80" />
          <Stat label="Spring PE"   value={springPeV} unit="J"  color="#f59e0b" />
          <Stat label="Total E"     value={totalE}   unit="J"  color="#7dd3fc" />

          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, marginTop: 12, fontWeight: 700 }}>
            KINEMATICS
          </div>
          <Stat label="Speed"      value={spd}   unit="px/s" />
          <Stat label="Momentum"   value={mom}   unit="kg·px/s" color="#a78bfa" />
          <Stat
            label="Extension"
            value={ext}
            unit="px"
            color={ext > 5 ? '#f87171' : ext < -5 ? '#60a5fa' : '#4ade80'}
          />

          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, marginTop: 12, fontWeight: 700 }}>
            IMPULSE LOG (floor-bounce)
          </div>
          <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#475569' }}>
            {impulseLog.length === 0
              ? <div style={{ color: '#1e293b' }}>— no bounces yet —</div>
              : impulseLog.map((line, i) => (
                <div key={i} style={{ color: i === 0 ? '#f87171' : '#475569', marginBottom: 1 }}>{line}</div>
              ))
            }
          </div>
        </div>
      </div>

      {/* Footer: feature checklist */}
      <div style={{ marginTop: 14, borderTop: '1px solid #1e293b', paddingTop: 10,
        display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 10, color: '#475569' }}>
        <span>✅ T9.1 IForce interface (GravityForce + SpringForce + DragForce)</span>
        <span>✅ T9.2 Spring entity (anchored Hooke's law, makeForce, snapshot)</span>
        <span>✅ T9.3 Impulse/momentum math (momentum, impulse, springPE, speed)</span>
        <span>✅ T9.4 World force pipeline (addForce, bus events)</span>
        <span>✅ T9.5 Energy conservation (KE + Spring PE tracked)</span>
      </div>
    </div>
  )
}
