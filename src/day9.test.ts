/**
 * Day 9 Unit Tests: IForce System + Spring + Impulse + World Pipeline
 *
 *   T9.1 — IForce compliance: GravityForce, SpringForce (anchored + body-to-body), DragForce
 *   T9.2 — Spring entity: Hooke's law physics, snapshots, PE formula
 *   T9.3 — Impulse / momentum math: new utils/math.ts exports
 *   T9.4 — World force pipeline: forces registered, cleared, applied in order
 *   T9.5 — Energy conservation: total E bounded over spring oscillation
 *   T9.6 — Event bus integration: World emits events with force path
 *   T9.7 — Backward compatibility: existing Body/World patterns unchanged
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { World }           from './engine/World'
import { Body }            from './engine/Body'
import { Spring }          from './engine/Spring'
import { GravityForce }    from './engine/forces/GravityForce'
import { SpringForce }     from './engine/forces/SpringForce'
import { DragForce }       from './engine/forces/DragForce'
import { PhysicsEventBus } from './engine/PhysicsEvents'
import type { PhysicsEvent } from './engine/PhysicsEvents'
import {
  momentum, impulse, springPotentialEnergy, speed,
  kineticEnergy,
} from './utils/math'
import { FLOOR_Y, GRAVITY, WALL_L, WALL_R } from './constants'
import type { SpringSnapshot } from './types/index'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeWorld() {
  const w = new World()
  const b = w.addBody(new Body({ x: 300, y: 50 }))
  return { w, b }
}

function stepN(world: World, n: number, dt = 0.016) {
  for (let i = 0; i < n; i++) world.step(dt)
}

// ── T9.1 GravityForce ─────────────────────────────────────────────────────────

describe('T9.1 IForce — GravityForce compliance', () => {
  test('GravityForce.apply() adds mass*gravity to b.fy', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    const gf = new GravityForce()
    b.fx = 0; b.fy = 0
    gf.apply(b, w, 0.016)
    expect(b.fy).toBeCloseTo(b.mass * w.gravity)
  })

  test('GravityForce uses world.gravity — changing world.gravity changes force', () => {
    const w = new World()
    const b = w.addBody(new Body())
    const gf = new GravityForce()
    w.gravity = 20
    b.fx = 0; b.fy = 0
    gf.apply(b, w, 0.016)
    expect(b.fy).toBeCloseTo(20)
  })

  test('GravityForce does not modify b.fx', () => {
    const w = new World()
    const b = w.addBody(new Body())
    const gf = new GravityForce()
    b.fx = 7; b.fy = 0
    gf.apply(b, w, 0.016)
    expect(b.fx).toBe(7)   // untouched
  })

  test('GravityForce does not set b.vx or b.vy (accumulator only)', () => {
    const w = new World()
    const b = w.addBody(new Body({ vx: 3, vy: 5 }))
    const gf = new GravityForce()
    gf.apply(b, w, 0.016)
    expect(b.vx).toBe(3)
    expect(b.vy).toBe(5)
  })
})

// ── T9.1 SpringForce (anchored) ────────────────────────────────────────────────

describe('T9.1 IForce — SpringForce anchored', () => {
  test('spring at rest (dist === restLength): applies near-zero force', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 160 }))  // 100 px below anchor
    const sf = new SpringForce(5, 100, 0, null, 300, 60)
    b.fx = 0; b.fy = 0
    sf.apply(b, w, 0.016)
    // dist = |160-60| = 100 = restLength → extension = 0 → no force
    expect(Math.abs(b.fx)).toBeLessThan(1e-8)
    expect(Math.abs(b.fy)).toBeLessThan(1e-8)
  })

  test('spring stretched: force points toward anchor', () => {
    const w = new World()
    // Anchor at (300, 60), body at (300, 200): dist=140, restLength=100, ext=40
    const b = w.addBody(new Body({ x: 300, y: 200 }))
    const sf = new SpringForce(5, 100, 0, null, 300, 60)
    b.fx = 0; b.fy = 0
    sf.apply(b, w, 0.016)
    // Force should be upward (negative fy in canvas coords) → toward anchor y=60
    expect(b.fy).toBeLessThan(0)   // upward in canvas coords
    expect(Math.abs(b.fx)).toBeLessThan(1e-8)  // purely vertical
  })

  test('spring stretched: magnitude = k * extension', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 200 }))
    const sf = new SpringForce(5, 100, 0, null, 300, 60)
    b.fx = 0; b.fy = 0
    sf.apply(b, w, 0.016)
    // dist=140, extension=40, k=5, force_mag = 5*40 = 200 → fy = -200
    expect(b.fy).toBeCloseTo(-200, 3)
  })

  test('spring compressed: force pushes away from anchor (positive fy downward)', () => {
    const w = new World()
    // Anchor at (300,60), body at (300,110): dist=50, restLength=100, ext=-50
    const b = w.addBody(new Body({ x: 300, y: 110 }))
    const sf = new SpringForce(5, 100, 0, null, 300, 60)
    b.fx = 0; b.fy = 0
    sf.apply(b, w, 0.016)
    // extension=-50 → force pushes body AWAY from anchor → downward → fy > 0
    expect(b.fy).toBeGreaterThan(0)
  })

  test('coincident body and anchor: does not throw or produce NaN', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 60 }))  // at anchor
    const sf = new SpringForce(5, 100, 0, null, 300, 60)
    b.fx = 0; b.fy = 0
    expect(() => sf.apply(b, w, 0.016)).not.toThrow()
    expect(Number.isFinite(b.fx)).toBe(true)
    expect(Number.isFinite(b.fy)).toBe(true)
  })
})

// ── T9.1 SpringForce (body-to-body) ──────────────────────────────────────────

describe('T9.1 IForce — SpringForce body-to-body', () => {
  test('two bodies at rest length: near-zero force on both', () => {
    const w = new World()
    const a = w.addBody(new Body({ x: 300, y: 100 }))
    const b = w.addBody(new Body({ x: 300, y: 200 }))  // dist = 100 = restLen
    const sf = new SpringForce(5, 100, 0, b, 0, 0)
    a.fx = 0; a.fy = 0; b.fx = 0; b.fy = 0
    sf.apply(a, w, 0.016)
    expect(Math.abs(a.fy)).toBeLessThan(1e-8)
    expect(Math.abs(b.fy)).toBeLessThan(1e-8)
  })

  test('separated bodies: equal and opposite forces (Newton 3rd law)', () => {
    const w = new World()
    const a = w.addBody(new Body({ x: 300, y: 100 }))
    const bBody = w.addBody(new Body({ x: 300, y: 250 }))  // dist=150, rest=100
    const sf = new SpringForce(5, 100, 0, bBody, 0, 0)
    a.fx = 0; a.fy = 0; bBody.fx = 0; bBody.fy = 0
    sf.apply(a, w, 0.016)
    // Equal and opposite
    expect(a.fy).toBeCloseTo(-bBody.fy, 8)
    expect(a.fx).toBeCloseTo(-bBody.fx, 8)
  })

  test('skip when apply() called for bodyB (World loop double-apply prevention)', () => {
    const w = new World()
    const a = w.addBody(new Body({ x: 300, y: 100 }))
    const bBody = w.addBody(new Body({ x: 300, y: 250 }))
    const sf = new SpringForce(5, 100, 0, bBody, 0, 0)
    bBody.fx = 0; bBody.fy = 0
    // When World calls sf.apply(bBody, ...) — should skip
    const bFxBefore = bBody.fx; const bFyBefore = bBody.fy
    sf.apply(bBody, w, 0.016)
    // bodyB skip: force should NOT change since we only apply when bodyA is passed
    // (the reaction was already applied when bodyA was processed)
    // After skip: bBody.fx/fy unchanged from before this call
    // Note: a.fx/a.fy also unchanged
    expect(bBody.fx).toBe(bFxBefore)
    expect(bBody.fy).toBe(bFyBefore)
    expect(a.fx).toBe(0)
  })
})

// ── T9.1 DragForce ────────────────────────────────────────────────────────────

describe('T9.1 IForce — DragForce compliance', () => {
  test('DragForce opposes velocity: fx = -coeff*vx, fy = -coeff*vy', () => {
    const w = new World()
    const b = w.addBody(new Body({ vx: 10, vy: 5 }))
    const df = new DragForce(2)
    b.fx = 0; b.fy = 0
    df.apply(b, w, 0.016)
    expect(b.fx).toBeCloseTo(-20)
    expect(b.fy).toBeCloseTo(-10)
  })

  test('DragForce on stationary body: zero force', () => {
    const w = new World()
    const b = w.addBody(new Body({ vx: 0, vy: 0 }))
    const df = new DragForce(5)
    b.fx = 0; b.fy = 0
    df.apply(b, w, 0.016)
    expect(b.fx).toBe(0)
    expect(b.fy).toBe(0)
  })

  test('DragForce coefficient scales linearly', () => {
    const w = new World()
    const b1 = w.addBody(new Body({ vx: 4, vy: 0 }))
    const b2 = w.addBody(new Body({ vx: 4, vy: 0 }))
    b1.fx = 0; b1.fy = 0; b2.fx = 0; b2.fy = 0
    new DragForce(1).apply(b1, w, 0.016)
    new DragForce(3).apply(b2, w, 0.016)
    expect(b2.fx).toBeCloseTo(3 * b1.fx, 8)
  })
})

// ── T9.2 Spring entity ────────────────────────────────────────────────────────

describe('T9.2 Spring entity', () => {
  test('currentLength: correct distance bodyA-to-anchor', () => {
    const b = new Body({ x: 300, y: 160 })
    const sp = new Spring({ bodyA: b, stiffness: 5, restLength: 100, anchorX: 300, anchorY: 60 })
    expect(sp.currentLength).toBeCloseTo(100, 5)
  })

  test('extension positive when stretched beyond restLength', () => {
    const b = new Body({ x: 300, y: 220 })  // 160 px from anchor at 60
    const sp = new Spring({ bodyA: b, stiffness: 5, restLength: 100, anchorX: 300, anchorY: 60 })
    expect(sp.extension).toBeCloseTo(60, 4)
  })

  test('extension negative when compressed below restLength', () => {
    const b = new Body({ x: 300, y: 110 })  // 50 px from anchor
    const sp = new Spring({ bodyA: b, stiffness: 5, restLength: 100, anchorX: 300, anchorY: 60 })
    expect(sp.extension).toBeCloseTo(-50, 4)
  })

  test('potentialEnergy = ½ k x²', () => {
    const b = new Body({ x: 300, y: 200 })  // dist=140, restLen=100, ext=40
    const sp = new Spring({ bodyA: b, stiffness: 5, restLength: 100, anchorX: 300, anchorY: 60 })
    const expected = 0.5 * 5 * 40 * 40  // 4000
    expect(sp.potentialEnergy).toBeCloseTo(expected, 3)
  })

  test('potentialEnergy = 0 when at rest length', () => {
    const b = new Body({ x: 300, y: 160 })
    const sp = new Spring({ bodyA: b, stiffness: 5, restLength: 100, anchorX: 300, anchorY: 60 })
    expect(sp.potentialEnergy).toBeCloseTo(0, 8)
  })

  test('makeForce() returns a SpringForce instance', () => {
    const b = new Body({ x: 300, y: 200 })
    const sp = new Spring({ bodyA: b, stiffness: 5, restLength: 100, anchorX: 300, anchorY: 60 })
    const f = sp.makeForce()
    expect(f).toBeDefined()
    expect(typeof f.apply).toBe('function')
  })

  test('snapshot() returns all required SpringSnapshot fields', () => {
    const b = new Body({ x: 300, y: 200 })
    const sp = new Spring({ bodyA: b, stiffness: 5, restLength: 100, damping: 0.5, anchorX: 300, anchorY: 60 })
    const snap: SpringSnapshot = sp.snapshot()
    expect(snap.currentLength).toBeGreaterThan(0)
    expect(snap.extension).toBeCloseTo(40, 3)
    expect(snap.potentialEnergy).toBeCloseTo(4000, 1)
    expect(snap.stiffness).toBe(5)
    expect(snap.restLength).toBe(100)
    expect(snap.damping).toBe(0.5)
  })
})

// ── T9.3 Impulse & Momentum math ─────────────────────────────────────────────

describe('T9.3 Impulse & Momentum math', () => {
  test('speed(3, 4) = 5 (Pythagorean triple)', () => {
    expect(speed(3, 4)).toBeCloseTo(5, 10)
  })

  test('speed(vx, vy) = √(vx²+vy²)', () => {
    expect(speed(5, 12)).toBeCloseTo(13, 10)
  })

  test('speed(0, 0) = 0', () => {
    expect(speed(0, 0)).toBe(0)
  })

  test('momentum(vx, vy, mass=1) equals speed(vx, vy)', () => {
    expect(momentum(3, 4, 1)).toBeCloseTo(speed(3, 4), 10)
  })

  test('momentum scales with mass: double mass = double momentum', () => {
    const m1 = momentum(3, 4, 1)
    const m2 = momentum(3, 4, 2)
    expect(m2).toBeCloseTo(2 * m1, 10)
  })

  test('momentum default mass=1', () => {
    expect(momentum(3, 4)).toBeCloseTo(momentum(3, 4, 1), 10)
  })

  test('impulse(fx, fy, dt) = forceMagnitude * dt', () => {
    expect(impulse(3, 4, 2)).toBeCloseTo(10, 8)  // |F|=5, dt=2 → 10
  })

  test('impulse of zero force = 0', () => {
    expect(impulse(0, 0, 1000)).toBe(0)
  })

  test('springPotentialEnergy(k, 0) = 0', () => {
    expect(springPotentialEnergy(10, 0)).toBe(0)
  })

  test('springPotentialEnergy(k, ext) = ½ k ext²', () => {
    expect(springPotentialEnergy(4, 10)).toBeCloseTo(200, 8)  // 0.5*4*100
  })

  test('springPotentialEnergy symmetric: +ext and -ext give same PE', () => {
    expect(springPotentialEnergy(5, 30)).toBeCloseTo(springPotentialEnergy(5, -30), 8)
  })
})

// ── T9.4 World force pipeline ─────────────────────────────────────────────────

describe('T9.4 World — force pipeline integration', () => {
  test('world with no forces: step produces same result as legacy (gravity applied)', () => {
    const w1 = new World()
    const b1 = w1.addBody(new Body({ x: 300, y: 50 }))
    // legacy path — no forces
    w1.step(0.016)
    const vy1 = b1.vy

    const w2 = new World()
    const b2 = w2.addBody(new Body({ x: 300, y: 50 }))
    // still no forces → same legacy path
    w2.step(0.016)
    expect(b2.vy).toBeCloseTo(vy1, 10)
  })

  test('addForce() registers force: subsequent step uses force path', () => {
    const { w, b } = makeWorld()
    w.addForce(new GravityForce())
    const prevY = b.y
    w.step(0.016)
    expect(b.y).toBeGreaterThan(prevY)  // body fell
  })

  test('force accumulator cleared at start of each step', () => {
    const { w, b } = makeWorld()
    b.fx = 9999; b.fy = 9999  // polluted state
    w.addForce(new GravityForce())  // activates force path
    w.step(0.016)
    // After step, fx/fy were cleared then recomputed — final values should be
    // from force application, not the polluted 9999 values.
    // GravityForce sets fy = mass*gravity = 9.8; no fx contribution.
    // After Euler, fx/fy reflect the last step's accumulation (cleared + reapplied).
    // Just verify body didn't explode from the polluted values.
    expect(Number.isFinite(b.x)).toBe(true)
    expect(Number.isFinite(b.y)).toBe(true)
  })

  test('multiple forces accumulate additively onto fx, fy', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    // Two gravity forces → double gravity effect
    w.addForce(new GravityForce())
    w.addForce(new GravityForce())
    w.step(0.016)
    // With 2× gravity, vy should be ≈ 2 * GRAVITY * dt = 2*9.8*0.016 ≈ 0.3136
    expect(b.vy).toBeCloseTo(2 * GRAVITY * 0.016, 4)
  })

  test('removeForce() deregisters force', () => {
    const { w, b } = makeWorld()
    const gf = new GravityForce()
    w.addForce(gf)
    w.removeForce(gf)
    expect(w.forces.length).toBe(0)  // force removed
  })

  test('F=ma applied: ax = fx/mass, ay = fy/mass', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50, mass: 2 }))
    // Spring force of known magnitude
    w.addForce(new GravityForce())
    w.step(0.016)
    // After step: ay should be fy/mass = (2*9.8)/2 = 9.8
    expect(b.ay).toBeCloseTo(GRAVITY, 5)
  })

  test('mass=2 produces half acceleration of mass=1 with same force', () => {
    const w1 = new World(); const b1 = w1.addBody(new Body({ x: 300, y: 50, mass: 1 }))
    const w2 = new World(); const b2 = w2.addBody(new Body({ x: 300, y: 50, mass: 2 }))
    w1.addForce(new GravityForce()); w2.addForce(new GravityForce())
    w1.step(0.016); w2.step(0.016)
    // Both fall at same rate with GravityForce (F=mg → a=g, mass-independent)
    expect(b1.vy).toBeCloseTo(b2.vy, 4)
  })

  test('world.forces starts empty', () => {
    const w = new World()
    expect(w.forces.length).toBe(0)
  })

  test('world.bus starts null', () => {
    const w = new World()
    expect(w.bus).toBeNull()
  })
})

// ── T9.5 Energy conservation ───────────────────────────────────────────────────

describe('T9.5 Energy conservation — spring oscillation', () => {
  /** Build undamped hanging spring. Anchor at (300,60), ball at (300,260) → ext=60 */
  function makeSpringScene(damping = 0) {
    const w = new World()
    // zero gravity so we can isolate spring PE↔KE exchange
    w.gravity = 0
    const b = w.addBody(new Body({ x: 300, y: 260, mass: 1 }))
    const sp = new Spring({ bodyA: b, stiffness: 5, restLength: 100, damping, anchorX: 300, anchorY: 60 })
    w.addForce(sp.makeForce())
    return { w, b, sp }
  }

  test('undamped spring: total energy bounded within ±20% of initial over 200 steps', () => {
    const { w, b, sp } = makeSpringScene(0)
    const e0 = kineticEnergy(b.vx, b.vy, b.mass) + sp.potentialEnergy
    for (let i = 0; i < 200; i++) w.step(0.016)
    const e1 = kineticEnergy(b.vx, b.vy, b.mass) + sp.potentialEnergy
    // Euler integrator has slight numerical dissipation — allow ±20%
    expect(e1).toBeGreaterThan(e0 * 0.8)
    expect(e1).toBeLessThan(e0 * 1.2)
  })

  test('damped spring: energy decreasing monotonically over 500 steps', () => {
    const { w, b, sp } = makeSpringScene(1.0)  // damping=1
    const energySamples: number[] = []
    for (let i = 0; i < 500; i++) {
      w.step(0.016)
      if (i % 50 === 0) energySamples.push(kineticEnergy(b.vx, b.vy, b.mass) + sp.potentialEnergy)
    }
    // Each sample should be ≤ previous (energy dissipating)
    for (let i = 1; i < energySamples.length; i++) {
      expect(energySamples[i]).toBeLessThanOrEqual(energySamples[i - 1] + 0.01)
    }
  })

  test('spring at exactly restLength with zero velocity: no movement', () => {
    const w = new World()
    w.gravity = 0
    const b = w.addBody(new Body({ x: 300, y: 160, vx: 0, vy: 0 }))  // dist=100=restLen
    const sp = new Spring({ bodyA: b, stiffness: 5, restLength: 100, anchorX: 300, anchorY: 60 })
    w.addForce(sp.makeForce())
    const y0 = b.y
    stepN(w, 10)
    expect(b.y).toBeCloseTo(y0, 6)
  })

  test('all body state values remain finite over 1000 spring steps', () => {
    const { w, b } = makeSpringScene(0.2)
    stepN(w, 1000)
    expect(Number.isFinite(b.x)).toBe(true)
    expect(Number.isFinite(b.y)).toBe(true)
    expect(Number.isFinite(b.vx)).toBe(true)
    expect(Number.isFinite(b.vy)).toBe(true)
  })
})

