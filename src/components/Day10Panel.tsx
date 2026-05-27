/**
 * Day10Panel — Collisions + Rotation + Constraints Showcase (Day 10)
 *
 * Four tabbed scenes demonstrating all Day 10 requirements:
 *   💥 Collisions  — CircleCollision.detect + CollisionResolver   (T10.1 / T10.2)
 *   🔄 Rotation    — TorqueForce + angular integration             (T10.3)
 *   🔗 Pendulum    — DistanceConstraint + PinJoint + gravity       (T10.4 / T10.5)
 *   🌐 Full Scene  — All phases in World.step()                    (T10.6 / T10.7)
 *
 * All scenes run their own World instance inside a shared rAF loop;
 * only the active tab is drawn.  Physics runs in "demo gravity" mode
 * (GRAV_DEMO = 400 px/s²) so motion is visually fast without changing
 * the main simulation constants.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { World, Body }           from '../engine'
import { GravityForce }          from '../engine/forces/GravityForce'
import { DragForce }             from '../engine/forces/DragForce'
import { TorqueForce }           from '../engine/forces/TorqueForce'
import { DistanceConstraint }    from '../engine/constraints/DistanceConstraint'
import { PhysicsEventBus }       from '../engine/PhysicsEvents'
import type { PhysicsEvent }     from '../engine/PhysicsEvents'
import {
  kineticEnergy, angularKineticEnergy, roundTo,
} from '../utils/math'
import { FLOOR_Y, CANVAS_W, BALL_RADIUS, WALL_L, WALL_R } from '../constants'

// ── Canvas / physics constants ────────────────────────────────────────────────

const SC        = 0.5
const CW        = Math.round(CANVAS_W * SC)         // 300 px canvas width
const CH        = Math.round((FLOOR_Y + 20) * SC)   // 260 px canvas height
const FY        = FLOOR_Y * SC                       // 250 px  — floor y on canvas
const BR        = BALL_RADIUS * SC                   // 10 px   — ball radius on canvas
const SPIN_R    = 22                                 // larger radius for spinning bodies
const GRAV_DEMO = 400                                // demo gravity (px/s²)

type SceneKey = 'collision' | 'rotation' | 'pendulum' | 'full'

// ── Low-level canvas helpers ──────────────────────────────────────────────────

function drawBg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#070e1b'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#0d1b2e'
  ctx.lineWidth = 0.5
  for (let x = 0; x <= w; x += 25) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
  for (let y = 0; y <= h; y += 25) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
}

function drawFloor(ctx: CanvasRenderingContext2D, w: number): void {
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, FY); ctx.lineTo(w, FY); ctx.stroke()
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  radius = BR,
  color0 = '#93c5fd', color1 = '#1d4ed8',
): void {
  const gr = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 1, cx, cy, radius)
  gr.addColorStop(0, color0)
  gr.addColorStop(1, color1)
  ctx.fillStyle = gr
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill()
}

/** Draw a "clock hand" from the centre of a spinning body at the given angle. */
function drawSpoke(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  angle: number, radius = SPIN_R,
  color = '#f8fafc',
): void {
  ctx.strokeStyle = color; ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius)
  ctx.stroke()
  // Small cap dot
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 3, 0, Math.PI * 2)
  ctx.fill()
}

function canvasLabel(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  color = '#94a3b8', size = 10, align: CanvasTextAlign = 'left',
): void {
  ctx.fillStyle = color; ctx.font = `bold ${size}px monospace`; ctx.textAlign = align
  ctx.fillText(text, x, y)
}

// ── React UI helpers ──────────────────────────────────────────────────────────

function Tag({ t, c }: { t: string; c: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
      background: c + '22', color: c, border: `1px solid ${c}44`, marginRight: 5,
    }}>{t}</span>
  )
}

function Stat({ lbl, val, unit, color = '#7dd3fc' }: {
  lbl: string; val: string | number; unit?: string; color?: string
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '3px 0', borderBottom: '1px solid #1e293b', fontSize: 11, fontFamily: 'monospace',
    }}>
      <span style={{ color: '#64748b' }}>{lbl}</span>
      <span>
        <span style={{ color, fontWeight: 700 }}>{val}</span>
        {unit && <span style={{ color: '#334155', marginLeft: 4, fontSize: 9 }}>{unit}</span>}
      </span>
    </div>
  )
}

// ── Scene state shapes ────────────────────────────────────────────────────────

