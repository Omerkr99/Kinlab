/**
 * KinLab Day 4 Test Suite
 *
 * KAN-12: Determinism test + Phase 2 (Physics Engine) complete
 *
 * Covers:
 *  1. Engine barrel (index.ts) — all exports present and functional
 *  2. Body — constructor defaults, partial init, state fields
 *  3. World — Euler integration math, time accumulation, dt clamping
 *  4. Gravity — default, mutable, clamp
 *  5. Floor collision — DAMPING=0.7, position clamping, rest condition
 *  6. Wall collision — WALL_DAMPING=0.8, guard prevents double-flip
 *  7. Velocity clamping — micro-bounce suppression at rest
 *  8. InteractionLayer — pause, drag, resume API
 *  9. Multi-body — independent simulation, addBody after start
 * 10. Engine + DataRecorder pipeline — Phase 2 → Phase 3 integration
 */

import { describe, test, expect } from 'vitest'
import { World, Body, InteractionLayer } from './engine'   // T4.2 barrel export
import { DataRecorder } from './recorder'
import {
  FLOOR_Y, CANVAS_W, BALL_RADIUS,
  WALL_L, WALL_R, WALL_DAMPING, GRAVITY,
} from './constants'

// ─── 1. BARREL EXPORTS (T4.2) ────────────────────────────────────────────────

describe('Day4: engine barrel (T4.2)', () => {

  test('Body is exported from engine index', () => {
    const b = new Body({ x: 10, y: 20 })
    expect(b.x).toBe(10)
    expect(b.y).toBe(20)
  })

  test('World is exported from engine index', () => {
    const w = new World()
    expect(w.bodies).toHaveLength(0)
    expect(w.time).toBe(0)
  })

  test('InteractionLayer is exported from engine index', () => {
    const il = new InteractionLayer()
    expect(il.isPaused()).toBe(false)
    expect(il.isDragging()).toBe(false)
  })

  test('addBody returns the same reference stored in world.bodies', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 5, y: 10 }))
    expect(w.bodies[0]).toBe(b)
  })

})

// ─── 2. BODY ─────────────────────────────────────────────────────────────────

describe('Day4: Body', () => {

  test('default constructor: all fields = 0', () => {
    const b = new Body()
    expect(b.x).toBe(0); expect(b.y).toBe(0)
    expect(b.vx).toBe(0); expect(b.vy).toBe(0)
    expect(b.ax).toBe(0); expect(b.ay).toBe(0)
  })

  test('partial init fills only specified fields', () => {
    const b = new Body({ x: 300, vy: -5, ay: 9.8 })
    expect(b.x).toBe(300); expect(b.vy).toBe(-5); expect(b.ay).toBe(9.8)
    expect(b.y).toBe(0);   expect(b.vx).toBe(0);  expect(b.ax).toBe(0)
  })

  test('Body has all 6 kinematics fields', () => {
    const b = new Body({ x: 1, y: 2, vx: 3, vy: 4, ax: 5, ay: 6 })
    expect([b.x, b.y, b.vx, b.vy, b.ax, b.ay]).toEqual([1, 2, 3, 4, 5, 6])
  })

})

// ─── 3. EULER INTEGRATION MATH ───────────────────────────────────────────────

describe('Day4: Euler integration', () => {

  const DT = 0.016

  test('free-fall: vy += g*dt each step', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 0 }))
    w.step(DT)
    // First step: vy = 0 + GRAVITY*DT; y = 0 + vy*DT (after update)
    expect(b.vy).toBeCloseTo(GRAVITY * DT, 6)
    expect(b.y).toBeCloseTo(GRAVITY * DT * DT, 6)
  })

  test('ay is set to world.gravity on each step', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 0 }))
    w.step(DT)
    expect(b.ay).toBe(GRAVITY)
  })

  test('two steps: y increases quadratically', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 0 }))
    w.step(DT); w.step(DT)
    // After 2 steps: vy₁=g·dt, y₁=g·dt²; vy₂=2g·dt, y₂=g·dt²+2g·dt²=3g·dt²
    expect(b.vy).toBeCloseTo(2 * GRAVITY * DT, 4)
    expect(b.y).toBeGreaterThan(GRAVITY * DT * DT)  // y accelerating
  })

  test('ax contributes to vx and x', () => {
    // Start inside valid bounds (x=300 >> WALL_L=20) so wall guard doesn't fire
    const w = new World(); w.gravity = 0
    const b = w.addBody(new Body({ x: 300, y: 100, ax: 10 }))
    w.step(DT)
    expect(b.vx).toBeCloseTo(10 * DT, 6)             // vx = ax*dt
    expect(b.x).toBeCloseTo(300 + 10 * DT * DT, 6)   // x  = x₀ + vx*dt
  })

  test('world.time advances by dt each step', () => {
    const w = new World()
    w.step(0.016); expect(w.time).toBeCloseTo(0.016, 6)
    w.step(0.016); expect(w.time).toBeCloseTo(0.032, 6)
    w.step(0.008); expect(w.time).toBeCloseTo(0.040, 6)
  })

})