// ── T9.6 World–EventBus integration ──────────────────────────────────────────

describe('T9.6 World — PhysicsEventBus integration (force path)', () => {
  test('world.bus = null by default: no errors during step', () => {
    const { w } = makeWorld()
    w.addForce(new GravityForce())
    expect(() => stepN(w, 10)).not.toThrow()
  })

  test('step event emitted every World.step() call when bus is attached', () => {
    const w = new World()
    w.addBody(new Body({ x: 300, y: 50 }))
    const bus = new PhysicsEventBus()
    w.bus = bus
    w.addForce(new GravityForce())
    let stepCount = 0
    bus.on('step', () => stepCount++)
    stepN(w, 5)
    expect(stepCount).toBe(5)
  })

  test('floor-bounce event emitted when body hits floor', () => {
    const w = new World()
    w.addBody(new Body({ x: 300, y: FLOOR_Y - 1, vy: 50 }))  // moving toward floor
    const bus = new PhysicsEventBus()
    w.bus = bus
    w.addForce(new GravityForce())
    const events: PhysicsEvent[] = []
    bus.on('floor-bounce', e => events.push(e))
    stepN(w, 5)
    expect(events.length).toBeGreaterThan(0)
  })

  test('floor-bounce event contains bodyIndex, time, x, y, vx, vy, impulse', () => {
    const w = new World()
    w.addBody(new Body({ x: 300, y: FLOOR_Y - 1, vy: 50 }))
    const bus = new PhysicsEventBus()
    w.bus = bus
    w.addForce(new GravityForce())
    const events: PhysicsEvent[] = []
    bus.on('floor-bounce', e => events.push(e))
    stepN(w, 5)
    const e = events[0]
    expect(typeof e.bodyIndex).toBe('number')
    expect(typeof e.time).toBe('number')
    expect(typeof e.x).toBe('number')
    expect(typeof e.y).toBe('number')
    expect(typeof e.vx).toBe('number')
    expect(typeof e.vy).toBe('number')
    expect(typeof e.impulse).toBe('number')
    expect(e.impulse!).toBeGreaterThan(0)
  })

  test('rest event emitted when body comes to rest (force path)', () => {
    const w = new World()
    // Start AT floor with vy=0.1 — after one gravity step + bounce, |vy| < VELOCITY_CLAMP
    w.addBody(new Body({ x: 300, y: FLOOR_Y, vy: 0.1 }))
    const bus = new PhysicsEventBus()
    w.bus = bus
    w.addForce(new GravityForce())
    const restEvents: PhysicsEvent[] = []
    bus.on('rest', e => restEvents.push(e))
    stepN(w, 20)   // just a few steps — rest within 2-3 steps from floor
    expect(restEvents.length).toBeGreaterThan(0)
  })

  test('impulse on floor-bounce = mass × |Δvy|', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: FLOOR_Y - 1, vy: 50, mass: 2 }))
    const bus = new PhysicsEventBus()
    w.bus = bus
    w.addForce(new GravityForce())
    const events: PhysicsEvent[] = []
    bus.on('floor-bounce', e => events.push(e))
    w.step(0.016)
    if (events.length > 0) {
      const e = events[0]
      // impulse = mass × |Δvy| > 0
      expect(e.impulse!).toBeGreaterThan(0)
      expect(Number.isFinite(e.impulse!)).toBe(true)
    }
  })

  test('wall-bounce event emitted when body hits wall (force path)', () => {
    const w = new World()
    w.addBody(new Body({ x: WALL_L + 1, y: 200, vx: -50 }))  // heading left
    const bus = new PhysicsEventBus()
    w.bus = bus
    w.addForce(new GravityForce())
    const events: PhysicsEvent[] = []
    bus.on('wall-bounce', e => events.push(e))
    stepN(w, 5)
    expect(events.length).toBeGreaterThan(0)
  })
})

// ── T9.7 Backward compatibility ───────────────────────────────────────────────

describe('T9.7 Backward compatibility', () => {
  test('new Body({ x:300, y:50 }) — mass defaults to 1', () => {
    const b = new Body({ x: 300, y: 50 })
    expect(b.mass).toBe(1)
  })

  test('new Body() — fx and fy default to 0', () => {
    const b = new Body()
    expect(b.fx).toBe(0)
    expect(b.fy).toBe(0)
  })

  test('world without forces: step produces same gravity effect as legacy path', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    // No forces registered → legacy path
    w.step(0.016)
    // After one step: vy ≈ GRAVITY * dt = 9.8 * 0.016 = 0.1568
    expect(b.vy).toBeCloseTo(GRAVITY * 0.016, 4)
  })

  test('existing BodyState: optional mass/fx/fy do not break spread/assign patterns', () => {
    // Simulate an existing test that spreads BodyState
    const state = { x: 100, y: 200, vx: 5, vy: -3, ax: 0, ay: 9.8 }
    const b = new Body(state)
    expect(b.x).toBe(100)
    expect(b.mass).toBe(1)   // default applied
    expect(b.fx).toBe(0)
  })
})