interface CollisionScene {
  world:       World
  bus:         PhysicsEventBus
  collisions:  number
  lastImpulse: number
  resetAt:     number
}

interface RotationScene {
  world: World
  bA:    Body | null   // inertia = 1
  bB:    Body | null   // inertia = 5
}

interface PendulumScene {
  world:      World
  bob:        Body | null
  constraint: DistanceConstraint | null
  anchorX:    number
  anchorY:    number
}

interface FullScene {
  world:      World
  bus:        PhysicsEventBus
  bodies:     Body[]
  constraint: DistanceConstraint | null
  collisions: number
  resetAt:    number
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Day10Panel() {

  // ── Tab ──────────────────────────────────────────────────────────────────────
  const [tab, setTab]       = useState<SceneKey>('collision')
  const tabRef              = useRef<SceneKey>('collision')
  const frameRef            = useRef(0)
  const lastTsRef           = useRef(0)
  const rafRef              = useRef(0)

  // ── Slider state + stable refs ────────────────────────────────────────────────
  const [restitution, setRestitution] = useState(0.8)
  const [tau,         setTau]         = useState(8)
  const [pendLen,     setPendLen]     = useState(100)
  const restitutionRef = useRef(0.8)
  const tauRef         = useRef(8)
  const pendLenRef     = useRef(100)

  // ── Live stats for the React sidebar ─────────────────────────────────────────
  const [s, setS] = useState({
    collisions: 0,
    lastImpulse: '0.0',
    totalKE1: '0',
    omegaA: '0.00', omegaB: '0.00',
    angleA: '0', angleB: '0',
    angKEA: '0.0', angKEB: '0.0',
    pendAngle: '0.0', pendError: '0.000', pendSpeed: '0.0',
    fullBodies: 0, fullColl: 0,
    fullKE: '0', fullErr: '0.00',
  })

  // ── Canvas refs ───────────────────────────────────────────────────────────────
  const c1 = useRef<HTMLCanvasElement>(null)  // collision
  const c2 = useRef<HTMLCanvasElement>(null)  // rotation
  const c3 = useRef<HTMLCanvasElement>(null)  // pendulum
  const c4 = useRef<HTMLCanvasElement>(null)  // full

  // ── Scene state refs ──────────────────────────────────────────────────────────
  const g1 = useRef<CollisionScene>({
    world: new World(), bus: new PhysicsEventBus(),
    collisions: 0, lastImpulse: 0, resetAt: 0,
  })
  const g2 = useRef<RotationScene>({ world: new World(), bA: null, bB: null })
  const g3 = useRef<PendulumScene>({ world: new World(), bob: null, constraint: null, anchorX: 300, anchorY: 80 })
  const g4 = useRef<FullScene>({
    world: new World(), bus: new PhysicsEventBus(),
    bodies: [], constraint: null, collisions: 0, resetAt: 0,
  })

  // ── Scene setup ───────────────────────────────────────────────────────────────

  const setupCollision = useCallback(() => {
    const sim = g1.current
    sim.world          = new World()
    sim.world.gravity  = GRAV_DEMO
    sim.world.collisionDetection = true
    sim.world.restitution = restitutionRef.current
    sim.world.bus      = sim.bus
    sim.collisions     = 0
    sim.lastImpulse    = 0
    sim.resetAt        = Date.now() + 9000   // auto-reset in 9 s

    // Six bodies with distinct initial horizontal velocities
    const configs: Array<{ x: number; y: number; vx: number }> = [
      { x: 100, y: 55,  vx:  12 },
      { x: 210, y: 85,  vx:  -6 },
      { x: 300, y: 38,  vx:   4 },
      { x: 410, y: 68,  vx: -14 },
      { x: 500, y: 95,  vx:   8 },
      { x: 340, y: 148, vx:  -3 },
    ]
    for (const { x, y, vx } of configs) {
      sim.world.addBody(new Body({ x, y, vx }))
    }
    sim.world.addForce(new GravityForce())
  }, [])

  const setupRotation = useCallback(() => {
    const sim = g2.current
    sim.world          = new World()
    sim.world.gravity  = 0   // pure rotation — no translational movement
    // Body A: light rotor (moment of inertia = 1) — left of canvas
    sim.bA = sim.world.addBody(new Body({ x: 150, y: 250, inertia: 1 }))
    // Body B: heavy rotor (moment of inertia = 5) — right of canvas
    sim.bB = sim.world.addBody(new Body({ x: 450, y: 250, inertia: 5 }))
    sim.world.addForce(new TorqueForce(tauRef.current))
  }, [])

  const setupPendulum = useCallback(() => {
    const sim   = g3.current
    const L     = pendLenRef.current
    const ancX  = 300
    const ancY  = 60
    sim.anchorX = ancX
    sim.anchorY = ancY
    sim.world   = new World()
    sim.world.gravity = GRAV_DEMO
    // Bob starts at 50° from vertical (displaced to the right)
    const theta0 = 50 * Math.PI / 180
    const bx = ancX + L * Math.sin(theta0)
    const by = ancY + L * Math.cos(theta0)
    sim.bob = sim.world.addBody(new Body({ x: bx, y: by, mass: 1 }))
    sim.constraint = new DistanceConstraint(
      sim.bob, L, null, ancX, ancY,
      0,   // compliance = 0 → rigid rod
    )
    sim.world.addForce(new GravityForce())
    sim.world.addConstraint(sim.constraint)
    sim.world.constraintIterations = 10  // tight, stable pendulum
  }, [])

  const setupFull = useCallback(() => {
    const sim = g4.current
    sim.world = new World()
    sim.world.gravity = 200
    sim.world.collisionDetection = true
    sim.world.restitution = 0.7
    sim.world.bus = sim.bus
    sim.collisions = 0
    sim.bodies     = []
    sim.resetAt    = Date.now() + 10000   // auto-reset in 10 s

    // Five bodies scattered in the upper region
    const configs: Array<{ x: number; y: number; vx: number }> = [
      { x: 110, y: 40,  vx:  10 },
      { x: 220, y: 75,  vx:   0 },
      { x: 310, y: 48,  vx:  -5 },
      { x: 400, y: 68,  vx:   8 },
      { x: 490, y: 40,  vx: -12 },
    ]
    for (const { x, y, vx } of configs) {
      sim.bodies.push(sim.world.addBody(new Body({ x, y, vx })))
    }

    // Rigid DistanceConstraint linking bodies[0] ↔ bodies[1]
    const dx0 = sim.bodies[1].x - sim.bodies[0].x
    const dy0 = sim.bodies[1].y - sim.bodies[0].y
    const initDist = Math.sqrt(dx0 * dx0 + dy0 * dy0)
    sim.constraint = new DistanceConstraint(sim.bodies[0], initDist, sim.bodies[1])
    sim.world.addConstraint(sim.constraint)
    sim.world.addForce(new GravityForce())
    sim.world.addForce(new DragForce(0.08))
  }, [])

  // ── Bus subscriptions (mount once) ───────────────────────────────────────────
  useEffect(() => {
    const bus1 = g1.current.bus
    const h1 = (e: PhysicsEvent) => {
      g1.current.collisions++
      g1.current.lastImpulse = e.impulse ?? 0
    }
    bus1.on('collision', h1)

    const bus4 = g4.current.bus
    const h4 = () => { g4.current.collisions++ }
    bus4.on('collision', h4)

    return () => { bus1.off('collision', h1); bus4.off('collision', h4) }
  }, [])

  // ── Draw functions ────────────────────────────────────────────────────────────

  const drawCollision = useCallback(() => {
    const canvas = c1.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const sim = g1.current

    drawBg(ctx, CW, CH)
    drawFloor(ctx, CW)

    // Wall markers
    ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 1; ctx.setLineDash([3, 3])
    ctx.beginPath(); ctx.moveTo(WALL_L * SC, 0); ctx.lineTo(WALL_L * SC, FY); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(WALL_R * SC, 0); ctx.lineTo(WALL_R * SC, FY); ctx.stroke()
    ctx.setLineDash([])

    const palette: Array<[string, string]> = [
      ['#93c5fd', '#1d4ed8'], ['#fde68a', '#d97706'],
      ['#86efac', '#16a34a'], ['#c4b5fd', '#7c3aed'],
      ['#f9a8d4', '#be185d'], ['#67e8f9', '#0e7490'],
    ]
    for (let i = 0; i < sim.world.bodies.length; i++) {
      const b = sim.world.bodies[i]
      const bx = b.x * SC, by = b.y * SC
      const [c0, c1] = palette[i % palette.length]
      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      ctx.beginPath(); ctx.ellipse(bx, FY - 1, BR * 0.85, 2, 0, 0, Math.PI * 2); ctx.fill()
      drawBall(ctx, bx, by, BR, c0, c1)
    }

    // Overlay — top-left
    ctx.fillStyle = '#0a1628'; ctx.fillRect(4, 4, 186, 28)
    canvasLabel(ctx, `e = ${restitutionRef.current.toFixed(2)}   collisions: ${sim.collisions}`, 8, 15, '#4ade80', 8)
    canvasLabel(ctx, `last |j| = ${sim.lastImpulse.toFixed(1)} px²/s`, 8, 27, '#f87171', 7)
  }, [])

  const drawRotation = useCallback(() => {
    const canvas = c2.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const sim = g2.current
    if (!sim.bA || !sim.bB) return

    drawBg(ctx, CW, CH)

    // ── Body A (light, fast) ─────────────────────────────────────
    const axC = sim.bA.x * SC, ayC = sim.bA.y * SC
    // Outer ring shows angular KE by brightening
    const keA = 0.5 * 1 * sim.bA.omega * sim.bA.omega
    const brightnessA = Math.min(1, keA / 200)
    const ringA = `rgba(147,197,253,${0.25 + brightnessA * 0.75})`
    ctx.strokeStyle = ringA; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(axC, ayC, SPIN_R + 5, 0, Math.PI * 2); ctx.stroke()
    drawBall(ctx, axC, ayC, SPIN_R, '#93c5fd', '#1d4ed8')
    drawSpoke(ctx, axC, ayC, sim.bA.angle, SPIN_R, '#f8fafc')
    // Labels
    canvasLabel(ctx, 'I = 1  (light)', axC, ayC - SPIN_R - 16, '#93c5fd', 8, 'center')
    canvasLabel(ctx, `ω = ${sim.bA.omega.toFixed(1)} r/s`, axC, ayC + SPIN_R + 14, '#7dd3fc', 8, 'center')
    canvasLabel(ctx, `θ = ${((sim.bA.angle * 180 / Math.PI) % 360).toFixed(0)}°`, axC, ayC + SPIN_R + 26, '#a78bfa', 7, 'center')

    // ── Body B (heavy, slow) ─────────────────────────────────────
    const bxC = sim.bB.x * SC, byC = sim.bB.y * SC
    const keB = 0.5 * 5 * sim.bB.omega * sim.bB.omega
    const brightnessB = Math.min(1, keB / 200)
    const ringB = `rgba(253,230,138,${0.25 + brightnessB * 0.75})`
    ctx.strokeStyle = ringB; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(bxC, byC, SPIN_R + 5, 0, Math.PI * 2); ctx.stroke()
    drawBall(ctx, bxC, byC, SPIN_R, '#fde68a', '#d97706')
    drawSpoke(ctx, bxC, byC, sim.bB.angle, SPIN_R, '#f8fafc')
    canvasLabel(ctx, 'I = 5  (heavy)', bxC, byC - SPIN_R - 16, '#fde68a', 8, 'center')
    canvasLabel(ctx, `ω = ${sim.bB.omega.toFixed(1)} r/s`, bxC, byC + SPIN_R + 14, '#fde68a', 8, 'center')
    canvasLabel(ctx, `θ = ${((sim.bB.angle * 180 / Math.PI) % 360).toFixed(0)}°`, bxC, byC + SPIN_R + 26, '#a78bfa', 7, 'center')

    // ── Annotation ────────────────────────────────────────────────
    ctx.fillStyle = '#0a1628'; ctx.fillRect(4, 4, 216, 36)
    canvasLabel(ctx, `τ = ${tauRef.current}  (same torque, different I)`, 8, 15, '#4ade80', 8)
    canvasLabel(ctx, `α_A = τ/1 = ${tauRef.current}   α_B = τ/5 = ${(tauRef.current / 5).toFixed(1)} rad/s²`, 8, 28, '#64748b', 7)
  }, [])

  const drawPendulum = useCallback(() => {
    const canvas = c3.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const sim = g3.current
    if (!sim.bob || !sim.constraint) return

    drawBg(ctx, CW, CH)
    drawFloor(ctx, CW)

    const ancX  = sim.anchorX * SC
    const ancY  = sim.anchorY * SC
    const bobX  = sim.bob.x   * SC
    const bobY  = sim.bob.y   * SC
    const pendL = sim.constraint.length * SC

    // Vertical rest-position guide (dashed)
    ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 1; ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(ancX, ancY); ctx.lineTo(ancX, ancY + pendL); ctx.stroke()
    ctx.setLineDash([])

    // Rod
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(ancX, ancY); ctx.lineTo(bobX, bobY); ctx.stroke()

    // Anchor bracket
    ctx.fillStyle = '#334155'; ctx.fillRect(ancX - 18, ancY - 12, 36, 12)
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1; ctx.strokeRect(ancX - 18, ancY - 12, 36, 12)
    ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.arc(ancX, ancY, 4, 0, Math.PI * 2); ctx.fill()

    // Bob (colour by speed)
    const spd = Math.hypot(sim.bob.vx, sim.bob.vy)
    const t   = Math.min(1, spd / 200)
    const bC0 = t > 0.5 ? '#fde68a' : '#86efac'
    const bC1 = t > 0.5 ? '#d97706' : '#16a34a'
    drawBall(ctx, bobX, bobY, BR, bC0, bC1)

    // Angle arc (between rod and vertical guide)
    const angle = Math.atan2(sim.bob.x - sim.anchorX, sim.bob.y - sim.anchorY)
    const arcR  = 22
    ctx.strokeStyle = '#f59e0b44'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(ancX, ancY, arcR, Math.PI / 2, Math.PI / 2 + angle, angle < 0); ctx.stroke()

    // Overlay
    const T   = 2 * Math.PI * Math.sqrt(sim.constraint.length / GRAV_DEMO)
    ctx.fillStyle = '#0a1628'; ctx.fillRect(4, 4, 176, 38)
    canvasLabel(ctx, `θ = ${(angle * 180 / Math.PI).toFixed(1)}°  L = ${sim.constraint.length}px`, 8, 15, '#86efac', 8)
    canvasLabel(ctx, `error = ${sim.constraint.error.toFixed(3)} px`, 8, 27, '#f59e0b', 7)
    canvasLabel(ctx, `T ≈ ${T.toFixed(2)} s  (g=${GRAV_DEMO})`, 8, 38, '#475569', 6)
  }, [])

  const drawFull = useCallback(() => {
    const canvas = c4.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const sim = g4.current

    drawBg(ctx, CW, CH)
    drawFloor(ctx, CW)

    // Constraint rod (yellow, thick)
    if (sim.constraint && sim.bodies.length >= 2) {
      const bA = sim.bodies[0], bB = sim.bodies[1]
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3; ctx.globalAlpha = 0.5
      ctx.beginPath(); ctx.moveTo(bA.x * SC, bA.y * SC); ctx.lineTo(bB.x * SC, bB.y * SC); ctx.stroke()
      ctx.globalAlpha = 1
    }

    const pal: Array<[string, string]> = [
      ['#fde68a', '#d97706'], ['#fde68a', '#d97706'],
      ['#93c5fd', '#1d4ed8'], ['#86efac', '#16a34a'], ['#c4b5fd', '#7c3aed'],
    ]
    for (let i = 0; i < sim.bodies.length; i++) {
      const b = sim.bodies[i]
      const [c0, c1] = pal[i % pal.length]
      drawBall(ctx, b.x * SC, b.y * SC, BR, c0, c1)
    }

    ctx.fillStyle = '#0a1628'; ctx.fillRect(4, 4, 200, 28)
    canvasLabel(ctx, `gravity + drag + collision + constraint`, 8, 15, '#22d3ee', 8)
    canvasLabel(ctx, `collisions: ${sim.collisions}   bodies: ${sim.bodies.length}`, 8, 27, '#f87171', 7)
  }, [])

  // ── Step functions ────────────────────────────────────────────────────────────

  // NOTE: functions reference setupXxx from closure; all are stable (useCallback + [])

  const stepCollision = useCallback((dt: number) => {
    const sim = g1.current
    if (Date.now() >= sim.resetAt) { setupCollision(); return }
    sim.world.restitution = restitutionRef.current
    sim.world.step(dt)
  }, [setupCollision])

  const stepRotation = useCallback((dt: number) => {
    g2.current.world.step(dt)
    // Wrap omega to avoid unbounded growth — visual remains smooth
    if (g2.current.bA && Math.abs(g2.current.bA.omega) > 60) {
      g2.current.bA.angle  = 0; g2.current.bA.omega  = 0
      g2.current.bB!.angle = 0; g2.current.bB!.omega = 0
    }
  }, [])

  const stepPendulum = useCallback((dt: number) => {
    g3.current.world.step(dt)
  }, [])

  const stepFull = useCallback((dt: number) => {
    const sim = g4.current
    if (Date.now() >= sim.resetAt) { setupFull(); return }
    sim.world.step(dt)
  }, [setupFull])

  // ── rAF loop + initial setup ──────────────────────────────────────────────────
  useEffect(() => {
    setupCollision()
    setupRotation()
    setupPendulum()
    setupFull()

    const loop = (ts: number) => {
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.016)
      lastTsRef.current = ts
      frameRef.current++

      stepCollision(dt)
      stepRotation(dt)
      stepPendulum(dt)
      stepFull(dt)

      switch (tabRef.current) {
        case 'collision': drawCollision(); break
        case 'rotation':  drawRotation();  break
        case 'pendulum':  drawPendulum();  break
        case 'full':      drawFull();      break
      }

      // Update React stats every 6 frames ≈ 10 Hz
      if (frameRef.current % 6 === 0) {
        const s1 = g1.current, s2 = g2.current, s3 = g3.current, s4 = g4.current

        const totalKE1 = s1.world.bodies.reduce((acc, b) => acc + kineticEnergy(b.vx, b.vy, b.mass), 0)
        const totalKE4 = s4.bodies.reduce((acc, b) => acc + kineticEnergy(b.vx, b.vy, b.mass), 0)
        const pendA    = s3.bob ? Math.atan2(s3.bob.x - s3.anchorX, s3.bob.y - s3.anchorY) * 180 / Math.PI : 0
        const pendSpd  = s3.bob ? Math.hypot(s3.bob.vx, s3.bob.vy) : 0

        setS({
          collisions:  s1.collisions,
          lastImpulse: s1.lastImpulse.toFixed(1),
          totalKE1:    roundTo(totalKE1, 0).toString(),
          omegaA:  s2.bA ? roundTo(s2.bA.omega, 2).toString() : '0.00',
          omegaB:  s2.bB ? roundTo(s2.bB.omega, 2).toString() : '0.00',
          angleA:  s2.bA ? roundTo((s2.bA.angle * 180 / Math.PI) % 360, 0).toString() : '0',
          angleB:  s2.bB ? roundTo((s2.bB.angle * 180 / Math.PI) % 360, 0).toString() : '0',
          angKEA:  s2.bA ? roundTo(angularKineticEnergy(s2.bA.omega, 1), 1).toString() : '0.0',
          angKEB:  s2.bB ? roundTo(angularKineticEnergy(s2.bB.omega, 5), 1).toString() : '0.0',
          pendAngle: roundTo(pendA, 1).toString(),
          pendError: s3.constraint ? roundTo(s3.constraint.error, 3).toString() : '0.000',
          pendSpeed: roundTo(pendSpd, 1).toString(),
          fullBodies: s4.bodies.length,
          fullColl:   s4.collisions,
          fullKE:     roundTo(totalKE4, 0).toString(),
          fullErr:    s4.constraint ? roundTo(Math.abs(s4.constraint.error), 2).toString() : '0.00',
        })
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    lastTsRef.current = performance.now()
    rafRef.current    = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── UI helpers ────────────────────────────────────────────────────────────────
  const switchTab = (k: SceneKey) => { setTab(k); tabRef.current = k }

  const mkSlider = (
    label: string, val: number, min: number, max: number, step: number,
    onChange: (v: number) => void, unit = '',
  ) => (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginBottom: 1 }}>
        <span>{label}</span>
        <span style={{ color: '#7dd3fc', fontWeight: 700 }}>{val.toFixed(step < 1 ? 2 : 0)}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val}
        style={{ width: '100%', accentColor: '#3b82f6' }}
        onChange={e => onChange(Number(e.target.value))} />
    </div>
  )

  const btn = (label: string, onClick: () => void, color = '#4ade80') => (
    <button onClick={onClick} style={{
      padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer',
      background: color + '22', color, fontSize: 10, fontWeight: 700, marginRight: 6,
    }}>{label}</button>
  )

  // ── Tab metadata ──────────────────────────────────────────────────────────────
  const TABS: Array<{ key: SceneKey; emoji: string; label: string; color: string }> = [
    { key: 'collision', emoji: '💥', label: 'Collisions', color: '#f87171' },
    { key: 'rotation',  emoji: '🔄', label: 'Rotation',   color: '#a78bfa' },
    { key: 'pendulum',  emoji: '🔗', label: 'Pendulum',   color: '#4ade80' },
    { key: 'full',      emoji: '🌐', label: 'Full Scene', color: '#22d3ee' },
  ]
  const activeColor = TABS.find(t => t.key === tab)?.color ?? '#7dd3fc'

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10,
      padding: 20, fontFamily: 'monospace', color: '#e2e8f0',
      maxWidth: 780, margin: '20px auto',
    }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
          🎯 Day 10 — Collisions, Rotation &amp; Constraints
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Tag t="T10.1 CircleCollision"   c="#f87171" />
          <Tag t="T10.2 Resolver"          c="#f87171" />
          <Tag t="T10.3 TorqueForce"       c="#a78bfa" />
          <Tag t="T10.4 DistanceConstraint" c="#4ade80" />
          <Tag t="T10.5 PinJoint"          c="#4ade80" />
          <Tag t="T10.6 World integration" c="#22d3ee" />
          <Tag t="T10.8 Angular math"      c="#f59e0b" />
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', marginBottom: 14 }}>
        {TABS.map(({ key, emoji, label, color }) => (
          <button key={key} onClick={() => switchTab(key)} style={{
            padding: '6px 14px', border: 'none', background: 'transparent',
            cursor: 'pointer', fontSize: 11, fontWeight: 700,
            color: tab === key ? color : '#475569',
            borderBottom: tab === key ? `2px solid ${color}` : '2px solid transparent',
            marginBottom: -1,
          }}>{emoji} {label}</button>
        ))}
      </div>

