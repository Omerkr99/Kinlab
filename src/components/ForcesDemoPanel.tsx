/**
 * ForcesDemoPanel — Interactive demo of every Day-9 force type.
 *
 * Four tabbed scenes, each running its own World in the force-pipeline path:
 *
 *   🌍 GravityForce    — F = mg, a = g (mass-independent) — two balls, diff. masses
 *   🌀 SpringForce     — F = k·(d-L₀), PE = ½kx²         — anchored oscillation
 *   🔗 SpringForce B2B — Newton's 3rd law: F_A = -F_B      — two balls, equal/opposite
 *   💨 DragForce       — F = -c·v                          — trajectory vs no-drag ghost
 *
 * All worlds use world.addForce() → force-pipeline path (ax = fx/mass, ay = fy/mass).
 * Force arrows are drawn from the live b.fx / b.fy values after each step.
 * PhysicsEventBus is wired to the gravity scene for impulse counting.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { World, Body }     from '../engine'
import { GravityForce }    from '../engine/forces/GravityForce'
import { DragForce }       from '../engine/forces/DragForce'
import { Spring }          from '../engine/Spring'
import { PhysicsEventBus } from '../engine/PhysicsEvents'
import {
  kineticEnergy, springPotentialEnergy, roundTo,
} from '../utils/math'
import { FLOOR_Y, CANVAS_W, BALL_RADIUS, WALL_L, WALL_R } from '../constants'

// ── Canvas layout ─────────────────────────────────────────────────────────────
const SC   = 0.5                                      // draw scale
const CW   = Math.round(CANVAS_W * SC)                // 300
const CH   = Math.round((FLOOR_Y + 20) * SC)          // 260
const FY   = Math.round(FLOOR_Y * SC)                 // 250  (canvas floor y)
const BR   = Math.round(BALL_RADIUS * SC)             // 10   (ball radius on canvas)

// ── Scene types ───────────────────────────────────────────────────────────────
type SceneKey = 'gravity' | 'spring' | 'b2b' | 'drag'

// ── Shared drawing helpers ────────────────────────────────────────────────────
function drawBg(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#070e1b'; ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#0d1b2e'; ctx.lineWidth = 0.5
  for (let x = 0; x <= w; x += 25) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
  for (let y = 0; y <= h; y += 25) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
}
function drawFloor(ctx: CanvasRenderingContext2D, w: number) {
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, FY); ctx.lineTo(w, FY); ctx.stroke()
}
function drawBall(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  color0 = '#93c5fd', color1 = '#1d4ed8',
) {
  const gr = ctx.createRadialGradient(cx - BR * 0.3, cy - BR * 0.3, 1, cx, cy, BR)
  gr.addColorStop(0, color0); gr.addColorStop(1, color1)
  ctx.fillStyle = gr
  ctx.beginPath(); ctx.arc(cx, cy, BR, 0, Math.PI * 2); ctx.fill()
}
function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  color: string,
  width = 2,
) {
  const len = Math.hypot(x2 - x1, y2 - y1)
  if (len < 2) return
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  const ang = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - 7 * Math.cos(ang - 0.4), y2 - 7 * Math.sin(ang - 0.4))
  ctx.lineTo(x2 - 7 * Math.cos(ang + 0.4), y2 - 7 * Math.sin(ang + 0.4))
  ctx.closePath(); ctx.fill()
}
function drawSpringCoil(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  color: string, coils = 7, amp = 7,
) {
  const len = Math.hypot(x2 - x1, y2 - y1)
  if (len < 2) return
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len
  const px = -uy, py = ux
  ctx.strokeStyle = color; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(x1, y1)
  const seg = coils * 2
  for (let i = 1; i <= seg; i++) {
    const t = i / seg
    const side = (i % 2 === 0 ? 1 : -1) * amp
    ctx.lineTo(x1 + ux * len * t + px * side, y1 + uy * len * t + py * side)
  }
  ctx.lineTo(x2, y2); ctx.stroke()
}
function label(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  color = '#94a3b8', size = 10, align: CanvasTextAlign = 'left',
) {
  ctx.fillStyle = color; ctx.font = `bold ${size}px monospace`; ctx.textAlign = align
  ctx.fillText(text, x, y)
}

// ── Helper UI components ──────────────────────────────────────────────────────
function Tag({ t, c }: { t: string; c: string }) {
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
    background: c + '22', color: c, border: `1px solid ${c}44`, marginRight: 5 }}>{t}</span>
}
function Stat({ lbl, val, unit, color = '#7dd3fc' }: {
  lbl: string; val: string | number; unit?: string; color?: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '3px 0', borderBottom: '1px solid #1e293b', fontSize: 11, fontFamily: 'monospace' }}>
      <span style={{ color: '#64748b' }}>{lbl}</span>
      <span><span style={{ color, fontWeight: 700 }}>{val}</span>
        {unit && <span style={{ color: '#334155', marginLeft: 4, fontSize: 9 }}>{unit}</span>}</span>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ForcesDemoPanel() {
  const [tab, setTab]   = useState<SceneKey>('gravity')
  const tabRef          = useRef<SceneKey>('gravity')
  const frameRef        = useRef(0)

  // ── Slider state + ref mirrors ────────────────────────────────────────────
  const [grav,     setGrav]     = useState(9.8)
  const [springK,  setSpringK]  = useState(4)
  const [springRL, setSpringRL] = useState(100)
  const [springD,  setSpringD]  = useState(0.4)
  const [b2bK,     setB2bK]     = useState(3)
  const [dragC,    setDragC]    = useState(1.5)
  const gravRef = useRef(9.8); const springKRef = useRef(4)
  const springRLRef = useRef(100); const springDRef = useRef(0.4)
  const b2bKRef = useRef(3); const dragCRef = useRef(1.5)

  // ── Live stat state ───────────────────────────────────────────────────────
  const [s, setS] = useState({
    // gravity scene
    fA: '0', aA: '0', fB: '0', aB: '0', bounces: 0,
    // spring scene
    ext: '0', tension: '0', ke: '0', pe: '0', totE: '0',
    // b2b scene
    fxA: '0', fxB: '0', fDiff: '0', comX: '0',
    // drag scene
    vxFree: '0', vxDrag: '0', ratio: '0',
  })

  // ── Canvas refs ───────────────────────────────────────────────────────────
  const c1 = useRef<HTMLCanvasElement>(null)
  const c2 = useRef<HTMLCanvasElement>(null)
  const c3 = useRef<HTMLCanvasElement>(null)
  const c4 = useRef<HTMLCanvasElement>(null)

  // ── Scene 1: Gravity ──────────────────────────────────────────────────────
  const g1 = useRef({
    world: new World(), bA: null as Body | null, bB: null as Body | null,
    bus: new PhysicsEventBus(), bounces: 0, resetAt: 0,
  })
  const setupG1 = useCallback(() => {
    const sim = g1.current
    sim.world = new World()
    sim.world.gravity = gravRef.current
    sim.world.bus = sim.bus
    sim.bounces = 0
    sim.bA = sim.world.addBody(new Body({ x: 150, y: 40, mass: 1 }))
    sim.bB = sim.world.addBody(new Body({ x: 450, y: 40, mass: 3 }))
    sim.world.addForce(new GravityForce())
    sim.resetAt = 0
  }, [])

  // ── Scene 2: Spring (Anchored) ────────────────────────────────────────────
  const g2 = useRef({
    world: new World(), ball: null as Body | null, spring: null as Spring | null,
  })
  const setupG2 = useCallback(() => {
    const sim = g2.current
    sim.world = new World()
    const rl = springRLRef.current
    const startY = Math.min(80 + rl + 20, FLOOR_Y - BALL_RADIUS - 10)
    sim.ball = sim.world.addBody(new Body({ x: 300, y: startY, mass: 1 }))
    sim.spring = new Spring({
      bodyA: sim.ball, stiffness: springKRef.current,
      restLength: rl, damping: springDRef.current,
      anchorX: 300, anchorY: 80,
    })
    sim.world.addForce(new GravityForce())
    sim.world.addForce(sim.spring.makeForce())
  }, [])

  // ── Scene 3: Spring Body-to-Body ──────────────────────────────────────────
  const g3 = useRef({
    world: new World(), bA: null as Body | null, bB: null as Body | null,
    spring: null as Spring | null,
  })
  const setupG3 = useCallback(() => {
    const sim = g3.current
    sim.world = new World()
    sim.world.gravity = 0   // no gravity for horizontal purity
    sim.bA = sim.world.addBody(new Body({ x: 200, y: 260, vx: 40, mass: 1 }))
    sim.bB = sim.world.addBody(new Body({ x: 400, y: 260, vx: -40, mass: 1 }))
    sim.spring = new Spring({
      bodyA: sim.bA, bodyB: sim.bB,
      stiffness: b2bKRef.current, restLength: 200, damping: 0.3,
    })
    sim.world.addForce(sim.spring.makeForce())
  }, [])

  // ── Scene 4: Drag ─────────────────────────────────────────────────────────
  const g4 = useRef({
    wFree: new World(), wDrag: new World(),
    bFree: null as Body | null, bDrag: null as Body | null,
    trailFree: [] as [number, number][], trailDrag: [] as [number, number][],
    resetAt: 0,
  })
  const setupG4 = useCallback(() => {
    const sim = g4.current
    sim.wFree = new World()
    sim.wDrag = new World()
    sim.bFree = sim.wFree.addBody(new Body({ x: 30, y: 80, vx: 220, vy: 0, mass: 1 }))
    sim.bDrag = sim.wDrag.addBody(new Body({ x: 30, y: 80, vx: 220, vy: 0, mass: 1 }))
    sim.wFree.addForce(new GravityForce())
    sim.wDrag.addForce(new GravityForce())
    sim.wDrag.addForce(new DragForce(dragCRef.current))
    sim.trailFree = []
    sim.trailDrag = []
    sim.resetAt = 0
  }, [])

  // ── Step functions ────────────────────────────────────────────────────────
  const stepG1 = (dt: number) => {
    const sim = g1.current
    if (sim.resetAt > 0 && Date.now() >= sim.resetAt) { setupG1(); return }
    sim.world.gravity = gravRef.current
    if (!sim.bA || !sim.bB) return
    sim.world.step(dt)
    const atRest = sim.bA.vy === 0 && sim.bA.vx === 0 && sim.bB.vy === 0 && sim.bB.vx === 0
      && sim.bA.y >= FLOOR_Y - 1 && sim.bB.y >= FLOOR_Y - 1
    if (atRest && sim.resetAt === 0) sim.resetAt = Date.now() + 2000
  }
  const stepG2 = (dt: number) => {
    const sim = g2.current
    if (!sim.ball || !sim.spring) return
    sim.world.step(dt)
  }
  const stepG3 = (dt: number) => {
    const sim = g3.current
    if (!sim.bA || !sim.bB) return
    sim.world.step(dt)
  }
  const stepG4 = (dt: number) => {
    const sim = g4.current
    if (sim.resetAt > 0 && Date.now() >= sim.resetAt) { setupG4(); return }
    sim.wFree.step(dt)
    sim.wDrag.step(dt)
    if (sim.bFree) sim.trailFree.push([sim.bFree.x * SC, sim.bFree.y * SC])
    if (sim.bDrag) sim.trailDrag.push([sim.bDrag.x * SC, sim.bDrag.y * SC])
    if (sim.trailFree.length > 120) sim.trailFree.shift()
    if (sim.trailDrag.length > 120) sim.trailDrag.shift()
    const fRested = !sim.bFree || (sim.bFree.vy === 0 && sim.bFree.y >= FLOOR_Y - 1)
    const dRested = !sim.bDrag || (sim.bDrag.vy === 0 && sim.bDrag.y >= FLOOR_Y - 1)
    if (fRested && dRested && sim.resetAt === 0) sim.resetAt = Date.now() + 1500
  }

  // ── Draw functions ────────────────────────────────────────────────────────
  const drawG1 = () => {
    const canvas = c1.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const sim = g1.current; if (!sim.bA || !sim.bB) return
    const g = gravRef.current

    drawBg(ctx, CW, CH); drawFloor(ctx, CW)
    // Walls
    ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 1; ctx.setLineDash([3,3])
    ctx.beginPath(); ctx.moveTo(WALL_L*SC,0); ctx.lineTo(WALL_L*SC,FY); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(WALL_R*SC,0); ctx.lineTo(WALL_R*SC,FY); ctx.stroke()
    ctx.setLineDash([])

    for (const [b, col0, col1, mlabel] of [
      [sim.bA, '#fde68a', '#d97706', 'm=1'] as const,
      [sim.bB, '#c4b5fd', '#7c3aed', 'm=3'] as const,
    ]) {
      const bx = b.x*SC, by = b.y*SC
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.beginPath(); ctx.ellipse(bx, FY, BR*0.8, 2, 0, 0, Math.PI*2); ctx.fill()
      // Ball
      drawBall(ctx, bx, by, col0, col1)
      // Mass label
      label(ctx, mlabel as string, bx, by + BR + 14, col0, 9, 'center')
      // Force arrow (orange, downward) — length = F * scale, F = mass*g
      const fMag = b.mass * g
      const arrowLen = Math.min(fMag * 1.5, 60)
      if (arrowLen > 4) {
        drawArrow(ctx, bx, by + BR, bx, by + BR + arrowLen, '#fb923c', 2)
        label(ctx, `F=${fMag.toFixed(1)}`, bx + BR + 4, by + BR + arrowLen * 0.6, '#fb923c', 8)
      }
      // Velocity arrow (red, direction of vy)
      const vMag = Math.abs(b.vy)
      if (vMag > 0.5) {
        const dir = b.vy > 0 ? 1 : -1
        drawArrow(ctx, bx - BR - 6, by, bx - BR - 6, by + dir * Math.min(vMag * 1.5, 50), '#f87171', 1.5)
      }
    }
    // Annotation: a = g (mass-independent)
    ctx.fillStyle = '#0f2a3f'; ctx.fillRect(4, 4, 140, 30)
    label(ctx, `a = F/m = g = ${g.toFixed(1)} px/s²`, 8, 14, '#4ade80', 8)
    label(ctx, 'same acceleration, different force', 8, 28, '#475569', 7)
    // Bounce counter
    label(ctx, `bounces: ${sim.bounces}`, CW - 6, 14, '#60a5fa', 8, 'right')
  }

  const drawG2 = () => {
    const canvas = c2.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const sim = g2.current; if (!sim.ball || !sim.spring) return
    const b = sim.ball, sp = sim.spring

    drawBg(ctx, CW, CH); drawFloor(ctx, CW)
    const ax = 300*SC, ay = 80*SC
    const bx = b.x*SC, by = b.y*SC
    const ext = sp.extension

    // Anchor
    ctx.fillStyle = '#475569'
    ctx.fillRect(ax - 20, ay - 8, 40, 8)
    ctx.fillStyle = '#94a3b8'
    ctx.beginPath(); ctx.arc(ax, ay, 4, 0, Math.PI*2); ctx.fill()

    // Spring
    const springColor = ext > 5 ? '#f87171' : ext < -5 ? '#60a5fa' : '#4ade80'
    drawSpringCoil(ctx, ax, ay, bx, by, springColor, 8, 7)

    // Spring force vector (toward anchor)
    const tension = sp.stiffness * ext
    const dist = sp.currentLength
    if (dist > 1) {
      const ux = (ax - bx) / (dist*SC), uy = (ay - by) / (dist*SC)
      const fLen = Math.min(Math.abs(tension) * 0.5, 55)
      if (fLen > 3) {
        const dir = tension > 0 ? 1 : -1
        drawArrow(ctx, bx, by, bx + ux*fLen*dir, by + uy*fLen*dir, '#a78bfa', 2)
        label(ctx, `F=${tension.toFixed(1)}`, bx + BR + 4, by - 4, '#a78bfa', 8)
      }
    }

    // Extension gauge (right edge)
    const gaugeX = CW - 18, gaugeH = 100, gaugeY = 80
    ctx.fillStyle = '#0f172a'; ctx.fillRect(gaugeX - 4, gaugeY, 12, gaugeH)
    const fillH = Math.max(0, Math.min(gaugeH, Math.abs(ext) * 0.4))
    ctx.fillStyle = ext > 0 ? '#f87171' : '#60a5fa'
    ctx.fillRect(gaugeX - 4, gaugeY + gaugeH - fillH, 12, fillH)
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 1
    ctx.strokeRect(gaugeX - 4, gaugeY, 12, gaugeH)
    label(ctx, 'ext', gaugeX, gaugeY - 4, '#64748b', 8, 'center')
    label(ctx, `${ext > 0 ? '+' : ''}${Math.round(ext)}`, gaugeX, gaugeY + gaugeH + 12, springColor, 8, 'center')

    // Ball
    drawBall(ctx, bx, by)

    // Energy annotation
    const ke = kineticEnergy(b.vx, b.vy, b.mass)
    const pe = springPotentialEnergy(sp.stiffness, ext)
    ctx.fillStyle = '#0a1628'; ctx.fillRect(4, 4, 136, 36)
    label(ctx, `KE=${ke.toFixed(0)}  PE=${pe.toFixed(0)}`, 8, 14, '#7dd3fc', 8)
    label(ctx, `k=${sp.stiffness}  L₀=${sp.restLength}px  d=${sp.damping}`, 8, 28, '#64748b', 7)
    // Formula
    label(ctx, `F = k·(d−L₀) = ${tension.toFixed(1)}`, 8, CH - 10, '#a78bfa', 8)
  }

  const drawG3 = () => {
    const canvas = c3.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const sim = g3.current; if (!sim.bA || !sim.bB || !sim.spring) return
    const bA = sim.bA, bB = sim.bB, sp = sim.spring

    drawBg(ctx, CW, CH)
    const ax = bA.x*SC, ay = bA.y*SC
    const bx = bB.x*SC, by = bB.y*SC
    const midX = (ax + bx) / 2

    // COM vertical line (dashed, stays fixed)
    const comX = (bA.x + bB.x) / 2 * SC
    ctx.strokeStyle = '#f59e0b33'; ctx.lineWidth = 1; ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(comX, 20); ctx.lineTo(comX, CH - 20); ctx.stroke()
    ctx.setLineDash([])
    label(ctx, 'COM', comX, 18, '#f59e0b', 8, 'center')

    // Spring
    const ext = sp.extension
    const springColor = ext > 5 ? '#f87171' : ext < -5 ? '#60a5fa' : '#4ade80'
    drawSpringCoil(ctx, ax, ay, bx, by, springColor, 7, 7)

    // Force arrows from b.fx (force pipeline values)
    const fxA = bA.fx, fxB = bB.fx
    const fScale = 0.4, maxLen = 70
    const lenA = Math.min(Math.abs(fxA) * fScale, maxLen)
    const lenB = Math.min(Math.abs(fxB) * fScale, maxLen)
    if (lenA > 3) drawArrow(ctx, ax, ay, ax + Math.sign(fxA)*lenA, ay, '#fb923c', 2.5)
    if (lenB > 3) drawArrow(ctx, bx, by, bx + Math.sign(fxB)*lenB, by, '#fb923c', 2.5)

    // Ball A (blue)
    drawBall(ctx, ax, ay, '#93c5fd', '#1d4ed8')
    label(ctx, 'A (m=1)', ax, ay - BR - 6, '#93c5fd', 8, 'center')
    if (lenA > 3) label(ctx, `fx=${fxA.toFixed(1)}`, ax, ay + BR + 14, '#fb923c', 7, 'center')

    // Ball B (orange)
    drawBall(ctx, bx, by, '#fed7aa', '#c2410c')
    label(ctx, 'B (m=1)', bx, by - BR - 6, '#fed7aa', 8, 'center')
    if (lenB > 3) label(ctx, `fx=${fxB.toFixed(1)}`, bx, by + BR + 14, '#fb923c', 7, 'center')

    // Newton 3 annotation
    ctx.fillStyle = '#0a1628'; ctx.fillRect(4, 4, 160, 30)
    label(ctx, 'Newton\'s 3rd: F_A = −F_B', 8, 14, '#4ade80', 8)
    label(ctx, `|FA|=${Math.abs(fxA).toFixed(1)}  |FB|=${Math.abs(fxB).toFixed(1)}`, 8, 27, '#64748b', 7)
    // Extension label
    label(ctx, `ext=${ext.toFixed(1)}px  k=${sp.stiffness}`, midX, CH - 10, springColor, 8, 'center')
  }

  const drawG4 = () => {
    const canvas = c4.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const sim = g4.current; if (!sim.bFree || !sim.bDrag) return

    drawBg(ctx, CW, CH); drawFloor(ctx, CW)

    // Trail: free (gray dashed)
    if (sim.trailFree.length > 1) {
      ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4])
      ctx.beginPath(); ctx.moveTo(sim.trailFree[0][0], sim.trailFree[0][1])
      for (const [tx, ty] of sim.trailFree) ctx.lineTo(tx, ty)
      ctx.stroke(); ctx.setLineDash([])
    }
    // Trail: drag (cyan solid)
    if (sim.trailDrag.length > 1) {
      ctx.strokeStyle = '#22d3ee55'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(sim.trailDrag[0][0], sim.trailDrag[0][1])
      for (const [tx, ty] of sim.trailDrag) ctx.lineTo(tx, ty)
      ctx.stroke()
    }

    // Ball: free (gray)
    drawBall(ctx, sim.bFree.x*SC, sim.bFree.y*SC, '#94a3b8', '#334155')
    label(ctx, 'no drag', sim.bFree.x*SC, sim.bFree.y*SC - BR - 6, '#94a3b8', 7, 'center')

    // Ball: drag (cyan)
    drawBall(ctx, sim.bDrag.x*SC, sim.bDrag.y*SC, '#67e8f9', '#0e7490')
    label(ctx, 'drag', sim.bDrag.x*SC, sim.bDrag.y*SC - BR - 6, '#67e8f9', 7, 'center')

    // Velocity arrows
    const vFree = Math.hypot(sim.bFree.vx, sim.bFree.vy)
    const vDrag  = Math.hypot(sim.bDrag.vx, sim.bDrag.vy)
    if (vFree > 2) drawArrow(ctx, sim.bFree.x*SC, sim.bFree.y*SC,
      sim.bFree.x*SC + sim.bFree.vx*SC*0.15, sim.bFree.y*SC + sim.bFree.vy*SC*0.15, '#94a3b8', 1.5)
    if (vDrag > 2) drawArrow(ctx, sim.bDrag.x*SC, sim.bDrag.y*SC,
      sim.bDrag.x*SC + sim.bDrag.vx*SC*0.15, sim.bDrag.y*SC + sim.bDrag.vy*SC*0.15, '#67e8f9', 1.5)

    // vx bars
    const barX = CW - 70, barY = 20
    ctx.fillStyle = '#0a1628'; ctx.fillRect(barX - 4, barY - 14, 74, 70)
    label(ctx, 'vx (px/s)', barX + 33, barY, '#64748b', 7, 'center')
    // free bar
    const maxVx = 220
    const wFree = Math.max(0, Math.min(60, sim.bFree.vx / maxVx * 60))
    const wDrag  = Math.max(0, Math.min(60, sim.bDrag.vx / maxVx * 60))
    ctx.fillStyle = '#1e293b'; ctx.fillRect(barX, barY + 6, 60, 10)
    ctx.fillStyle = '#64748b'; ctx.fillRect(barX, barY + 6, wFree, 10)
    label(ctx, `${sim.bFree.vx.toFixed(0)}`, barX + 62, barY + 15, '#94a3b8', 7)
    ctx.fillStyle = '#1e293b'; ctx.fillRect(barX, barY + 22, 60, 10)
    ctx.fillStyle = '#22d3ee'; ctx.fillRect(barX, barY + 22, wDrag, 10)
    label(ctx, `${sim.bDrag.vx.toFixed(0)}`, barX + 62, barY + 31, '#67e8f9', 7)

    // Formula
    label(ctx, `F = -c·v  c=${dragCRef.current.toFixed(1)}`, 8, CH - 10, '#22d3ee', 8)
    ctx.fillStyle = '#0a1628'; ctx.fillRect(4, 4, 150, 28)
    label(ctx, 'no drag: vx constant', 8, 14, '#94a3b8', 7)
    label(ctx, 'drag: vx decays each step', 8, 25, '#67e8f9', 7)
  }

  // ── rAF loop ──────────────────────────────────────────────────────────────
  const lastTsRef = useRef(0)
  const rafRef    = useRef(0)
  useEffect(() => {
    // Setup all scenes
    setupG1(); setupG2(); setupG3(); setupG4()
    // Bus subscription for gravity scene (bounce count)
    g1.current.bus.on('floor-bounce', () => { g1.current.bounces++ })

    const loop = (ts: number) => {
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.016)
      lastTsRef.current = ts
      frameRef.current++

      // Step all worlds every frame
      stepG1(dt); stepG2(dt); stepG3(dt); stepG4(dt)

      // Draw only active tab
      switch (tabRef.current) {
        case 'gravity': drawG1(); break
        case 'spring':  drawG2(); break
        case 'b2b':     drawG3(); break
        case 'drag':    drawG4(); break
      }

      // Update stats every 6 frames (~10 Hz)
      if (frameRef.current % 6 === 0) {
        const bA = g1.current.bA, bB = g1.current.bB
        const g  = gravRef.current
        const ball = g2.current.ball, sp = g2.current.spring
        const b3A = g3.current.bA, b3B = g3.current.bB
        const bF = g4.current.bFree, bD = g4.current.bDrag

        setS({
          fA: bA ? (bA.mass * g).toFixed(1) : '0',
          aA: g.toFixed(1),
          fB: bB ? (bB.mass * g).toFixed(1) : '0',
          aB: g.toFixed(1),
          bounces: g1.current.bounces,
          ext:     sp ? roundTo(sp.extension, 1).toString() : '0',
          tension: (sp && ball) ? roundTo(sp.stiffness * sp.extension, 1).toString() : '0',
          ke:      (ball) ? roundTo(kineticEnergy(ball.vx, ball.vy, ball.mass), 0).toString() : '0',
          pe:      sp ? roundTo(springPotentialEnergy(sp.stiffness, sp.extension), 0).toString() : '0',
          totE:    (ball && sp) ? roundTo(kineticEnergy(ball.vx, ball.vy, ball.mass) + springPotentialEnergy(sp.stiffness, sp.extension), 0).toString() : '0',
          fxA:     b3A ? roundTo(b3A.fx, 1).toString() : '0',
          fxB:     b3B ? roundTo(b3B.fx, 1).toString() : '0',
          fDiff:   (b3A && b3B) ? roundTo(Math.abs(b3A.fx + b3B.fx), 2).toString() : '0',
          comX:    (b3A && b3B) ? roundTo((b3A.x + b3B.x) / 2, 0).toString() : '0',
          vxFree:  bF ? roundTo(bF.vx, 0).toString() : '0',
          vxDrag:  bD ? roundTo(bD.vx, 0).toString() : '0',
          ratio:   (bF && bF.vx > 0 && bD) ? roundTo(bD.vx / bF.vx, 2).toString() : '1.00',
        })
      }

      rafRef.current = requestAnimationFrame(loop)
    }
    lastTsRef.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Tab switch ────────────────────────────────────────────────────────────
  const switchTab = (k: SceneKey) => { setTab(k); tabRef.current = k }

  // ── Slider helpers ────────────────────────────────────────────────────────
  const mkSlider = (
    label: string, val: number, min: number, max: number, step: number,
    onChange: (v: number) => void, onApply?: () => void, unit = '',
  ) => (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginBottom: 1 }}>
        <span>{label}</span>
        <span style={{ color: '#7dd3fc', fontWeight: 700 }}>{val.toFixed(step < 1 ? 1 : 0)}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val}
        style={{ width: '100%', accentColor: '#3b82f6' }}
        onChange={e => { onChange(Number(e.target.value)); onApply?.() }} />
    </div>
  )
  const btn = (lbl: string, onClick: () => void, color = '#4ade80') => (
    <button onClick={onClick} style={{
      padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer',
      background: color + '22', color, fontSize: 10, fontWeight: 700, marginRight: 6,
    }}>{lbl}</button>
  )

  // ── Tab content ───────────────────────────────────────────────────────────
  const TABS: Array<{ key: SceneKey; emoji: string; label: string; color: string }> = [
    { key: 'gravity', emoji: '🌍', label: 'GravityForce', color: '#fb923c' },
    { key: 'spring',  emoji: '🌀', label: 'SpringForce',  color: '#a78bfa' },
    { key: 'b2b',     emoji: '🔗', label: 'Spring B2B',   color: '#4ade80' },
    { key: 'drag',    emoji: '💨', label: 'DragForce',    color: '#22d3ee' },
  ]

  const activeTab = TABS.find(t => t.key === tab)!

  return (
    <div style={{
      background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10,
      padding: 20, fontFamily: 'monospace', color: '#e2e8f0', maxWidth: 780, margin: '20px auto',
    }}>

      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
          ⚗️ Day 9 — Forces Demo: все сile в действии
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Tag t="GravityForce" c="#fb923c" />
          <Tag t="SpringForce" c="#a78bfa" />
          <Tag t="DragForce" c="#22d3ee" />
          <Tag t="IForce pipeline" c="#4ade80" />
          <Tag t="world.addForce()" c="#7dd3fc" />
          <Tag t="b.fx / b.fy" c="#f59e0b" />
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', marginBottom: 14 }}>
        {TABS.map(({ key, emoji, label: lbl, color }) => (
          <button key={key} onClick={() => switchTab(key)} style={{
            padding: '6px 14px', border: 'none', background: 'transparent',
            cursor: 'pointer', fontSize: 11, fontWeight: 700,
            color: tab === key ? color : '#475569',
            borderBottom: tab === key ? `2px solid ${color}` : '2px solid transparent',
            marginBottom: -1,
          }}>{emoji} {lbl}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Canvas */}
        <div>
          {TABS.map(({ key }) => (
            <canvas key={key} ref={key === 'gravity' ? c1 : key === 'spring' ? c2 : key === 'b2b' ? c3 : c4}
              width={CW} height={CH}
              style={{ display: tab === key ? 'block' : 'none', borderRadius: 6, border: '1px solid #1e293b' }}
            />
          ))}

          {/* Formula box */}
          <div style={{
            marginTop: 8, padding: '6px 10px', background: '#0a1628',
            borderRadius: 4, border: '1px solid #1e293b', fontSize: 10,
            color: activeTab.color, fontFamily: 'monospace',
          }}>
            {tab === 'gravity' && '⚡ apply(b): b.fy += b.mass × world.gravity'}
            {tab === 'spring'  && '⚡ apply(b): F = k·(|r|−L₀), b.fx += F·ux, b.fy += F·uy'}
            {tab === 'b2b'     && '⚡ apply(bA): bA.fx += F·ux, bB.fx −= F·ux  [Newton 3rd]'}
            {tab === 'drag'    && '⚡ apply(b): b.fx −= c·b.vx,  b.fy −= c·b.vy'}
          </div>
          <div style={{
            marginTop: 4, padding: '4px 10px', background: '#0a1628',
            borderRadius: 4, border: '1px solid #1e293b', fontSize: 9, color: '#334155',
          }}>
            World step → clear b.fx/b.fy → apply all IForce → ax=fx/mass, ay=fy/mass → Euler integrate
          </div>
        </div>

        {/* Controls + Stats */}
        <div style={{ minWidth: 200, flex: 1 }}>

          {/* Gravity scene controls */}
          {tab === 'gravity' && (<>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 8 }}>CONTROLS</div>
            {mkSlider('Gravity g', grav, 0, 30, 0.5, v => {
              setGrav(v); gravRef.current = v
              if (g1.current.world) g1.current.world.gravity = v
            }, undefined, ' px/s²')}
            {btn('Restart', setupG1)}
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginTop: 14, marginBottom: 6 }}>STATS</div>
            <Stat lbl="Ball A (m=1)" val="" />
            <Stat lbl="  Force F=mg" val={s.fA} unit="N" color="#fb923c" />
            <Stat lbl="  Accel a=F/m" val={s.aA} unit="px/s²" color="#4ade80" />
            <Stat lbl="Ball B (m=3)" val="" />
            <Stat lbl="  Force F=mg" val={s.fB} unit="N" color="#fb923c" />
            <Stat lbl="  Accel a=F/m" val={s.aB} unit="px/s²" color="#4ade80" />
            <Stat lbl="Floor bounces" val={s.bounces} color="#60a5fa" />
            <div style={{ marginTop: 8, padding: '6px 8px', background: '#0a1628', borderRadius: 4, fontSize: 9, color: '#4ade80' }}>
              ✅ Both a = {grav.toFixed(1)} px/s² — mass has no effect on acceleration
            </div>
          </>)}

          {/* Spring scene controls */}
          {tab === 'spring' && (<>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 8 }}>CONTROLS</div>
            {mkSlider('Stiffness k', springK, 0.5, 20, 0.5, v => { setSpringK(v); springKRef.current = v })}
            {mkSlider('Rest Length L₀', springRL, 30, 180, 5, v => { setSpringRL(v); springRLRef.current = v }, undefined, ' px')}
            {mkSlider('Damping', springD, 0, 5, 0.1, v => { setSpringD(v); springDRef.current = v })}
            <div style={{ marginTop: 6, marginBottom: 6 }}>
              {btn('Apply & Restart', setupG2)}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginTop: 10, marginBottom: 6 }}>STATS</div>
            <Stat lbl="Extension x" val={s.ext} unit="px" color={Number(s.ext) > 0 ? '#f87171' : Number(s.ext) < 0 ? '#60a5fa' : '#4ade80'} />
            <Stat lbl="Tension k·x" val={s.tension} unit="N" color="#a78bfa" />
            <Stat lbl="Kinetic E" val={s.ke} unit="J" color="#4ade80" />
            <Stat lbl="Spring PE ½kx²" val={s.pe} unit="J" color="#f59e0b" />
            <Stat lbl="Total E" val={s.totE} unit="J" color="#7dd3fc" />
          </>)}

          {/* B2B scene controls */}
          {tab === 'b2b' && (<>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 8 }}>CONTROLS</div>
            {mkSlider('Stiffness k', b2bK, 0.5, 15, 0.5, v => { setB2bK(v); b2bKRef.current = v })}
            <div style={{ marginBottom: 8 }}>
              {btn('Restart', setupG3)}
              {btn('Kick', () => {
                if (!g3.current.bA || !g3.current.bB) return
                g3.current.bA.vx += 60; g3.current.bA.vy = 0
                g3.current.bB.vx -= 60; g3.current.bB.vy = 0
              }, '#f59e0b')}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginTop: 10, marginBottom: 6 }}>STATS — Newton 3rd Law</div>
            <Stat lbl="F on A (b.fx)" val={s.fxA} unit="N" color="#93c5fd" />
            <Stat lbl="F on B (b.fx)" val={s.fxB} unit="N" color="#fed7aa" />
            <Stat lbl="|FA + FB| ≈ 0" val={s.fDiff} unit="N" color="#4ade80" />
            <Stat lbl="COM.x (fixed)" val={s.comX} unit="px" color="#f59e0b" />
            <div style={{ marginTop: 8, padding: '6px 8px', background: '#0a1628', borderRadius: 4, fontSize: 9, color: '#4ade80' }}>
              ✅ apply(bA) sets both bA.fx AND bB.fx = −bA.fx in same call
            </div>
          </>)}

          {/* Drag scene controls */}
          {tab === 'drag' && (<>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 8 }}>CONTROLS</div>
            {mkSlider('Drag coefficient c', dragC, 0, 5, 0.1, v => { setDragC(v); dragCRef.current = v })}
            {btn('Apply & Restart', setupG4)}
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginTop: 14, marginBottom: 6 }}>STATS</div>
            <Stat lbl="vx free (no drag)" val={s.vxFree} unit="px/s" color="#94a3b8" />
            <Stat lbl="vx with drag" val={s.vxDrag} unit="px/s" color="#22d3ee" />
            <Stat lbl="vx ratio drag/free" val={s.ratio} color={Number(s.ratio) < 0.8 ? '#f87171' : '#4ade80'} />
            <div style={{ marginTop: 8, padding: '6px 8px', background: '#0a1628', borderRadius: 4, fontSize: 9, color: '#22d3ee' }}>
              ✅ b.fx −= c·b.vx each step → exponential vx decay
            </div>
          </>)}
        </div>
      </div>

      {/* Footer checklist */}
      <div style={{ marginTop: 14, borderTop: '1px solid #1e293b', paddingTop: 10,
        display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 9, color: '#475569' }}>
        <span style={{ color: '#fb923c' }}>🌍 GravityForce: fy+=m·g</span>
        <span style={{ color: '#a78bfa' }}>🌀 SpringForce: Hooke's law + Newton3</span>
        <span style={{ color: '#4ade80' }}>🔗 Spring B2B: equal/opposite</span>
        <span style={{ color: '#22d3ee' }}>💨 DragForce: F=−c·v</span>
        <span style={{ color: '#7dd3fc' }}>⚙️ World.forces[] pipeline</span>
        <span style={{ color: '#f59e0b' }}>📡 PhysicsEventBus (gravity scene)</span>
      </div>
    </div>
  )
}