// ─── 4. GRAVITY ──────────────────────────────────────────────────────────────

describe('Day4: gravity', () => {

  test('default gravity = GRAVITY constant', () => {
    const w = new World()
    expect(w.gravity).toBe(GRAVITY)
  })

  test('gravity = 0: body stays in place', () => {
    const w = new World(); w.gravity = 0
    const b = w.addBody(new Body({ x: 300, y: 200 }))
    for (let i = 0; i < 100; i++) w.step(0.016)
    expect(b.y).toBe(200); expect(b.vy).toBe(0)
  })

  test('gravity is writable — change takes effect next step', () => {
    const w = new World(); w.gravity = 0
    const b = w.addBody(new Body({ x: 300, y: 200 }))
    w.step(0.016); expect(b.vy).toBe(0)   // no movement
    w.gravity = GRAVITY
    w.step(0.016); expect(b.vy).toBeGreaterThan(0)  // now falling
  })

  test('Moon (1.6) falls slower than Earth (9.8) falls slower than Jupiter (24.8)', () => {
    const drop = (g: number, steps: number) => {
      const w = new World(); w.gravity = g
      const b = w.addBody(new Body({ x: 300, y: 0 }))
      for (let i = 0; i < steps; i++) w.step(0.016)
      return b.y
    }
    const yMoon    = drop(1.6,  100)
    const yEarth   = drop(9.8,  100)
    const yJupiter = drop(24.8, 100)
    expect(yMoon).toBeLessThan(yEarth)
    expect(yEarth).toBeLessThan(yJupiter)
  })

  test('dt=0 does not advance body or time', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    const { y: y0, vy: vy0 } = b
    w.step(0)
    expect(b.y).toBe(y0); expect(b.vy).toBe(vy0); expect(w.time).toBe(0)
  })

  test('dt > MAX_DT is clamped to 0.016', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 0 }))
    w.step(1.0)   // 1 second clamped to 0.016
    expect(b.vy).toBeCloseTo(GRAVITY * 0.016, 4)
  })

  test('negative dt is clamped to 0 — no backward time travel', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50, vy: 10 }))
    const y0 = b.y
    w.step(-0.5)
    expect(b.y).toBe(y0)   // no movement
    expect(w.time).toBe(0) // time unchanged
  })

})

// ─── 5. FLOOR COLLISION ───────────────────────────────────────────────────────

describe('Day4: floor collision', () => {

  test('ball falling from y=450 reaches FLOOR_Y within 400 steps', () => {
    // From y=450, 50px to floor at g=9.8px/s² ≈ 3.2s ≈ 200 steps (generous 400)
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 450 }))
    let hitFloor = false
    for (let i = 0; i < 400; i++) {
      w.step(0.016)
      if (b.y >= FLOOR_Y - 0.5) { hitFloor = true; break }
    }
    expect(hitFloor).toBe(true)
    expect(b.y).toBeLessThanOrEqual(FLOOR_Y)
  })

  test('ball at FLOOR_Y with vy=5 bounces: y clamped, vy flipped × DAMPING', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: FLOOR_Y, vy: 5 }))
    w.step(0.016)
    expect(b.y).toBeLessThanOrEqual(FLOOR_Y)
    expect(b.vy).toBeLessThan(0)   // now moving up
  })

  test('DAMPING = 0.7: floor bounce reduces |vy|', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: FLOOR_Y, vy: 5 }))
    w.step(0.016)
    // vy after = -(5+g*dt)*0.7 — must be less than 5 in magnitude
    expect(Math.abs(b.vy)).toBeLessThan(5)
  })

  test('ball eventually reaches rest at FLOOR_Y (vy=vx=ay=0)', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    for (let i = 0; i < 30_000; i++) w.step(0.016)
    expect(b.y).toBe(FLOOR_Y)
    expect(b.vy).toBe(0); expect(b.vx).toBe(0); expect(b.ay).toBe(0)
  })

  test('body at rest on floor: rest-skip keeps it stationary', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: FLOOR_Y }))
    // Force rest condition
    b.vy = 0; b.vx = 0; b.ay = 0
    const stateBefore = { x: b.x, y: b.y, vx: b.vx, vy: b.vy }
    w.step(0.016)
    expect(b).toMatchObject(stateBefore)
  })

  test('body placed below FLOOR_Y is NOT trapped by rest-skip', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: FLOOR_Y + 50 }))   // below floor
    w.step(0.016)
    // Should have bounced — the rest-skip condition requires y === FLOOR_Y (===, not >=)
    expect(b.y).toBeLessThanOrEqual(FLOOR_Y)
  })

})