      {/* ── Main 2-column layout ── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Canvas column */}
        <div>
          {TABS.map(({ key }) => {
            const ref = key === 'collision' ? c1 : key === 'rotation' ? c2 : key === 'pendulum' ? c3 : c4
            return (
              <canvas key={key} ref={ref} width={CW} height={CH} style={{
                display: tab === key ? 'block' : 'none',
                borderRadius: 6, border: '1px solid #1e293b',
              }} />
            )
          })}

          {/* Formula + pipeline notes */}
          <div style={{
            marginTop: 8, padding: '6px 10px', background: '#0a1628',
            borderRadius: 4, border: '1px solid #1e293b', fontSize: 10,
            color: activeColor, fontFamily: 'monospace',
          }}>
            {tab === 'collision' && '⚡ j = -(1+e)·v_rel·n / (1/mA + 1/mB)  →  impulse resolver'}
            {tab === 'rotation'  && '⚡ α = τ/I   →   ω += α·dt   →   θ += ω·dt'}
            {tab === 'pendulum'  && '⚡ XPBD: corr = (dist − L) / (wA + compliance)  →  rigid rod'}
            {tab === 'full'      && '⚡ forces → floor/walls → collisions → constraints → step event'}
          </div>
          <div style={{
            marginTop: 4, padding: '4px 10px', background: '#0a1628',
            borderRadius: 4, border: '1px solid #1e293b', fontSize: 9, color: '#334155',
          }}>
            All scenes run in the World force-pipeline path (world.forces.length &gt; 0)
          </div>
        </div>

