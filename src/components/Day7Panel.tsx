/**
 * Day7Panel — GraphEngine.ts + GraphCanvas.tsx Showcase (KAN-15)
 *
 * Demonstrates all four T7.x requirements in a single, self-contained panel:
 *
 *   T7.1  GraphEngine.draw() — drawGrid, drawAxes (unit labels), drawData (auto-scale)
 *   T7.2  Guard conditions   — live counter: drawn vs skipped (< 2 pts guard)
 *   T7.3  Dirty-flag polling — setInterval 32ms, skip when length unchanged
 *   T7.4  App integration    — World → DataRecorder → GraphEngine pipeline live
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { World, Body, InteractionLayer } from '../engine'
import { DataRecorder }  from '../recorder'
import type { SeriesKey } from '../recorder'
import { GraphEngine }   from '../graph/GraphEngine'
import { FpsMeter }      from '../utils/fps'
// roundTo was imported for potential display helpers — not yet used
import {
  DEFAULT_SCALE, SCALE_PRESETS, axisLabel,
} from '../units/PhysicsScale'
import type { PhysicsScale } from '../units/PhysicsScale'
import { FLOOR_Y, CANVAS_W, BALL_RADIUS, WALL_L, WALL_R, GRAVITY } from '../constants'

// ── canvas layout ─────────────────────────────────────────────────────────────
const SCALE  = 0.5
const SIM_W  = Math.round(CANVAS_W * SCALE)       // 300 px
const SIM_H  = Math.round((FLOOR_Y + 20) * SCALE) // 260 px
const GFX_W  = 340
const GFX_H  = 220
const VEL_SCALE = 5

// ── helper components ─────────────────────────────────────────────────────────
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

// ── axis series options ───────────────────────────────────────────────────────
const AXIS_OPTS: Array<{ xKey: SeriesKey; yKey: SeriesKey; label: string }> = [
  { xKey: 'time', yKey: 'y',  label: 'time → height' },
  { xKey: 'time', yKey: 'vy', label: 'time → vy' },
  { xKey: 'time', yKey: 'x',  label: 'time → x' },
  { xKey: 'x',    yKey: 'y',  label: 'x → y  (phase)' },
  { xKey: 'time', yKey: 'ax', label: 'time → ax' },
]

const SCALE_OPTS: Array<{ s: PhysicsScale; label: string }> = [
  { s: DEFAULT_SCALE,    label: 'px' },
  { s: SCALE_PRESETS.cm, label: 'cm' },
  { s: SCALE_PRESETS.m,  label: 'm'  },
]

// ── main component ────────────────────────────────────────────────────────────
export function Day7Panel() {
  const worldRef  = useRef(new World())
  const recRef    = useRef(new DataRecorder())
  const interRef  = useRef(new InteractionLayer())
  const meterRef  = useRef(new FpsMeter(60))
  const ballRef   = useRef<Body | null>(null)

  const simRef    = useRef<HTMLCanvasElement>(null)
  const gfxRef    = useRef<HTMLCanvasElement>(null)
  const geRef     = useRef<GraphEngine | null>(null)
  const rafRef    = useRef(0)
  const lastTsRef = useRef(0)

  // Dirty-flag state (mirrors GraphCanvas)
  const lastLenRef   = useRef(-1)
  const drawnRef     = useRef(0)
  const skippedRef   = useRef(0)
  const pollTicksRef = useRef(0)

  // UI state
  const [axisIdx,  setAxisIdx]  = useState(0)
  const [scaleIdx, setScaleIdx] = useState(0)
  const [flipY,    setFlipY]    = useState(false)
  const [phase,    setPhase]    = useState<'idle' | 'running' | 'paused'>('idle')
  const [fps,      setFps]      = useState(0)
  const [samples,  setSamples]  = useState(0)
  const [drawn,    setDrawn]    = useState(0)
  const [skipped,  setSkipped]  = useState(0)
  const [xLabel,   setXLabel]   = useState('time (s)')
  const [yLabel,   setYLabel]   = useState('height (px)')

  const axisIdxRef  = useRef(0)
  const scaleIdxRef = useRef(0)
  const flipYRef    = useRef(false)
  const framesRef   = useRef(0)

  // ── draw mini-sim canvas ───────────────────────────────────────────────────
  const drawSim = useCallback((b: Body | null) => {
    const canvas = simRef.current
    if (!canvas || !b) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, SIM_W, SIM_H)
    ctx.fillStyle = '#070e1b'; ctx.fillRect(0, 0, SIM_W, SIM_H)

    // Grid
    ctx.strokeStyle = '#0d1b2e'; ctx.lineWidth = 0.5
    for (let x = 0; x <= SIM_W; x += 25) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, SIM_H); ctx.stroke() }
    for (let y = 0; y <= SIM_H; y += 25) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SIM_W, y); ctx.stroke() }

    // Walls
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 1; ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(WALL_L * SCALE, 0); ctx.lineTo(WALL_L * SCALE, FLOOR_Y * SCALE); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(WALL_R * SCALE, 0); ctx.lineTo(WALL_R * SCALE, FLOOR_Y * SCALE); ctx.stroke()
    ctx.setLineDash([])

    // Floor
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(0, FLOOR_Y * SCALE); ctx.lineTo(SIM_W, FLOOR_Y * SCALE); ctx.stroke()

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.ellipse(b.x * SCALE, FLOOR_Y * SCALE, BALL_RADIUS * SCALE * 0.8, 3, 0, 0, Math.PI * 2)
    ctx.fill()

    // Ball (radial gradient — T7.4 mirrors WorldCanvas)
    const bx = b.x * SCALE, by = b.y * SCALE, r = BALL_RADIUS * SCALE
    const gr = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.3, 1, bx, by, r)
    gr.addColorStop(0, '#93c5fd'); gr.addColorStop(1, '#1d4ed8')
    ctx.fillStyle = gr
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill()

    // Velocity arrow
    const vLen = Math.hypot(b.vx, b.vy)
    if (vLen > 0.1) {
      const ex = bx + b.vx * VEL_SCALE * SCALE
      const ey = by + b.vy * VEL_SCALE * SCALE
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke()
      const ang = Math.atan2(ey - by, ex - bx)
      ctx.fillStyle = '#ef4444'; ctx.beginPath()
      ctx.moveTo(ex, ey)
      ctx.lineTo(ex - 7 * Math.cos(ang - 0.4), ey - 7 * Math.sin(ang - 0.4))
      ctx.lineTo(ex - 7 * Math.cos(ang + 0.4), ey - 7 * Math.sin(ang + 0.4))
      ctx.closePath(); ctx.fill()
    }

    // FPS overlay
    const f = meterRef.current.fps
    ctx.fillStyle = f >= 55 ? '#22c55e33' : '#ef444433'
    ctx.fillRect(4, 4, 52, 16)
    ctx.fillStyle = f >= 55 ? '#4ade80' : '#f87171'
    ctx.font = 'bold 10px monospace'
    ctx.fillText(`${f.toFixed(0)} fps`, 8, 16)
  }, [])

  // ── draw graph via GraphEngine (T7.1) ─────────────────────────────────────
  const drawGraph = useCallback(() => {
    const ge  = geRef.current
    const rec = recRef.current
    if (!ge) return

    const ai = axisIdxRef.current
    const si = scaleIdxRef.current
    const fl = flipYRef.current
    const ax = AXIS_OPTS[ai]
    const sc = SCALE_OPTS[si].s

    const curLen = rec.getLength()

    // T7.3 — Dirty-flag: skip if length unchanged
    pollTicksRef.current++
    if (curLen === lastLenRef.current) {
      skippedRef.current++
      return
    }
    lastLenRef.current = curLen

    // T7.1 — draw() call
    ge.draw(rec, ax.xKey, ax.yKey, fl, sc)
    drawnRef.current++
  }, [])

  // ── rAF loop (T7.4 — engine → recorder → graph pipeline) ─────────────────
  const startLoop = useCallback(() => {
    const world = worldRef.current
    const rec   = recRef.current
    const inter = interRef.current
    const meter = meterRef.current

    const loop = (ts: number) => {
      meter.tick(ts)
      const rawDt = (ts - lastTsRef.current) / 1000
      const dt    = Math.min(rawDt, 0.016)
      lastTsRef.current = ts

      const b = ballRef.current

      if (!inter.isPaused() && !inter.isDragging() && b) {
        world.step(dt)
        framesRef.current++
        // Physical coords: y_phys = FLOOR_Y - canvas_y
        rec.record(world.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
      }

      drawSim(b)

      // Update React state ~10 Hz
      if (framesRef.current % 6 === 0) {
        setFps(Math.round(meter.fps))
        setSamples(rec.getLength())
        setDrawn(drawnRef.current)
        setSkipped(skippedRef.current)
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    lastTsRef.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)
  }, [drawSim])

  // ── 32ms graph polling interval (T7.3 — mirrors GraphCanvas) ─────────────
  useEffect(() => {
    if (!gfxRef.current) return
    geRef.current = new GraphEngine(gfxRef.current)
    lastLenRef.current = -1

    const id = setInterval(drawGraph, 32)   // 32ms = ~30fps
    return () => clearInterval(id)
  }, [drawGraph])

  // ── reset dirty-flag on axis/scale/flip change (T7.3) ────────────────────
  useEffect(() => {
    axisIdxRef.current  = axisIdx
    scaleIdxRef.current = scaleIdx
    flipYRef.current    = flipY
    lastLenRef.current  = -1   // force redraw on next poll

    const ax = AXIS_OPTS[axisIdx]
    const sc = SCALE_OPTS[scaleIdx].s
    setXLabel(axisLabel(ax.xKey, sc))
    setYLabel(axisLabel(ax.yKey, sc))
  }, [axisIdx, scaleIdx, flipY])

  // ── mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    ballRef.current = worldRef.current.addBody(new Body({ x: 300, y: 50 }))
    startLoop()
    return () => cancelAnimationFrame(rafRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── preset launchers ──────────────────────────────────────────────────────
  const handleLaunch = (preset: 'free-fall' | 'wall-bounce' | 'phase-space') => {
    const world = worldRef.current
    const b     = ballRef.current
    if (!b) return
    const configs = {
      'free-fall':   { x: 300, y: 30,  vx: 0,   vy: 0 },
      'wall-bounce': { x: 300, y: 100, vx: 250, vy: -50 },
      'phase-space': { x: 150, y: 80,  vx: 180, vy: 100 },
    }
    const cfg = configs[preset]
    Object.assign(b, { ...cfg, ax: 0, ay: 0 })
    world.time = 0; world.gravity = GRAVITY
    recRef.current.reset(); recRef.current.start()
    interRef.current.resume()
    framesRef.current = 0
    drawnRef.current  = 0
    skippedRef.current = 0
    lastLenRef.current = -1
    meterRef.current.reset()
    setPhase('running')
    setSamples(0); setDrawn(0); setSkipped(0)
  }

  const handlePause  = () => { interRef.current.pause();  setPhase('paused') }
  const handleResume = () => { interRef.current.resume(); setPhase('running') }

  const dirtyRatio = (drawn + skipped) > 0
    ? Math.round((skipped / (drawn + skipped)) * 100)
    : 0

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
        <span style={{ fontSize: 28 }}>📈</span>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#7dd3fc' }}>
            Day 7 — GraphEngine.ts + GraphCanvas.tsx
          </h2>
          <div style={{ marginTop: 4 }}>
            <Tag label="T7.1 draw()"       color="#4ade80" />
            <Tag label="T7.2 guards"        color="#f59e0b" />
            <Tag label="T7.3 dirty-flag"    color="#a78bfa" />
            <Tag label="T7.4 pipeline"      color="#60a5fa" />
            <Tag label="KAN-15 ✓"           color="#34d399" />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* ══ Col 1: Sim canvas + presets ════════════════════════════════ */}
        <div>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 6,
            textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.8 }}>
            World simulation → DataRecorder
          </div>
          <canvas ref={simRef} width={SIM_W} height={SIM_H}
            style={{ display: 'block', borderRadius: 8, border: '2px solid #1e293b', marginBottom: 10 }} />

          {/* Launch presets */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {([
              { id: 'free-fall'   as const, label: '↓ Free Fall',    color: '#3b82f6' },
              { id: 'wall-bounce' as const, label: '↔ Bounce',       color: '#f59e0b' },
              { id: 'phase-space' as const, label: '↗ Phase Space',  color: '#a78bfa' },
            ]).map(p => (
              <button key={p.id} onClick={() => handleLaunch(p.id)} style={{
                padding: '7px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
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

        {/* ══ Col 2: Live graph (T7.1 — GraphEngine.draw()) ══════════════ */}
        <div>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 6,
            textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.8 }}>
            GraphEngine.draw() → live chart
          </div>

          {/* Axis selector (T7.3 — changes reset dirty flag) */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
            {AXIS_OPTS.map((opt, i) => (
              <button key={i} onClick={() => setAxisIdx(i)} style={{
                padding: '4px 9px', borderRadius: 6, cursor: 'pointer', fontSize: 10,
                fontWeight: 700,
                background: axisIdx === i ? '#3b82f6' : '#0f172a',
                color:      axisIdx === i ? '#fff'    : '#475569',
                border:     `1px solid ${axisIdx === i ? '#3b82f6' : '#1e293b'}`,
              }}>{opt.label}</button>
            ))}
          </div>

          {/* Graph canvas */}
          <canvas ref={gfxRef} width={GFX_W} height={GFX_H}
            style={{
              display: 'block', background: '#fff', borderRadius: 8,
              border: '2px solid #1e293b', marginBottom: 8,
            }} />

          {/* Scale + flipY row (T7.3 — changes also reset dirty flag) */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: '#475569', fontWeight: 700 }}>Scale:</span>
            {SCALE_OPTS.map((opt, i) => (
              <button key={i} onClick={() => setScaleIdx(i)} style={{
                padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
                fontWeight: 700,
                background: scaleIdx === i ? '#a78bfa' : '#0f172a',
                color:      scaleIdx === i ? '#fff'    : '#475569',
                border:     `1px solid ${scaleIdx === i ? '#a78bfa' : '#1e293b'}`,
              }}>{opt.label}</button>
            ))}
            <button onClick={() => setFlipY(f => !f)} style={{
              padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
              fontWeight: 700, marginLeft: 8,
              background: flipY ? '#f59e0b' : '#0f172a',
              color:      flipY ? '#fff'    : '#475569',
              border:     `1px solid ${flipY ? '#f59e0b' : '#1e293b'}`,
            }}>flipY: {flipY ? '↓' : '↑'}</button>
          </div>

          {/* Current axis labels (T7.1 — axisLabel() from PhysicsScale) */}
          <div style={{ marginTop: 8, fontSize: 10, fontFamily: 'monospace',
            color: '#475569', background: '#050b14', borderRadius: 6, padding: '6px 10px' }}>
            <span style={{ color: '#4ade80' }}>X</span>: {xLabel}
            <span style={{ marginLeft: 16, color: '#60a5fa' }}>Y</span>: {yLabel}
          </div>
        </div>

        {/* ══ Col 3: T7.2 guards + T7.3 dirty-flag stats ═════════════════ */}
        <div style={{ minWidth: 200 }}>

          {/* T7.3 dirty-flag counters */}
          <div style={{
            background: '#0a1628', borderRadius: 8, padding: '12px 14px',
            marginBottom: 10, border: '1px solid #1e293b',
          }}>
            <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              ⚡ T7.3 — Dirty-flag (32ms poll)
            </div>
            <Stat label="samples"       value={samples}                         unit="pts"    color="#34d399" />
            <Stat label="draws"         value={drawn}                            unit="calls"  color="#4ade80" />
            <Stat label="skipped"       value={skipped}                          unit="frames" color="#f87171" />
            <Stat label="skip ratio"    value={`${dirtyRatio}%`}                 unit=""       color={dirtyRatio > 70 ? '#4ade80' : '#fbbf24'} />
            <Stat label="poll interval" value="32"                               unit="ms"     color="#475569" />
            <div style={{ marginTop: 6, fontSize: 9, color: '#334155', lineHeight: 1.6 }}>
              ✅ Skips draw() when getLength() == lastLen<br />
              ✅ Resets lastLen=-1 on axis/scale/flip change<br />
              ✅ ~30fps polling = 1000/32 ≈ 31.25fps
            </div>
          </div>

          {/* T7.2 guard conditions */}
          <div style={{
            background: '#0a1628', borderRadius: 8, padding: '12px 14px',
            marginBottom: 10, border: '1px solid #1e293b',
          }}>
            <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              🛡️ T7.2 — draw() guard conditions
            </div>
            {[
              { guard: 'ctx == null', action: 'return early (no throw)', done: true },
              { guard: '< 2 data pts', action: 'return early (no throw)', done: true },
              { guard: 'xRange = 0', action: '→ fallback xRange=1', done: true },
              { guard: 'yRange = 0', action: '→ fallback yRange=1', done: true },
            ].map(g => (
              <div key={g.guard} style={{
                display: 'flex', gap: 6, padding: '4px 0',
                borderBottom: '1px solid #0d1b2e', alignItems: 'flex-start',
              }}>
                <span style={{ color: '#22c55e', fontSize: 11, flexShrink: 0 }}>✅</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1', fontFamily: 'monospace' }}>
                    {g.guard}
                  </div>
                  <div style={{ fontSize: 9, color: '#475569' }}>{g.action}</div>
                </div>
              </div>
            ))}
          </div>

          {/* T7.1 draw() features */}
          <div style={{
            background: '#0a1628', borderRadius: 8, padding: '12px 14px',
            border: '1px solid #1e293b',
          }}>
            <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              🎨 T7.1 — draw() internals
            </div>
            {[
              { step: 'drawGrid()',  detail: '50px grid lines, #e8e8e8' },
              { step: 'drawAxes()',  detail: 'axisLabel() unit strings + min/max ticks' },
              { step: 'drawData()',  detail: 'auto-scale: xRange||1, yRange||1' },
              { step: 'flipY',       detail: 'negates all Y values pre-render' },
              { step: 'scale/ppu',   detail: 'divides by pixelsPerUnit when ppu≠1' },
              { step: 'time axis',   detail: 'never divided by ppu (always seconds)' },
            ].map(f => (
              <div key={f.step} style={{
                display: 'flex', gap: 6, padding: '4px 0',
                borderBottom: '1px solid #0d1b2e',
              }}>
                <span style={{ color: '#22c55e', fontSize: 11, flexShrink: 0 }}>✅</span>
                <div>
                  <code style={{ fontSize: 11, color: '#7dd3fc' }}>{f.step}</code>
                  <div style={{ fontSize: 9, color: '#475569' }}>{f.detail}</div>
                </div>
              </div>
            ))}

            {/* FPS summary */}
            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              <div style={{ flex: 1, background: '#050b14', borderRadius: 6,
                padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#334155' }}>sim fps</div>
                <div style={{ fontSize: 18, fontWeight: 800,
                  color: fps >= 55 ? '#4ade80' : '#f87171',
                  fontVariantNumeric: 'tabular-nums' }}>{fps}</div>
              </div>
              <div style={{ flex: 1, background: '#050b14', borderRadius: 6,
                padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#334155' }}>data pts</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#7dd3fc',
                  fontVariantNumeric: 'tabular-nums' }}>{samples}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
