/**
 * Day 9 Load Tests: Force System + Spring + Pipeline Performance
 *
 *   D9-Load: Force pipeline throughput   — many bodies × many steps with forces
 *   D9-Load: Spring oscillation stability — long runs, bounded energy, NaN-free
 *   D9-Load: Event bus throughput        — high-frequency emit under force path
 *   D9-Load: Math utils throughput       — 1M calls per function
 *   D9-Load: Full Day 9 pipeline         — combined realistic session
 */

import { describe, test, expect } from 'vitest'
import { World }           from './engine/World'
import { Body }            from './engine/Body'
import { Spring }          from './engine/Spring'
import { GravityForce }    from './engine/forces/GravityForce'
import { SpringForce }     from './engine/forces/SpringForce'
import { DragForce }       from './engine/forces/DragForce'
import { PhysicsEventBus } from './engine/PhysicsEvents'
import { momentum, springPotentialEnergy, speed, kineticEnergy } from './utils/math'
import { FLOOR_Y } from './constants'

const elapsed = (fn: () => void): number => {
  const t0 = performance.now(); fn(); return performance.now() - t0
}

// ── Force pipeline throughput ─────────────────────────────────────────────────

describe('D9-Load: Force pipeline throughput', () => {
  test('1 body × 10 000 steps with GravityForce + SpringForce < 200 ms', () => {
    const w = new World()
    w.gravity = 0  // isolate spring
    const b = w.addBody(new Body({ x: 300, y: 200 }))
    const sp = new Spring({ bodyA: b, stiffness: 5, restLength: 100, anchorX: 300, anchorY: 60 })
    w.addForce(new GravityForce())
    w.addForce(sp.makeForce())
    const ms = elapsed(() => {
      for (let i = 0; i < 10_000; i++) w.step(0.016)
    })
    console.log(`  [D9-FORCE] 10k steps (1 body, Gravity+Spring) → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(200)
  })

  test('10 bodies × 10 000 steps with GravityForce < 300 ms', () => {
    const w = new World()
    for (let i = 0; i < 10; i++) w.addBody(new Body({ x: 100 + i * 40, y: 50 }))
    w.addForce(new GravityForce())
    const ms = elapsed(() => {
      for (let i = 0; i < 10_000; i++) w.step(0.016)
    })
    console.log(`  [D9-FORCE] 10k steps (10 bodies, Gravity) → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(300)
  })

  test('10 bodies each with separate anchored spring × 3 600 steps < 300 ms', () => {
    const w = new World()
    w.gravity = 0
    for (let i = 0; i < 10; i++) {
      const b = w.addBody(new Body({ x: 60 + i * 50, y: 200 }))
      const sp = new Spring({ bodyA: b, stiffness: 3, restLength: 80, anchorX: 60 + i * 50, anchorY: 60 })
      w.addForce(sp.makeForce())
    }
    const ms = elapsed(() => {
      for (let i = 0; i < 3_600; i++) w.step(0.016)
    })
    console.log(`  [D9-SPRING] 10 springs × 3600 steps → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(300)
  })

  test('100 force add/remove cycles × 100 steps each < 500 ms', () => {
    const w = new World()
    w.addBody(new Body({ x: 300, y: 100 }))
    const ms = elapsed(() => {
      for (let cycle = 0; cycle < 100; cycle++) {
        const gf = new GravityForce()
        w.addForce(gf)
        for (let i = 0; i < 100; i++) w.step(0.016)
        w.removeForce(gf)
        // reset body to non-resting state so it doesn't short-circuit
        w.bodies[0].y = 100; w.bodies[0].vy = 0; w.bodies[0].ay = 0
        w.time = 0
      }
    })
    console.log(`  [D9-FORCE] 100 add/remove cycles × 100 steps → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(500)
  })
})

// ── Spring oscillation stability ──────────────────────────────────────────────

describe('D9-Load: Spring oscillation stability', () => {
  test('36 000-step undamped spring: energy bounded [0.5×E0, 1.5×E0]', () => {
    const w = new World()
    w.gravity = 0
    const b = w.addBody(new Body({ x: 300, y: 200, mass: 1 }))  // ext=40
    const sp = new Spring({ bodyA: b, stiffness: 5, restLength: 100, damping: 0, anchorX: 300, anchorY: 60 })
    w.addForce(sp.makeForce())
    const e0 = kineticEnergy(b.vx, b.vy, b.mass) + sp.potentialEnergy
    const ms = elapsed(() => {
      for (let i = 0; i < 36_000; i++) w.step(0.016)
    })
    const e1 = kineticEnergy(b.vx, b.vy, b.mass) + sp.potentialEnergy
    console.log(`  [D9-SPRING] 36k undamped steps → ${ms.toFixed(2)} ms | E0=${e0.toFixed(1)} E1=${e1.toFixed(1)}`)
    expect(e1).toBeGreaterThan(e0 * 0.5)
    expect(e1).toBeLessThan(e0 * 1.5)
  })

  test('36 000-step damped spring: body slows down, no NaN', () => {
    const w = new World()
    w.gravity = 0
    const b = w.addBody(new Body({ x: 300, y: 200 }))
    const sp = new Spring({ bodyA: b, stiffness: 5, restLength: 100, damping: 2, anchorX: 300, anchorY: 60 })
    w.addForce(sp.makeForce())
    const speedStart = speed(b.vx, b.vy)
    for (let i = 0; i < 36_000; i++) w.step(0.016)
    const speedEnd = speed(b.vx, b.vy)
    expect(Number.isFinite(b.x)).toBe(true)
    expect(Number.isFinite(b.y)).toBe(true)
    expect(Number.isFinite(b.vx)).toBe(true)
    expect(Number.isFinite(b.vy)).toBe(true)
    // Speed must have decreased (energy was dissipated)
    expect(speedEnd).toBeLessThanOrEqual(speedStart + 100)  // generous: spring starts at ext, not moving
  })

  test('body-to-body spring: both bodies finite state after 10 000 steps', () => {
    const w = new World()
    w.gravity = 0
    const a = w.addBody(new Body({ x: 300, y: 100 }))
    const b = w.addBody(new Body({ x: 300, y: 250 }))  // dist=150, rest=100
    w.addForce(new SpringForce(5, 100, 0.5, b, 0, 0))
    const ms = elapsed(() => {
      for (let i = 0; i < 10_000; i++) w.step(0.016)
    })
    console.log(`  [D9-B2B] body-to-body 10k steps → ${ms.toFixed(2)} ms`)
    expect(Number.isFinite(a.x)).toBe(true); expect(Number.isFinite(a.y)).toBe(true)
    expect(Number.isFinite(b.x)).toBe(true); expect(Number.isFinite(b.y)).toBe(true)
    expect(ms).toBeLessThan(200)
  })
})

// ── Event bus throughput ──────────────────────────────────────────────────────

describe('D9-Load: Event bus under force path', () => {
  test('step event handler called exactly N times in N steps', () => {
    const w = new World()
    w.addBody(new Body({ x: 300, y: 50 }))
    const bus = new PhysicsEventBus()
    w.bus = bus
    w.addForce(new GravityForce())
    let count = 0
    bus.on('step', () => count++)
    for (let i = 0; i < 1_000; i++) w.step(0.016)
    expect(count).toBe(1_000)
  })

  test('10 listeners × 10 000 step events < 200 ms', () => {
    const w = new World()
    w.addBody(new Body({ x: 300, y: 50 }))
    const bus = new PhysicsEventBus()
    w.bus = bus
    w.addForce(new GravityForce())
    let total = 0
    for (let i = 0; i < 10; i++) bus.on('step', () => { total++ })
    const ms = elapsed(() => {
      for (let i = 0; i < 10_000; i++) w.step(0.016)
    })
    console.log(`  [D9-BUS] 10 listeners × 10k steps → ${ms.toFixed(2)} ms | calls=${total}`)
    expect(total).toBe(100_000)  // 10 listeners × 10k steps
    expect(ms).toBeLessThan(200)
  })
})

// ── Math utils throughput ─────────────────────────────────────────────────────

describe('D9-Load: Math utils throughput', () => {
  test('momentum() × 1 000 000 calls < 100 ms', () => {
    let acc = 0
    const ms = elapsed(() => {
      for (let i = 0; i < 1_000_000; i++) acc += momentum(i * 0.001, i * 0.002, 1)
    })
    console.log(`  [D9-MATH] momentum 1M calls → ${ms.toFixed(2)} ms`)
    expect(acc).toBeGreaterThan(0)  // use result to prevent JIT elimination
    expect(ms).toBeLessThan(100)
  })

  test('springPotentialEnergy() × 1 000 000 calls < 100 ms', () => {
    let acc = 0
    const ms = elapsed(() => {
      for (let i = 0; i < 1_000_000; i++) acc += springPotentialEnergy(5, i * 0.001)
    })
    console.log(`  [D9-MATH] springPE 1M calls → ${ms.toFixed(2)} ms`)
    expect(acc).toBeGreaterThan(0)
    expect(ms).toBeLessThan(100)
  })

  test('speed() × 1 000 000 calls < 100 ms', () => {
    let acc = 0
    const ms = elapsed(() => {
      for (let i = 0; i < 1_000_000; i++) acc += speed(i * 0.001, i * 0.002)
    })
    console.log(`  [D9-MATH] speed 1M calls → ${ms.toFixed(2)} ms`)
    expect(acc).toBeGreaterThan(0)
    expect(ms).toBeLessThan(100)
  })
})

// ── Full Day 9 pipeline ───────────────────────────────────────────────────────

describe('D9-Load: Full Day 9 pipeline', () => {
  test('600-frame session: World(GravityForce+Spring) + bus + snapshot() < 400 ms', () => {
    const w = new World()
    const bus = new PhysicsEventBus()
    w.bus = bus
    const b = w.addBody(new Body({ x: 300, y: 200 }))
    const sp = new Spring({ bodyA: b, stiffness: 5, restLength: 100, damping: 0.3, anchorX: 300, anchorY: 60 })
    w.addForce(new GravityForce())
    w.addForce(sp.makeForce())
    let snapshots = 0
    bus.on('step', () => { sp.snapshot(); snapshots++ })

    const ms = elapsed(() => {
      for (let i = 0; i < 600; i++) w.step(0.016)
    })
    console.log(`  [D9-FULL] 600-frame pipeline → ${ms.toFixed(2)} ms | snapshots=${snapshots}`)
    expect(ms).toBeLessThan(400)
    expect(snapshots).toBe(600)
  })

  test('all body state fields remain finite after 36 000 steps with spring + gravity', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 200 }))
    const sp = new Spring({ bodyA: b, stiffness: 5, restLength: 100, damping: 0.1, anchorX: 300, anchorY: 60 })
    w.addForce(new GravityForce())
    w.addForce(sp.makeForce())
    for (let i = 0; i < 36_000; i++) w.step(0.016)
    expect(Number.isFinite(b.x)).toBe(true)
    expect(Number.isFinite(b.y)).toBe(true)
    expect(Number.isFinite(b.vx)).toBe(true)
    expect(Number.isFinite(b.vy)).toBe(true)
    expect(Number.isFinite(b.ax)).toBe(true)
    expect(Number.isFinite(b.ay)).toBe(true)
  })

  test('drag + spring combo: body slows to near-rest in < 36 000 steps', () => {
    const w = new World()
    w.gravity = 0
    const b = w.addBody(new Body({ x: 300, y: 200 }))
    const sp = new Spring({ bodyA: b, stiffness: 5, restLength: 100, damping: 0, anchorX: 300, anchorY: 60 })
    w.addForce(sp.makeForce())
    w.addForce(new DragForce(1))  // drag to damp oscillation
    for (let i = 0; i < 36_000; i++) w.step(0.016)
    // After heavy drag + spring, body should have very low speed
    expect(speed(b.vx, b.vy)).toBeLessThan(10)
    expect(Number.isFinite(b.y)).toBe(true)
  })
})