// ─── 6. WALL COLLISION ────────────────────────────────────────────────────────

describe('Day4: wall collision', () => {

  test('constants: WALL_L = BALL_RADIUS, WALL_R = CANVAS_W - BALL_RADIUS', () => {
    expect(WALL_L).toBe(BALL_RADIUS)
    expect(WALL_R).toBe(CANVAS_W - BALL_RADIUS)
  })

  test('ball with vx=-100 at WALL_L bounces: vx flips × WALL_DAMPING', () => {
    const w = new World(); w.gravity = 0
    const b = w.addBody(new Body({ x: WALL_L, y: 200, vx: -100 }))
    w.step(0.016)
    expect(b.vx).toBeCloseTo(100 * WALL_DAMPING, 3)   // positive (bounced right)
    expect(b.x).toBeGreaterThanOrEqual(WALL_L)
  })

  test('ball with vx=+100 at WALL_R bounces: vx flips × WALL_DAMPING', () => {
    const w = new World(); w.gravity = 0
    const b = w.addBody(new Body({ x: WALL_R, y: 200, vx: 100 }))
    w.step(0.016)
    expect(b.vx).toBeCloseTo(-100 * WALL_DAMPING, 3)  // negative (bounced left)
    expect(b.x).toBeLessThanOrEqual(WALL_R)
  })

  test('guard: ball at WALL_L moving right (vx > 0) — no double-flip', () => {
    const w = new World(); w.gravity = 0
    const b = w.addBody(new Body({ x: WALL_L, y: 200, vx: 50 }))
    w.step(0.016)
    expect(b.vx).toBeGreaterThan(0)   // still moving right, not flipped
  })

  test('guard: ball at WALL_R moving left (vx < 0) — no double-flip', () => {
    const w = new World(); w.gravity = 0
    const b = w.addBody(new Body({ x: WALL_R, y: 200, vx: -50 }))
    w.step(0.016)
    expect(b.vx).toBeLessThan(0)   // still moving left, not flipped
  })

  test('x is always clamped to [WALL_L, WALL_R] over 2 000 steps', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 100, vx: 500 }))
    for (let i = 0; i < 2_000; i++) {
      w.step(0.016)
      expect(b.x).toBeGreaterThanOrEqual(WALL_L - 0.001)
      expect(b.x).toBeLessThanOrEqual(WALL_R + 0.001)
    }
  })

  test('WALL_DAMPING is in (0, 1) — each bounce loses energy', () => {
    expect(WALL_DAMPING).toBeGreaterThan(0)
    expect(WALL_DAMPING).toBeLessThan(1)
  })

})

// ─── 7. VELOCITY CLAMPING (micro-bounce suppression) ─────────────────────────

describe('Day4: velocity clamping', () => {

  test('tiny vy (< VELOCITY_CLAMP) at floor is zeroed', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: FLOOR_Y, vy: 0.05 }))
    w.step(0.016)
    expect(b.vy).toBe(0)
    expect(b.vx).toBe(0)   // vx also zeroed when clamped
  })

  test('larger vy (> VELOCITY_CLAMP) at floor is NOT zeroed', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: FLOOR_Y, vy: 5 }))
    w.step(0.016)
    expect(b.vy).not.toBe(0)   // bounced properly
  })

  test('kinetic energy = 0 after clamping to rest', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: FLOOR_Y, vy: 0.1, vx: 0.1 }))
    w.step(0.016)
    const ke = 0.5 * (b.vx ** 2 + b.vy ** 2)
    expect(ke).toBe(0)
  })

})

// ─── 8. INTERACTION LAYER ────────────────────────────────────────────────────

describe('Day4: InteractionLayer', () => {

  test('initial state: not paused, not dragging', () => {
    const il = new InteractionLayer()
    expect(il.isPaused()).toBe(false)
    expect(il.isDragging()).toBe(false)
  })

  test('pause / resume toggles isPaused', () => {
    const il = new InteractionLayer()
    il.pause();  expect(il.isPaused()).toBe(true)
    il.resume(); expect(il.isPaused()).toBe(false)
  })

  test('startDrag / endDrag toggles isDragging', () => {
    const il = new InteractionLayer()
    const b = new Body({ x: 100, y: 100 })
    il.startDrag(b); expect(il.isDragging()).toBe(true)
    il.endDrag();    expect(il.isDragging()).toBe(false)
  })

  test('updateDrag moves body to exact (x, y) and zeroes velocity', () => {
    const il = new InteractionLayer()
    const b = new Body({ x: 300, y: 100, vx: 50, vy: -20 })
    il.startDrag(b)
    il.updateDrag(150, 250)
    expect(b.x).toBe(150); expect(b.y).toBe(250)
    expect(b.vx).toBe(0);  expect(b.vy).toBe(0)
  })

  test('updateDrag is no-op when not dragging', () => {
    const il = new InteractionLayer()
    const b = new Body({ x: 300, y: 100 })
    il.updateDrag(999, 999)   // no startDrag called
    expect(b.x).toBe(300)    // unchanged
  })

  test('multiple pause/resume cycles — state is always consistent', () => {
    const il = new InteractionLayer()
    for (let i = 0; i < 50; i++) {
      il.pause();  expect(il.isPaused()).toBe(true)
      il.resume(); expect(il.isPaused()).toBe(false)
    }
  })

})