        {/* Controls + stats column */}
        <div style={{ minWidth: 200, flex: 1 }}>

          {/* ── Collision tab ── */}
          {tab === 'collision' && (<>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 8 }}>CONTROLS</div>
            {mkSlider('Restitution e', restitution, 0, 1, 0.05, v => {
              setRestitution(v); restitutionRef.current = v
            })}
            {btn('Restart', setupCollision)}
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginTop: 14, marginBottom: 6 }}>
              STATS — T10.1 / T10.2
            </div>
            <Stat lbl="Collisions detected" val={s.collisions}   color="#f87171" />
            <Stat lbl="Last impulse |j|"    val={s.lastImpulse}  unit="px²/s" color="#fb923c" />
            <Stat lbl="Total KE"            val={s.totalKE1}     unit="J"     color="#7dd3fc" />
            <div style={{ marginTop: 8, padding: '6px 8px', background: '#0a1628', borderRadius: 4, fontSize: 9, color: '#4ade80' }}>
              e=1 → elastic (KE conserved) · e=0 → perfectly inelastic<br />
              Momentum always conserved regardless of e
            </div>
          </>)}

          {/* ── Rotation tab ── */}
          {tab === 'rotation' && (<>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 8 }}>CONTROLS</div>
            {mkSlider('Torque τ', tau, 0, 30, 1, v => {
              setTau(v); tauRef.current = v
              // Swap the TorqueForce on the live world
              g2.current.world.forces.length = 0
              g2.current.world.addForce(new TorqueForce(v))
            })}
            {btn('Reset angles', () => {
              if (g2.current.bA) { g2.current.bA.angle = 0; g2.current.bA.omega = 0 }
              if (g2.current.bB) { g2.current.bB.angle = 0; g2.current.bB.omega = 0 }
            }, '#f59e0b')}
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginTop: 14, marginBottom: 6 }}>
              STATS — T10.3 (τ = {tau}, same for both)
            </div>
            <Stat lbl="Body A (I = 1)" val="" />
            <Stat lbl="  ω (rad/s)"     val={s.omegaA} color="#93c5fd" />
            <Stat lbl="  θ (°)"         val={s.angleA} color="#a78bfa" />
            <Stat lbl="  Rot. KE ½Iω²" val={s.angKEA} unit="J" color="#7dd3fc" />
            <Stat lbl="Body B (I = 5)" val="" />
            <Stat lbl="  ω (rad/s)"     val={s.omegaB} color="#fde68a" />
            <Stat lbl="  θ (°)"         val={s.angleB} color="#f59e0b" />
            <Stat lbl="  Rot. KE ½Iω²" val={s.angKEB} unit="J" color="#7dd3fc" />
            <div style={{ marginTop: 8, padding: '6px 8px', background: '#0a1628', borderRadius: 4, fontSize: 9, color: '#a78bfa' }}>
              ✅ ω_A / ω_B = I_B / I_A = 5  (same τ → α inversely proportional to I)
            </div>
          </>)}

          {/* ── Pendulum tab ── */}
          {tab === 'pendulum' && (<>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 8 }}>CONTROLS</div>
            {mkSlider('Arm length L', pendLen, 40, 170, 10, v => {
              setPendLen(v); pendLenRef.current = v
            }, ' px')}
            {btn('Apply & Restart', () => setupPendulum())}
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginTop: 14, marginBottom: 6 }}>
              STATS — T10.4 / T10.5
            </div>
            <Stat lbl="θ from vertical" val={s.pendAngle} unit="°"  color="#86efac" />
            <Stat lbl="Bob speed"       val={s.pendSpeed} unit="px/s" color="#4ade80" />
            <Stat lbl="Constraint err"  val={s.pendError} unit="px" color="#f59e0b" />
            <Stat lbl="Arm L"           val={pendLen}     unit="px" color="#64748b" />
            <div style={{ marginTop: 8, padding: '6px 8px', background: '#0a1628', borderRadius: 4, fontSize: 9, color: '#4ade80' }}>
              ✅ Constraint error ≈ 0 px — XPBD solver holds arm rigid<br />
              T = 2π√(L/g)   (g = {GRAV_DEMO} px/s²)
            </div>
          </>)}

          {/* ── Full tab ── */}
          {tab === 'full' && (<>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 8 }}>CONTROLS</div>
            {btn('Restart', setupFull)}
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginTop: 14, marginBottom: 6 }}>
              STATS — T10.6 (all phases)
            </div>
            <Stat lbl="Bodies"           val={s.fullBodies} color="#22d3ee" />
            <Stat lbl="Collisions"       val={s.fullColl}   color="#f87171" />
            <Stat lbl="Total KE"         val={s.fullKE}     unit="J" color="#7dd3fc" />
            <Stat lbl="Constraint error" val={s.fullErr}    unit="px" color="#f59e0b" />
            <div style={{ marginTop: 8, padding: '6px 8px', background: '#0a1628', borderRadius: 4, fontSize: 9, color: '#22d3ee' }}>
              Bodies 0-1 linked by DistanceConstraint (yellow rod)<br />
              Pipeline: force → collision → constraint → step event
            </div>
            <div style={{ marginTop: 6, padding: '6px 8px', background: '#0a1628', borderRadius: 4, fontSize: 9, color: '#f87171' }}>
              World.collisionDetection = true<br />
              world.constraintIterations = 4  (default)
            </div>
          </>)}

        </div>
      </div>

      {/* ── Footer checklist ── */}
      <div style={{
        marginTop: 14, borderTop: '1px solid #1e293b', paddingTop: 10,
        display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 9, color: '#475569',
      }}>
        <span style={{ color: '#f87171'  }}>💥 T10.1/10.2: CircleCollision + impulse resolver</span>
        <span style={{ color: '#a78bfa'  }}>🔄 T10.3: TorqueForce → α=τ/I → ω → θ</span>
        <span style={{ color: '#4ade80'  }}>🔗 T10.4/10.5: DistanceConstraint XPBD + PinJoint</span>
        <span style={{ color: '#22d3ee'  }}>🌐 T10.6: all phases in World.step()</span>
        <span style={{ color: '#f59e0b'  }}>📐 T10.8: angularKE, torque, angularMomentum, angularImpulse</span>
      </div>
    </div>
  )
}
