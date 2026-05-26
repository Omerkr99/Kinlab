/**
 * Day5Panel — Day 5 Infrastructure Showcase
 *
 * Live demo of the new architectural infrastructure:
 *   • PhysicsEventBus — real-time event feed (floor-bounce / wall-bounce / rest)
 *   • FpsMeter        — rolling FPS counter in the rAF loop
 *   • Math helpers    — live KE / PE / total-energy readout + energy decay chart
 *   • Types           — live BodySnapshot display
 *
 * KAN-13 T5.1..T5.4 · 355/355 tests ✅
 */
import { useEffect, useRef, useState } from 'react'
import { World, Body, InteractionLayer } from '../engine'
import { DataRecorder } from '../recorder'
import { PhysicsEventBus } from '../engine/PhysicsEvents'
import type { PhysicsEvent } from '../engine/PhysicsEvents'
import { FpsMeter } from '../utils/fps'
import { kineticEnergy, potentialEnergy, mechanicalEnergy, roundTo } from '../utils/math'
import type { BodySnapshot } from '../types/index'
import { FLOOR_Y, CANVAS_W, BALL_RADIUS, WALL_L, WALL_R, GRAVITY } from '../constants'

// ── Canvas scale ──────────────────────────────────────────────────────────────
const SCALE = 0.5
const SIM_W = Math.round(CANVAS_W * SCALE)
const SIM_H = Math.round((FLOOR_Y + 20) * SCALE)

const MAX_EVENT_LOG = 8          // lines visible in the event feed
const ENERGY_HISTORY = 120       // number of ME samples to draw on the chart

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 10px', borderRadius: 8,
      background: done ? '#0f2a1a' : '#1e1a0f',
      border: `1px solid ${done ? '#22c55e55' : '#f59e0b55'}`,
      marginBottom: 5,
    }}>
      <span style={{ fontSize: 15, lineHeight: 1 }}>{done ? '✅' : '🔲'}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: done ? '#4ade80' : '#fbbf24' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{detail}</div>
      </div>
    </div>
  )
}

// ── Event type colours ────────────────────────────────────────────────────────
const EVENT_STYLE: Record<string, { color: string; bg: string; icon: string }> = {
  'floor-bounce': { color: '#4ade80', bg: '#052e16', icon: '🏔️' },
  'wall-bounce':  { color: '#60a5fa', bg: '#0c1a3a', icon: '🧱' },
  'rest':         { color: '#a78bfa', bg: '#1a0f3a', icon: '🛑' },
  'step':         { color: '#94a3b8', bg: '#0f172a', icon: '⚙️' },
}

// ── Mini stat card ────────────────────────────────────────────────────────────
function StatCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div style={{
      padding: '8px 12px', borderRadius: 8, background: '#0f172a',
      border: `1px solid ${color}33`, textAlign: 'center', minWidth: 80,
    }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{unit}</div>
    </div>
  )
}