// ─── 9. MULTI-BODY ───────────────────────────────────────────────────────────

describe('Day4: multi-body', () => {

  test('two bodies are independent — different vx gives different final x', () => {
    const w = new World(); w.gravity = 0
    const b1 = w.addBody(new Body({ x: 300, y: 100, vx:  100 }))
    const b2 = w.addBody(new Body({ x: 300, y: 100, vx: -100 }))
    for (let i = 0; i < 100; i++) w.step(0.016)
    expect(b1.x).not.toBe(b2.x)
  })

  test('world.bodies.length reflects added bodies', () => {
    const w = new World()
    expect(w.bodies.length).toBe(0)
    w.addBody(new Body()); expect(w.bodies.length).toBe(1)
    w.addBody(new Body()); expect(w.bodies.length).toBe(2)
    w.addBody(new Body()); expect(w.bodies.length).toBe(3)
  })

  test('addBody after simulation starts — new body participates from next step', () => {
    const w = new World()
    for (let i = 0; i < 100; i++) w.step(0.016)  // 100 steps without bodies
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    const y0 = b.y
    w.step(0.016)
    expect(b.y).toBeGreaterThan(y0)  // fell for 1 step
  })

  test('10 bodies — none produce NaN after 1 000 steps', () => {
    const w = new World()
    const bodies = Array.from({ length: 10 }, (_, i) =>
      w.addBody(new Body({ x: 50 + i * 50, y: 20, vx: (i % 2 ? 1 : -1) * i * 30 }))
    )
    for (let i = 0; i < 1_000; i++) w.step(0.016)
    for (const b of bodies) {
      expect(Number.isFinite(b.x)).toBe(true)
      expect(Number.isFinite(b.y)).toBe(true)
      expect(Number.isFinite(b.vx)).toBe(true)
      expect(Number.isFinite(b.vy)).toBe(true)
    }
  })

})

// ─── 10. ENGINE + RECORDER PIPELINE ──────────────────────────────────────────

describe('Day4: engine + recorder pipeline (Phase 2 → Phase 3)', () => {

  test('recorded series length matches step count', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    const r = new DataRecorder(); r.start()
    const STEPS = 200
    for (let i = 0; i < STEPS; i++) {
      w.step(0.016)
      r.record(w.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
    }
    expect(r.getLength()).toBe(STEPS)
    expect(r.getSeries('time').length).toBe(STEPS)
  })

  test('time series is monotonically increasing', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    const r = new DataRecorder(); r.start()
    for (let i = 0; i < 100; i++) {
      w.step(0.016)
      r.record(w.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
    }
    const times = r.getSeries('time')
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1])
    }
  })

  test('y series in physical coords: all values ≥ 0 (floor = 0)', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50, vx: 100 }))
    const r = new DataRecorder(); r.start()
    for (let i = 0; i < 500; i++) {
      w.step(0.016)
      r.record(w.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
    }
    const ys = r.getSeries('y')
    for (const y of ys) expect(y).toBeGreaterThanOrEqual(0)
  })

  test('x series stays within [WALL_L, WALL_R] throughout simulation', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 100, vx: 300 }))
    const r = new DataRecorder(); r.start()
    for (let i = 0; i < 500; i++) {
      w.step(0.016)
      r.record(w.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
    }
    const xs = r.getSeries('x')
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(WALL_L - 0.001)
      expect(x).toBeLessThanOrEqual(WALL_R + 0.001)
    }
  })

  test('recorder.reset() + recorder.start() clears previous data', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    const r = new DataRecorder(); r.start()
    for (let i = 0; i < 50; i++) { w.step(0.016); r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay) }
    expect(r.getLength()).toBe(50)
    r.reset(); r.start()
    expect(r.getLength()).toBe(0)
    for (let i = 0; i < 20; i++) { w.step(0.016); r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay) }
    expect(r.getLength()).toBe(20)
  })

  test('Phase 2 gate: empty-world step() does not crash and time advances', () => {
    const w = new World()
    expect(() => { for (let i = 0; i < 200; i++) w.step(0.016) }).not.toThrow()
    expect(w.time).toBeCloseTo(200 * 0.016, 4)
  })

})
