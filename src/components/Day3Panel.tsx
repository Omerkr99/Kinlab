/**
 * Day3Panel — Day 3 Feature Showcase
 * Demonstrates KAN-41..45: wall collisions, recording indicator, data table, CSV, gravity.
 * The demo launches the ball with vx=200 so wall bouncing is immediately visible.
 */
import { useEffect, useRef, useState } from 'react'
import { World, Body, InteractionLayer } from '../engine'
import { DataRecorder, SeriesKey } from '../recorder'
import { GraphEngine } from '../graph/GraphEngine'
import {
  FLOOR_Y, CANVAS_W, BALL_RADIUS,
  WALL_L, WALL_R, WALL_DAMPING, GRAVITY,
} from '../constants'

// ─── Scale: map 600-wide world → 300-wide canvas ─────────────────────────────
const SCALE   = 0.5
const SIM_W   = Math.round(CANVAS_W * SCALE)        // 300
const SIM_H   = Math.round((FLOOR_Y + 20) * SCALE)  // 260

// ─── MiniGraph ───────────────────────────────────────────────────────────────
function MiniGraph({
  recorder, xKey, yKey, label, color,
}: {
  recorder: DataRecorder; xKey: SeriesKey; yKey: SeriesKey
  label: string; color: string
}) {
  const ref    = useRef<HTMLCanvasElement>(null)
  const engRef = useRef<GraphEngine | null>(null)

  useEffect(() => { if (ref.current) engRef.current = new GraphEngine(ref.current) }, [])

  useEffect(() => {
    const id = setInterval(() => { engRef.current?.draw(recorder, xKey, yKey) }, 50)
    return () => clearInterval(id)
  }, [recorder, xKey, yKey])

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 3, color, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </div>
      <canvas ref={ref} width={210} height={130}
        style={{ border: `2px solid ${color}`, borderRadius: 6, background: '#fff', display: 'block' }} />
    </div>
  )
}

// ─── Feature badge ────────────────────────────────────────────────────────────
function Badge({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 10px', borderRadius: 8,
      background: done ? '#f0faf4' : '#fff8f0',
      border: `1px solid ${done ? '#b7e4c7' : '#ffd59e'}`,
      marginBottom: 5,
    }}>
      <span style={{ fontSize: 16, lineHeight: 1 }}>{done ? '✅' : '🔲'}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: done ? '#1a7f37' : '#9a6700' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#666', marginTop: 1 }}>{detail}</div>
      </div>
    </div>
  )
}

// ─── Gravity presets ──────────────────────────────────────────────────────────
const G_PRESETS = [
  { label: 'Zero-G', value: 0,    icon: '🚀' },
  { label: 'Moon',   value: 1.6,  icon: '🌙' },
  { label: 'Earth',  value: 9.8,  icon: '🌍' },
  { label: 'Jupiter',value: 24.8, icon: '🪐' },
]