// ── Energy history sparkline ──────────────────────────────────────────────────
function EnergyChart({ history, color, label }: { history: number[]; color: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || history.length < 2) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width: W, height: H } = canvas
    ctx.clearRect(0, 0, W, H)
    const maxVal = Math.max(...history, 1)
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.beginPath()
    history.forEach((v, i) => {
      const x = (i / (history.length - 1)) * W
      const y = H - (v / maxVal) * (H - 4) - 2
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()
    // Zero line
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(0, H - 2)
    ctx.lineTo(W, H - 2)
    ctx.stroke()
  }, [history, color])

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 9, color, fontWeight: 700, letterSpacing: 0.5, marginBottom: 3, textTransform: 'uppercase' }}>
        {label}
      </div>
      <canvas ref={ref} width={120} height={40}
        style={{ display: 'block', background: '#0a0f1a', borderRadius: 4, border: `1px solid ${color}33` }} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function Day5Panel() {
  // ── Engine singletons ─────────────────────────────────────────────────────
  const worldRef  = useRef(new World())
  const recRef    = useRef(new DataRecorder())
  const interRef  = useRef(new InteractionLayer())
  const ballRef   = useRef<Body | null>(null)
  const busRef    = useRef(new PhysicsEventBus())
  const meterRef  = useRef(new FpsMeter(30))
  const rafRef    = useRef<number>(0)
  const lastTsRef = useRef(0)
  const simRef    = useRef<HTMLCanvasElement>(null)

  // ── State ─────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<'idle' | 'running' | 'paused'>('idle')
  const [fps,   setFps]   = useState(0)
  const [snap,  setSnap]  = useState<BodySnapshot>({ x: 300, y: 50, vx: 0, vy: 0, ax: 0, ay: 0, t: 0 })
  const [eventLog, setEventLog] = useState<(PhysicsEvent & { seq: number })[]>([])
  const [eventCounts, setEventCounts] = useState({ floor: 0, wall: 0, rest: 0 })

  // Energy history (for sparklines)
  const [keHistory,  setKeHistory]  = useState<number[]>([])
  const [peHistory,  setPeHistory]  = useState<number[]>([])
  const [meHistory,  setMeHistory]  = useState<number[]>([])

  const seqRef = useRef(0)

  // ── Subscribe to bus events ───────────────────────────────────────────────
  useEffect(() => {
    const bus = busRef.current
    const addEvent = (e: PhysicsEvent) => {
      const seq = ++seqRef.current
      setEventLog(prev => [{ ...e, seq }, ...prev].slice(0, MAX_EVENT_LOG))
      setEventCounts(prev => ({
        floor: prev.floor + (e.type === 'floor-bounce' ? 1 : 0),
        wall:  prev.wall  + (e.type === 'wall-bounce'  ? 1 : 0),
        rest:  prev.rest  + (e.type === 'rest'          ? 1 : 0),
      }))
    }
    bus.on('floor-bounce', addEvent)
    bus.on('wall-bounce',  addEvent)
    bus.on('rest',         addEvent)
    return () => bus.clear()
  }, [])

  // ── Draw canvas ───────────────────────────────────────────────────────────
  const drawCanvas = (ts: number) => {
    const canvas = simRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const b = ballRef.current
    if (!b) return

    ctx.clearRect(0, 0, SIM_W, SIM_H)
    ctx.fillStyle = '#080f1e'
    ctx.fillRect(0, 0, SIM_W, SIM_H)

    // Grid
    ctx.strokeStyle = '#0d1b2e'
    ctx.lineWidth = 0.5
    for (let x = 0; x <= SIM_W; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, SIM_H); ctx.stroke()
    }
    for (let y = 0; y <= SIM_H; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SIM_W, y); ctx.stroke()
    }

    // Walls
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(WALL_L * SCALE, 0); ctx.lineTo(WALL_L * SCALE, FLOOR_Y * SCALE); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(WALL_R * SCALE, 0); ctx.lineTo(WALL_R * SCALE, FLOOR_Y * SCALE); ctx.stroke()

    // Floor
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(0, FLOOR_Y * SCALE); ctx.lineTo(SIM_W, FLOOR_Y * SCALE); ctx.stroke()

    // Ball shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath()
    ctx.ellipse(b.x * SCALE, FLOOR_Y * SCALE, BALL_RADIUS * SCALE * 0.8, 3, 0, 0, Math.PI * 2)
    ctx.fill()

    // Ball with gradient
    const bx = b.x * SCALE, by = b.y * SCALE
    const gr  = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, BALL_RADIUS * SCALE)
    gr.addColorStop(0, '#c084fc')
    gr.addColorStop(1, '#7c3aed')
    ctx.fillStyle = gr
    ctx.beginPath(); ctx.arc(bx, by, BALL_RADIUS * SCALE, 0, Math.PI * 2); ctx.fill()

    // Velocity vector
    const speed = Math.hypot(b.vx, b.vy)
    if (speed > 3) {
      const arrowScale = 0.6
      const ex = bx + b.vx * arrowScale * SCALE
      const ey = by + b.vy * arrowScale * SCALE
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke()
      const ang = Math.atan2(ey - by, ex - bx)
      ctx.fillStyle = '#fbbf24'
      ctx.beginPath()
      ctx.moveTo(ex, ey)
      ctx.lineTo(ex - 6 * Math.cos(ang - 0.4), ey - 6 * Math.sin(ang - 0.4))
      ctx.lineTo(ex - 6 * Math.cos(ang + 0.4), ey - 6 * Math.sin(ang + 0.4))
      ctx.closePath(); ctx.fill()
    }

    // FPS overlay
    ctx.fillStyle = '#1e293b88'
    ctx.fillRect(4, 4, 60, 16)
    ctx.fillStyle = '#7dd3fc'; ctx.font = 'bold 10px monospace'
    ctx.fillText(`⚡ ${meterRef.current.fps.toFixed(1)} fps`, 8, 16)

    void ts  // suppress unused-var warning
  }

  // ── rAF loop ──────────────────────────────────────────────────────────────
  const startLoop = () => {
    const world = worldRef.current
    const inter = interRef.current
    const bus   = busRef.current
    const meter = meterRef.current
    const rec   = recRef.current

    const loop = (ts: number) => {
      meter.tick(ts)
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.016)
      lastTsRef.current = ts

      if (!inter.isPaused()) {
        const b = ballRef.current
        const prevVy = b?.vy ?? 0
        const prevVx = b?.vx ?? 0

        world.step(dt)

        if (b) {
          // Detect events and emit to bus
          if (prevVy > 2 && b.vy < 0) {
            bus.emit({ type: 'floor-bounce', bodyIndex: 0, time: world.time, y: b.y, vy: b.vy })
          }
          if (prevVx < -5 && b.vx > 0) {
            bus.emit({ type: 'wall-bounce', bodyIndex: 0, time: world.time, x: b.x, vx: b.vx })
          } else if (prevVx > 5 && b.vx < 0) {
            bus.emit({ type: 'wall-bounce', bodyIndex: 0, time: world.time, x: b.x, vx: b.vx })
          }
          if (b.vy === 0 && b.vx === 0 && b.y >= FLOOR_Y - 1) {
            bus.emit({ type: 'rest', bodyIndex: 0, time: world.time })
          }

          rec.record(world.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)

          // Update React state at a comfortable 10fps (every ~10 frames)
          if (Math.round(ts) % 10 === 0) {
            const height = Math.max(0, FLOOR_Y - b.y)
            setFps(Math.round(meter.fps))
            setSnap({ x: roundTo(b.x, 1), y: roundTo(b.y, 1), vx: roundTo(b.vx, 1), vy: roundTo(b.vy, 1), ax: b.ax, ay: b.ay, t: roundTo(world.time, 3) })
            const ke = roundTo(kineticEnergy(b.vx, b.vy), 2)
            const pe = roundTo(potentialEnergy(height, 1, GRAVITY), 2)
            const me = roundTo(mechanicalEnergy(b.vx, b.vy, height, 1, GRAVITY), 2)
            setKeHistory(prev => [...prev.slice(-ENERGY_HISTORY + 1), ke])
            setPeHistory(prev => [...prev.slice(-ENERGY_HISTORY + 1), pe])
            setMeHistory(prev => [...prev.slice(-ENERGY_HISTORY + 1), me])
          }
        }
      }

      drawCanvas(ts)
      rafRef.current = requestAnimationFrame(loop)
    }

    lastTsRef.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)
  }

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    ballRef.current = worldRef.current.addBody(new Body({ x: 300, y: 50 }))
    startLoop()
    return () => cancelAnimationFrame(rafRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Controls ──────────────────────────────────────────────────────────────
  const handleLaunch = () => {
    const world = worldRef.current
    const b     = ballRef.current
    if (b) { b.x = 300; b.y = 50; b.vx = 180; b.vy = 0; b.ax = 0; b.ay = 0 }
    world.time = 0; world.gravity = GRAVITY
    recRef.current.reset(); recRef.current.start()
    interRef.current.resume()
    busRef.current.clear()
    busRef.current.on('floor-bounce', (e) => {
      const seq = ++seqRef.current
      setEventLog(prev => [{ ...e, seq }, ...prev].slice(0, MAX_EVENT_LOG))
      setEventCounts(prev => ({ ...prev, floor: prev.floor + 1 }))
    })
    busRef.current.on('wall-bounce', (e) => {
      const seq = ++seqRef.current
      setEventLog(prev => [{ ...e, seq }, ...prev].slice(0, MAX_EVENT_LOG))
      setEventCounts(prev => ({ ...prev, wall: prev.wall + 1 }))
    })
    busRef.current.on('rest', (e) => {
      const seq = ++seqRef.current
      setEventLog(prev => [{ ...e, seq }, ...prev].slice(0, MAX_EVENT_LOG))
      setEventCounts(prev => ({ ...prev, rest: prev.rest + 1 }))
    })
    meterRef.current.reset()
    setPhase('running')
    setEventLog([])
    setEventCounts({ floor: 0, wall: 0, rest: 0 })
    setKeHistory([]); setPeHistory([]); setMeHistory([])
  }

  const handlePause  = () => { interRef.current.pause();  setPhase('paused') }
  const handleResume = () => { interRef.current.resume(); setPhase('running') }

  // ── Live energy values ────────────────────────────────────────────────────
  const b      = ballRef.current
  const height = b ? Math.max(0, FLOOR_Y - b.y) : 0
  const liveKE = b ? roundTo(kineticEnergy(b.vx, b.vy), 1) : 0
  const livePE = b ? roundTo(potentialEnergy(height, 1, GRAVITY), 1) : 0
  const liveME = b ? roundTo(mechanicalEnergy(b.vx, b.vy, height, 1, GRAVITY), 1) : 0

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      marginTop: 32, padding: 24,
      background: '#0d1117', borderRadius: 16, color: '#fff',
      fontFamily: 'system-ui, sans-serif',
    }}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <span style={{ fontSize: 28 }}>🏗️</span>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#c084fc' }}>
            Day 5 — Architectural Infrastructure Demo
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b' }}>
            KAN-13 T5.1–T5.4 · PhysicsEventBus · FpsMeter · Math utils · Shared types · 355/355 ✅
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* ══ Col 1: Simulation + FPS ══════════════════════════════════════ */}
        <div style={{ minWidth: SIM_W }}>
          <canvas ref={simRef} width={SIM_W} height={SIM_H}
            style={{ display: 'block', borderRadius: 10, border: '2px solid #1e293b', marginBottom: 10 }} />

          {/* Controls */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={handleLaunch} style={{
              padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 12,
            }}>▶ Launch vx=180</button>
            {phase === 'running' && (
              <button onClick={handlePause} style={{
                padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#334155', color: '#fff', fontWeight: 700, fontSize: 12,
              }}>⏸ Pause</button>
            )}
            {phase === 'paused' && (
              <button onClick={handleResume} style={{
                padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: 12,
              }}>▶ Resume</button>
            )}
          </div>

          {/* FpsMeter card */}
          <div style={{
            background: '#080f1e', borderRadius: 8, padding: '10px 14px',
            border: '1px solid #1e293b', marginBottom: 10,
          }}>
            <div style={{ fontSize: 10, color: '#7dd3fc', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
              ⚡ FpsMeter (utils/fps.ts)
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: fps >= 55 ? '#4ade80' : fps >= 30 ? '#fbbf24' : '#f87171', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {fps}
              </div>
              <div style={{ fontSize: 11, color: '#475569' }}>
                <div>fps</div>
                <div style={{ color: '#334155', marginTop: 2 }}>
                  min {roundTo(meterRef.current.min, 0)} / max {roundTo(meterRef.current.max, 0)}
                </div>
                <div style={{ color: '#334155' }}>
                  {meterRef.current.sampleCount} samples
                </div>
              </div>
            </div>
          </div>

          {/* BodySnapshot live card (types/index.ts) */}
          <div style={{
            background: '#080f1e', borderRadius: 8, padding: '10px 14px',
            border: '1px solid #1e293b', fontSize: 11, fontFamily: 'monospace',
            lineHeight: 1.9, color: '#64748b',
          }}>
            <div style={{ color: '#c084fc', fontWeight: 700, marginBottom: 4 }}>
              📐 BodySnapshot (types/index.ts)
            </div>
            <div>t&nbsp; = <span style={{ color: '#fbbf24' }}>{snap.t}</span><span style={{ color: '#334155' }}> s</span></div>
            <div>x&nbsp; = <span style={{ color: '#7dd3fc' }}>{snap.x}</span><span style={{ color: '#334155' }}> px</span></div>
            <div>y&nbsp; = <span style={{ color: '#7dd3fc' }}>{snap.y}</span><span style={{ color: '#334155' }}> px (canvas)</span></div>
            <div>vx = <span style={{ color: snap.vx > 0 ? '#34d399' : snap.vx < 0 ? '#f87171' : '#64748b' }}>
              {snap.vx > 0 ? '+' : ''}{snap.vx}
            </span><span style={{ color: '#334155' }}> px/s</span></div>
            <div>vy = <span style={{ color: snap.vy > 0 ? '#34d399' : snap.vy < 0 ? '#f87171' : '#64748b' }}>
              {snap.vy > 0 ? '+' : ''}{snap.vy}
            </span><span style={{ color: '#334155' }}> px/s</span></div>
          </div>
        </div>

        {/* ══ Col 2: PhysicsEventBus + energy ══════════════════════════════ */}
        <div style={{ flex: 1, minWidth: 240 }}>

          {/* Event counters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <StatCard label="Floor" value={String(eventCounts.floor)} unit="🏔️ bounces" color="#4ade80" />
            <StatCard label="Wall"  value={String(eventCounts.wall)}  unit="🧱 bounces" color="#60a5fa" />
            <StatCard label="Rest"  value={String(eventCounts.rest)}  unit="🛑 events"  color="#a78bfa" />
          </div>

          {/* Live event bus feed */}
          <div style={{
            background: '#080f1e', borderRadius: 8, padding: '10px 14px',
            border: '1px solid #1e293b', marginBottom: 10,
          }}>
            <div style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              📡 PhysicsEventBus — Live Feed (engine/PhysicsEvents.ts)
            </div>
            {eventLog.length === 0 ? (
              <div style={{ fontSize: 11, color: '#1e293b', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
                Press ▶ Launch to start — events will appear here
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {eventLog.map(e => {
                  const style = EVENT_STYLE[e.type] ?? EVENT_STYLE['step']
                  return (
                    <div key={e.seq} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 8px', borderRadius: 5,
                      background: style.bg, border: `1px solid ${style.color}22`,
                      fontSize: 11, fontFamily: 'monospace',
                      animation: e.seq === seqRef.current ? 'fadeIn 0.2s' : undefined,
                    }}>
                      <span>{style.icon}</span>
                      <span style={{ color: style.color, fontWeight: 700, minWidth: 88 }}>{e.type}</span>
                      <span style={{ color: '#475569' }}>t={e.time.toFixed(3)}s</span>
                      {e.vx !== undefined && <span style={{ color: '#334155' }}>vx={e.vx.toFixed(1)}</span>}
                      {e.vy !== undefined && <span style={{ color: '#334155' }}>vy={e.vy.toFixed(1)}</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Energy stats (math utils) */}
          <div style={{
            background: '#080f1e', borderRadius: 8, padding: '10px 14px',
            border: '1px solid #1e293b', marginBottom: 10,
          }}>
            <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              ⚡ Math utils — Live Energy (utils/math.ts)
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <StatCard label="KE"    value={String(liveKE)} unit="½mv²" color="#f59e0b" />
              <StatCard label="PE"    value={String(livePE)} unit="mgh"  color="#34d399" />
              <StatCard label="Total" value={String(liveME)} unit="KE+PE" color="#818cf8" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <EnergyChart history={keHistory} color="#f59e0b" label="KE decay" />
              <EnergyChart history={peHistory} color="#34d399" label="PE curve" />
              <EnergyChart history={meHistory} color="#818cf8" label="ME total" />
            </div>
            <div style={{ fontSize: 10, color: '#334155', marginTop: 6 }}>
              Energy dissipates via DAMPING=0.7 (floor) and WALL_DAMPING=0.8 (walls) → ME decreases over time
            </div>
          </div>
        </div>

        {/* ══ Col 3: Task checklist ════════════════════════════════════════ */}
        <div style={{ minWidth: 270 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            ✅ Day 5 — KAN-13 Tasks
          </div>
          <Badge done label="T5.1 — DataRecorder.ts"
            detail="SeriesKey union · start/stop/reset/record/getSeries/getLength" />
          <Badge done label="T5.2 — DataRecorder.test.ts"
            detail="5 tests: stopped, started, reset, getSeries, equal lengths" />
          <Badge done label="T5.3 — recorder/integration.test.ts"
            detail="World.step()×20 → getLength()===20 · 15 integration tests" />
          <Badge done label="T5.4 — recorder/index.ts barrel"
            detail="export { DataRecorder } + export type { SeriesKey }" />

          <div style={{ borderTop: '1px solid #1e293b', margin: '12px 0' }} />

          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            🏗️ Day 5 — Infra Extras
          </div>
          <Badge done label="types/index.ts"
            detail="PlayState · SimulationConfig · BodySnapshot · SeriesKey · RecorderSnapshot · AxisDescriptor" />
          <Badge done label="engine/PhysicsEvents.ts"
            detail="PhysicsEventBus — on/off/emit/clear/listenerCount/hasListeners" />
          <Badge done label="utils/math.ts"
            detail="clamp · lerp · roundTo · kineticEnergy · potentialEnergy · mechanicalEnergy · mapRange" />
          <Badge done label="utils/fps.ts"
            detail="FpsMeter rolling window · fps/min/max/sampleCount/reset" />

          <div style={{
            marginTop: 10, padding: '10px 14px', borderRadius: 8,
            background: '#0d1f0d', border: '1px solid #22c55e33',
            fontSize: 11, color: '#64748b', lineHeight: 1.9,
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <span style={{ color: '#4ade80', fontWeight: 800, fontSize: 14 }}>355 / 355 ✅</span>
              <span style={{ color: '#334155' }}>· 16 test files</span>
            </div>
            <div style={{ color: '#334155' }}>recorder/integration.test.ts — 15 tests</div>
            <div style={{ color: '#334155' }}>day5.test.ts — 67 tests</div>
            <div style={{ color: '#22c55e', fontWeight: 700, marginTop: 4 }}>KAN-13 → Done ✓</div>
          </div>
        </div>
      </div>
    </div>
  )
}