// ─── Main component ───────────────────────────────────────────────────────────
export function Day3Panel() {
  const worldRef  = useRef(new World())
  const recRef    = useRef(new DataRecorder())
  const interRef  = useRef(new InteractionLayer())
  const ballRef   = useRef<Body | null>(null)
  const rafRef    = useRef<number>(0)
  const lastTsRef = useRef(0)
  const simRef    = useRef<HTMLCanvasElement>(null)

  // Wall flash: stored in ref so canvas drawing is immediate without React re-render
  const flashRef = useRef<{ side: 'left' | 'right' | null; until: number }>({ side: null, until: 0 })

  const [phase,        setPhase]        = useState<'idle' | 'running' | 'paused'>('idle')
  const [wallBounces,  setWallBounces]  = useState(0)
  const [floorBounces, setFloorBounces] = useState(0)
  const [ballPos,      setBallPos]      = useState({ x: 300, y: 50, vx: 0 })
  const [gravity,      setGravity]      = useState(GRAVITY)

  // ── Draw simulation canvas ─────────────────────────────────────────────────
  const drawSim = (ts: number) => {
    const canvas = simRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const b = ballRef.current
    if (!b) return

    ctx.clearRect(0, 0, SIM_W, SIM_H)

    // Background
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, SIM_W, SIM_H)

    // Wall flash overlays
    const flash   = flashRef.current
    const leftOn  = flash.side === 'left'  && ts < flash.until
    const rightOn = flash.side === 'right' && ts < flash.until
    if (leftOn) {
      const alpha = Math.min(1, (flash.until - ts) / 200)
      ctx.fillStyle = `rgba(239,68,68,${(alpha * 0.4).toFixed(2)})`
      ctx.fillRect(0, 0, WALL_L * SCALE + 6, SIM_H)
    }
    if (rightOn) {
      const alpha = Math.min(1, (flash.until - ts) / 200)
      ctx.fillStyle = `rgba(239,68,68,${(alpha * 0.4).toFixed(2)})`
      ctx.fillRect(WALL_R * SCALE - 6, 0, SIM_W - WALL_R * SCALE + 6, SIM_H)
    }

    // Left wall
    ctx.strokeStyle = leftOn ? '#ef4444' : '#475569'
    ctx.lineWidth   = leftOn ? 3 : 1.5
    ctx.beginPath(); ctx.moveTo(WALL_L * SCALE, 0); ctx.lineTo(WALL_L * SCALE, FLOOR_Y * SCALE); ctx.stroke()

    // Right wall
    ctx.strokeStyle = rightOn ? '#ef4444' : '#475569'
    ctx.lineWidth   = rightOn ? 3 : 1.5
    ctx.beginPath(); ctx.moveTo(WALL_R * SCALE, 0); ctx.lineTo(WALL_R * SCALE, FLOOR_Y * SCALE); ctx.stroke()

    // Wall labels
    ctx.fillStyle = '#64748b'; ctx.font = '9px monospace'
    ctx.fillText(`L=${WALL_L}`, WALL_L * SCALE + 2, 12)
    ctx.textAlign = 'right'
    ctx.fillText(`R=${WALL_R}`, WALL_R * SCALE - 2, 12)
    ctx.textAlign = 'left'

    // Floor
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(0, FLOOR_Y * SCALE); ctx.lineTo(SIM_W, FLOOR_Y * SCALE); ctx.stroke()
    ctx.fillStyle = '#334155'; ctx.font = '9px monospace'
    ctx.fillText(`floor=${FLOOR_Y}`, 4, FLOOR_Y * SCALE - 3)

    // Ball shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.ellipse(b.x * SCALE, FLOOR_Y * SCALE, BALL_RADIUS * SCALE * 0.85, 3.5, 0, 0, Math.PI * 2)
    ctx.fill()

    // Ball
    const bx = b.x * SCALE, by = b.y * SCALE
    const gr = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, BALL_RADIUS * SCALE)
    gr.addColorStop(0, '#93c5fd')
    gr.addColorStop(1, '#3b82f6')
    ctx.fillStyle = gr
    ctx.beginPath(); ctx.arc(bx, by, BALL_RADIUS * SCALE, 0, Math.PI * 2); ctx.fill()

    // Velocity arrow
    const speed = Math.hypot(b.vx, b.vy)
    if (speed > 2) {
      const arrowScale = 0.8
      const ex = bx + b.vx * arrowScale * SCALE
      const ey = by + b.vy * arrowScale * SCALE
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke()
      const ang = Math.atan2(ey - by, ex - bx)
      ctx.fillStyle = '#f59e0b'
      ctx.beginPath()
      ctx.moveTo(ex, ey)
      ctx.lineTo(ex - 7 * Math.cos(ang - 0.4), ey - 7 * Math.sin(ang - 0.4))
      ctx.lineTo(ex - 7 * Math.cos(ang + 0.4), ey - 7 * Math.sin(ang + 0.4))
      ctx.closePath(); ctx.fill()
    }
  }

  // ── rAF loop ───────────────────────────────────────────────────────────────
  const startLoop = () => {
    const world = worldRef.current
    const rec   = recRef.current
    const inter = interRef.current

    const loop = (ts: number) => {
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.016)
      lastTsRef.current = ts

      if (!inter.isPaused()) {
        const b = ballRef.current
        const prevVx = b ? b.vx : 0
        const prevVy = b ? b.vy : 0

        world.step(dt)

        if (b) {
          // Detect wall bounce: vx sign flip with enough speed
          if (prevVx < 0 && b.vx > 0 && Math.abs(prevVx) > 5) {
            flashRef.current = { side: 'left', until: ts + 350 }
            setWallBounces(n => n + 1)
          } else if (prevVx > 0 && b.vx < 0 && Math.abs(prevVx) > 5) {
            flashRef.current = { side: 'right', until: ts + 350 }
            setWallBounces(n => n + 1)
          }

          // Detect floor bounce: was falling (canvas-vy > 0), now going up
          if (prevVy > 2 && b.vy < 0) {
            setFloorBounces(n => n + 1)
          }

          rec.record(world.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
          setBallPos({ x: Math.round(b.x), y: Math.round(b.y), vx: Math.round(b.vx) })
        }
      }

      drawSim(ts)
      rafRef.current = requestAnimationFrame(loop)
    }

    lastTsRef.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handlePlay = () => {
    const world = worldRef.current
    const b     = ballRef.current
    world.time    = 0
    world.gravity = gravity
    if (b) { b.x = 300; b.y = 50; b.vx = 200; b.vy = 0; b.ax = 0; b.ay = 0 }
    recRef.current.reset()
    recRef.current.start()
    interRef.current.resume()
    setPhase('running')
    setWallBounces(0)
    setFloorBounces(0)
    setBallPos({ x: 300, y: 50, vx: 200 })
    flashRef.current = { side: null, until: 0 }
  }

  const handlePause  = () => { interRef.current.pause();  setPhase('paused') }
  const handleResume = () => { interRef.current.resume(); setPhase('running') }

  const handleGravity = (g: number) => {
    worldRef.current.gravity = g
    setGravity(g)
  }

  // ── Mount ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    ballRef.current = worldRef.current.addBody(new Body({ x: 300, y: 50 }))
    startLoop()
    return () => cancelAnimationFrame(rafRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────
  const sampleCount = recRef.current.getLength()

  return (
    <div style={{
      marginTop: 32, padding: 24,
      background: '#1a1a2e', borderRadius: 16, color: '#fff',
      fontFamily: 'system-ui, sans-serif',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <span style={{ fontSize: 28 }}>🧱</span>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#7dd3fc' }}>
            Day 3 — Wall Collisions &amp; Controls Demo
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#94a3b8' }}>
            KAN-41..45 · הדגמה חיה: wall bounce · recording indicator · data table · CSV · gravity
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* ── Left: simulation ── */}
        <div style={{ minWidth: SIM_W }}>
          <canvas ref={simRef} width={SIM_W} height={SIM_H}
            style={{ border: '2px solid #334155', borderRadius: 10, display: 'block', marginBottom: 10 }} />

          {/* Controls */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <button onClick={handlePlay} style={{
              padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#4A90E2', color: '#fff', fontWeight: 700, fontSize: 12,
            }}>▶ Launch vx=200</button>
            {phase === 'running' && (
              <button onClick={handlePause} style={{
                padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#475569', color: '#fff', fontWeight: 700, fontSize: 12,
              }}>⏸ Pause</button>
            )}
            {phase === 'paused' && (
              <button onClick={handleResume} style={{
                padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: 12,
              }}>▶ Resume</button>
            )}
          </div>

          {/* Bounce counters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{
              flex: 1, padding: '10px 12px', borderRadius: 8, textAlign: 'center',
              background: wallBounces > 0 ? '#1e3a5f' : '#0f172a',
              border: `2px solid ${wallBounces > 0 ? '#3b82f6' : '#1e293b'}`,
              transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#60a5fa', lineHeight: 1 }}>{wallBounces}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>🧱 Wall Bounces</div>
            </div>
            <div style={{
              flex: 1, padding: '10px 12px', borderRadius: 8, textAlign: 'center',
              background: floorBounces > 0 ? '#14352a' : '#0f172a',
              border: `2px solid ${floorBounces > 0 ? '#22c55e' : '#1e293b'}`,
              transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#4ade80', lineHeight: 1 }}>{floorBounces}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>🏔️ Floor Bounces</div>
            </div>
          </div>

          {/* Ball state */}
          <div style={{
            background: '#0f172a', borderRadius: 8, padding: 10, fontSize: 11,
            fontFamily: 'monospace', color: '#94a3b8', lineHeight: 1.9,
          }}>
            <div style={{ color: '#7dd3fc', fontWeight: 700, marginBottom: 3 }}>📡 Live State</div>
            <div>x&nbsp;&nbsp;= <span style={{ color: '#fbbf24' }}>{ballPos.x}</span>
              <span style={{ color: '#475569' }}> px  [{WALL_L}…{WALL_R}]</span></div>
            <div>y&nbsp;&nbsp;= <span style={{ color: '#fbbf24' }}>{ballPos.y}</span>
              <span style={{ color: '#475569' }}> px  (canvas, 0=top)</span></div>
            <div>vx = <span style={{ color: ballPos.vx > 0 ? '#34d399' : ballPos.vx < 0 ? '#f87171' : '#94a3b8' }}>
              {ballPos.vx > 0 ? '+' : ''}{ballPos.vx}
            </span><span style={{ color: '#475569' }}> px/s</span></div>
            <div>samples = <span style={{ color: '#34d399' }}>{sampleCount}</span></div>
            <div>status = <span style={{ color: phase === 'running' ? '#22c55e' : phase === 'paused' ? '#f59e0b' : '#64748b' }}>
              {phase}
            </span></div>
          </div>

          {/* Gravity presets */}
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              🌍 KAN-45 Gravity
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {G_PRESETS.map(p => (
                <button key={p.label} onClick={() => handleGravity(p.value)} style={{
                  padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  background: Math.abs(gravity - p.value) < 0.01 ? '#3b82f6' : '#1e293b',
                  color: Math.abs(gravity - p.value) < 0.01 ? '#fff' : '#94a3b8',
                  fontWeight: 700, fontSize: 11, transition: 'all 0.15s',
                }}>
                  {p.icon} {p.value}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Centre: graphs ── */}
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, fontWeight: 600 }}>
            📈 KAN-42 — x vs time (sawtooth = wall bounces), trajectory &amp; vx sign flips
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <MiniGraph recorder={recRef.current} xKey="time" yKey="x"
              label="time → x (wall bounces!)" color="#3b82f6" />
            <MiniGraph recorder={recRef.current} xKey="x" yKey="y"
              label="x → height (trajectory)" color="#a78bfa" />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <MiniGraph recorder={recRef.current} xKey="time" yKey="vx"
              label="time → vx (sign flips @ walls)" color="#f59e0b" />
            <MiniGraph recorder={recRef.current} xKey="time" yKey="y"
              label="time → height (bounces)" color="#22c55e" />
          </div>

          {/* Legend */}
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 8,
            background: '#0f172a', fontSize: 11, color: '#64748b', lineHeight: 1.8,
          }}>
            <div style={{ color: '#7dd3fc', fontWeight: 700, marginBottom: 4 }}>📐 Wall Bounds</div>
            <div>WALL_L = BALL_RADIUS = <span style={{ color: '#fbbf24' }}>{WALL_L} px</span></div>
            <div>WALL_R = CANVAS_W − BALL_RADIUS = <span style={{ color: '#fbbf24' }}>{WALL_R} px</span></div>
            <div>WALL_DAMPING = <span style={{ color: '#fbbf24' }}>{WALL_DAMPING}</span>
              <span style={{ color: '#475569' }}> (20% energy loss per wall hit)</span></div>
          </div>
        </div>

        {/* ── Right: feature checklist ── */}
        <div style={{ minWidth: 290 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            ✅ Day 3 — Changes Delivered
          </div>
          <Badge done label="KAN-41 — RecordingIndicator"
            detail="● REC (red pulse) / PAUSED (amber) / idle — in ControlBar" />
          <Badge done label="KAN-42 — Wall Collisions"
            detail={`x ∈ [${WALL_L}, ${WALL_R}] · WALL_DAMPING=${WALL_DAMPING} · directional guard`} />
          <Badge done label="KAN-43 — DataTable"
            detail="Collapsible · last 150 rows · auto-scroll · 250ms poll" />
          <Badge done label="KAN-44 — CSV Export"
            detail="buildCsv() → 6-decimal rows · Blob download · header time,x,y_height,…" />
          <Badge done label="KAN-45 — Gravity Slider"
            detail="range 0–30 · live mutation · Earth/Moon/Jupiter presets" />

          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 8,
            background: '#0f172a', fontSize: 11, color: '#64748b', lineHeight: 1.8,
          }}>
            <span style={{ color: '#7dd3fc', fontWeight: 700 }}>131/131 tests ✅</span>
            &nbsp;· KAN-41..45 complete · Day 3 delivered
          </div>
        </div>
      </div>
    </div>
  )
}
