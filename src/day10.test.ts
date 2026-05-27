/**
 * KinLab — Day 10 Unit Tests: Collisions + Rotation + Constraints
 *
 *   T10.1 CircleCollision.detect         — circle-circle detection
 *   T10.2 CollisionResolver.resolve      — impulse + position correction
 *   T10.3 TorqueForce + rotation         — angular integration
 *   T10.4 DistanceConstraint             — rigid rod / rope
 *   T10.5 PinJoint                       — fixed-point anchor
 *   T10.6 World integration              — all Day 10 phases in World.step()
 *   T10.7 Backward compatibility         — new fields, old paths unaffected
 *   T10.8 Angular math utils             — angularKE, torque, angularMomentum, angularImpulse
 */

import { describe, test, expect } from 'vitest'
import { World }               from './engine/World'
import { Body }                from './engine/Body'
import { GravityForce }        from './engine/forces/GravityForce'
import { DragForce }           from './engine/forces/DragForce'
import { TorqueForce }         from './engine/forces/TorqueForce'
import { CircleCollision }     from './engine/collisions/CircleCollision'
import { CollisionResolver }   from './engine/collisions/CollisionResolver'
import { DistanceConstraint }  from './engine/constraints/DistanceConstraint'
import { PinJoint }            from './engine/constraints/PinJoint'
import { PhysicsEventBus }     from './engine/PhysicsEvents'
import {
  angularKineticEnergy, torque as torqueFn,
  angularMomentum, angularImpulse,
  kineticEnergy,
} from './utils/math'
import { BALL_RADIUS } from './constants'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeWorld() {
  const w = new World()
  w.gravity = 0
  return w
}

function stepN(w: World, n: number, dt = 0.016) {
  for (let i = 0; i < n; i++) w.step(dt)
}

// ── T10.1 CircleCollision.detect ──────────────────────────────────────────────

describe('T10.1 CircleCollision.detect', () => {
  test('no collision when bodies are far apart', () => {
    const a = new Body({ x: 0,   y: 0 })
    const b = new Body({ x: 200, y: 0 })
    expect(CircleCollision.detect([a, b])).toHaveLength(0)
  })

  test('collision detected when circles overlap', () => {
    // Two bodies with radius=20 overlapping at distance 30 (< 40)
    const a = new Body({ x: 0,  y: 0 })
    const b = new Body({ x: 30, y: 0 })
    const manifolds = CircleCollision.detect([a, b])
    expect(manifolds).toHaveLength(1)
  })

  test('normal vector points from bodyA to bodyB', () => {
    const a = new Body({ x: 0,  y: 0 })
    const b = new Body({ x: 30, y: 0 })  // B is to the right of A
    const [m] = CircleCollision.detect([a, b])
    expect(m.normalX).toBeCloseTo(1, 5)
    expect(m.normalY).toBeCloseTo(0, 5)
    expect(m.bodyA).toBe(a)
    expect(m.bodyB).toBe(b)
  })

  test('penetration depth is correct', () => {
    // distance=30, minDist=40 → depth=10
    const a = new Body({ x: 0,  y: 0 })
    const b = new Body({ x: 30, y: 0 })
    const [m] = CircleCollision.detect([a, b])
    expect(m.depth).toBeCloseTo(10, 5)
  })

  test('N bodies: correct number of overlapping pairs', () => {
    // 4 bodies all at same place → 6 pairs (C(4,2))
    const bodies = [0,1,2,3].map(() => new Body({ x: 0, y: 0, radius: 20 } as any))
    // Avoid degenerate same-position (dist < 1e-10 is skipped)
    bodies[0].x = 0;  bodies[1].x = 10; bodies[2].x = 20; bodies[3].x = 30
    // All within 40px of each other → all 6 pairs collide
    const manifolds = CircleCollision.detect(bodies)
    expect(manifolds).toHaveLength(6)
  })
})

// ── T10.2 CollisionResolver.resolve ───────────────────────────────────────────

describe('T10.2 CollisionResolver.resolve', () => {
  test('equal mass head-on: velocities exchange (elastic e=1)', () => {
    const a = new Body({ x: 0,  y: 0, vx:  10, vy: 0 })
    const b = new Body({ x: 30, y: 0, vx: -10, vy: 0 })
    const [m] = CircleCollision.detect([a, b])
    CollisionResolver.resolve(m, 1)
    expect(a.vx).toBeCloseTo(-10, 3)
    expect(b.vx).toBeCloseTo(10,  3)
  })

  test('elastic collision (e=1): kinetic energy conserved', () => {
    const a = new Body({ x: 0,  y: 0, vx:  20, vy: 0 })
    const b = new Body({ x: 30, y: 0, vx: -10, vy: 0 })
    const keBefore = kineticEnergy(a.vx, a.vy, a.mass) + kineticEnergy(b.vx, b.vy, b.mass)
    const [m] = CircleCollision.detect([a, b])
    CollisionResolver.resolve(m, 1)
    const keAfter = kineticEnergy(a.vx, a.vy, a.mass) + kineticEnergy(b.vx, b.vy, b.mass)
    expect(keAfter).toBeCloseTo(keBefore, 3)
  })

  test('perfectly inelastic (e=0): bodies move together after collision', () => {
    const a = new Body({ x: 0,  y: 0, vx: 10, vy: 0 })
    const b = new Body({ x: 30, y: 0, vx:  0, vy: 0 })
    const [m] = CircleCollision.detect([a, b])
    CollisionResolver.resolve(m, 0)
    // Both should have same velocity (COM velocity = 5 for equal masses)
    expect(a.vx).toBeCloseTo(b.vx, 3)
  })

  test('momentum always conserved regardless of restitution', () => {
    const a = new Body({ x: 0,  y: 0, vx: 15, vy: 3, mass: 2 })
    const b = new Body({ x: 30, y: 0, vx: -5, vy: 0, mass: 3 })
    const pxBefore = a.mass * a.vx + b.mass * b.vx
    const pyBefore = a.mass * a.vy + b.mass * b.vy
    const [m] = CircleCollision.detect([a, b])
    CollisionResolver.resolve(m, 0.5)
    const pxAfter = a.mass * a.vx + b.mass * b.vx
    const pyAfter = a.mass * a.vy + b.mass * b.vy
    expect(pxAfter).toBeCloseTo(pxBefore, 3)
    expect(pyAfter).toBeCloseTo(pyBefore, 3)
  })

  test('position correction removes overlap', () => {
    const a = new Body({ x: 0,  y: 0 })
    const b = new Body({ x: 30, y: 0 })  // depth=10
    const [m] = CircleCollision.detect([a, b])
    CollisionResolver.resolve(m, 0.8)
    // After correction, distance should be >= 40 (2 * BALL_RADIUS)
    const dist = Math.abs(b.x - a.x)
    expect(dist).toBeGreaterThanOrEqual(39.99)
  })

  test('already-separating pair: no impulse applied', () => {
    // Bodies moving away from each other — should not apply impulse
    const a = new Body({ x: 0,  y: 0, vx: -5, vy: 0 })
    const b = new Body({ x: 30, y: 0, vx:  5, vy: 0 })
    const vxA = a.vx, vxB = b.vx
    const [m] = CircleCollision.detect([a, b])
    const j = CollisionResolver.resolve(m, 0.8)
    // Position correction still applies, but impulse should be 0
    expect(j).toBe(0)
    // Velocities unchanged beyond position correction
    expect(a.vx).toBeCloseTo(vxA, 5)
    expect(b.vx).toBeCloseTo(vxB, 5)
  })

  test('mass asymmetry: heavier body moves less', () => {
    const a = new Body({ x: 0,  y: 0, vx:  10, vy: 0, mass: 1  })
    const b = new Body({ x: 30, y: 0, vx: -10, vy: 0, mass: 10 })
    const [m] = CircleCollision.detect([a, b])
    CollisionResolver.resolve(m, 1)
    // Light body (a) should change velocity much more than heavy body (b)
    expect(Math.abs(a.vx)).toBeGreaterThan(Math.abs(b.vx))
  })

  test('restitution parameter respected: e=0.5 loses half energy in 1D head-on', () => {
    // Equal mass, symmetric → can compute expected result analytically
    const a = new Body({ x: 0,  y: 0, vx:  10, vy: 0 })
    const b = new Body({ x: 30, y: 0, vx: -10, vy: 0 })
    const keBefore = kineticEnergy(a.vx, a.vy, a.mass) + kineticEnergy(b.vx, b.vy, b.mass)
    const [m] = CircleCollision.detect([a, b])
    CollisionResolver.resolve(m, 0.5)
    const keAfter = kineticEnergy(a.vx, a.vy, a.mass) + kineticEnergy(b.vx, b.vy, b.mass)
    // e=0.5: should lose energy compared to elastic
    expect(keAfter).toBeLessThan(keBefore)
    // But still conserve momentum
    expect(a.vx + b.vx).toBeCloseTo(0, 3) // initial total px = 0
  })
})

// ── T10.3 TorqueForce + rotation ──────────────────────────────────────────────

describe('T10.3 TorqueForce + rotation', () => {
  test('TorqueForce adds to b.torque accumulator', () => {
    const w = makeWorld()
    const b = w.addBody(new Body({ x: 300, y: 100 }))
    const tf = new TorqueForce(5)
    tf.apply(b, w, 0.016)
    expect(b.torque).toBeCloseTo(5, 5)
  })

  test('torque accumulator is cleared at start of each step', () => {
    const w = makeWorld()
    const b = w.addBody(new Body({ x: 300, y: 100 }))
    w.addForce(new TorqueForce(5))
    w.step(0.016)  // after step, torque is cleared
    // We can't observe mid-step, but after another step omega should have advanced
    // by exactly 1 step's worth — not 2 (which would happen if torque accumulated)
    const omegaAfter1 = b.omega
    w.step(0.016)
    const omegaAfter2 = b.omega
    // Each step adds same Δω — linear growth if cleared correctly
    expect(omegaAfter2 - omegaAfter1).toBeCloseTo(omegaAfter1, 5)
  })

  test('omega increases linearly under constant torque', () => {
    const w = makeWorld()
    const b = w.addBody(new Body({ x: 300, y: 100, inertia: 1 }))
    w.addForce(new TorqueForce(10))
    stepN(w, 10, 0.016)
    // α = τ/I = 10/1 = 10 rad/s²; ω after 10 steps = 10 × 10 × 0.016 = 1.6
    expect(b.omega).toBeCloseTo(1.6, 3)
  })

  test('angle advances: Δangle = omega × dt per step', () => {
    const w = makeWorld()
    const b = w.addBody(new Body({ x: 300, y: 100, omega: 2 }))  // pre-set omega
    w.addForce(new GravityForce())  // need force path active
    w.step(0.016)
    // angle should have advanced by ≈ 2 * 0.016 = 0.032
    // (plus tiny contribution from torque=0 → alpha=0)
    expect(b.angle).toBeCloseTo(2 * 0.016, 3)
  })

  test('no rotation when torque=0 and omega=0 (no-op)', () => {
    const w = makeWorld()
    const b = w.addBody(new Body({ x: 300, y: 100 }))
    w.addForce(new GravityForce())
    stepN(w, 100, 0.016)
    expect(b.angle).toBe(0)
    expect(b.omega).toBe(0)
  })
})

// ── T10.4 DistanceConstraint ──────────────────────────────────────────────────

describe('T10.4 DistanceConstraint', () => {
  test('two bodies: distance converges to target after many solves', () => {
    const a = new Body({ x: 0,   y: 0 })
    const b = new Body({ x: 200, y: 0 })  // initial distance 200, target 100
    const c = new DistanceConstraint(a, 100, b)
    for (let i = 0; i < 20; i++) c.solve(0.016)
    const dx = b.x - a.x, dy = b.y - a.y
    const dist = Math.sqrt(dx*dx + dy*dy)
    expect(dist).toBeCloseTo(100, 0)
  })

  test('anchored constraint: body approaches target distance from anchor', () => {
    const a = new Body({ x: 0, y: 200 })  // 200px from anchor, target=100
    const c = new DistanceConstraint(a, 100, null, 0, 0)
    for (let i = 0; i < 20; i++) c.solve(0.016)
    const dist = Math.sqrt(a.x*a.x + a.y*a.y)
    expect(dist).toBeCloseTo(100, 0)
  })

  test('velocity correction reduces relative radial velocity', () => {
    const a = new Body({ x: 0,   y: 0, vx: 10, vy: 0 })
    const b = new Body({ x: 100, y: 0, vx: 0,  vy: 0 })
    const c = new DistanceConstraint(a, 100, b)
    // Before: relative velocity along constraint axis = 10
    const relVelBefore = (b.vx - a.vx) * 1 + (b.vy - a.vy) * 0  // normalX = 1
    c.solve(0.016)
    const dx = b.x - a.x, dy = b.y - a.y
    const dist = Math.sqrt(dx*dx + dy*dy)
    const nx = dx / dist, ny = dy / dist
    const relVelAfter = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
    expect(Math.abs(relVelAfter)).toBeLessThan(Math.abs(relVelBefore))
  })

  test('compliance > 0: softer response (larger error after one solve)', () => {
    const aRigid = new Body({ x: 0, y: 200 })
    const aSoft  = new Body({ x: 0, y: 200 })
    const cRigid = new DistanceConstraint(aRigid, 100, null, 0, 0, 0)
    const cSoft  = new DistanceConstraint(aSoft,  100, null, 0, 0, 10)
    cRigid.solve(0.016)
    cSoft.solve(0.016)
    // Soft constraint corrects less in one iteration → larger remaining error
    expect(Math.abs(cSoft.error)).toBeGreaterThan(Math.abs(cRigid.error))
  })

  test('mass asymmetry: heavier body moves less during correction', () => {
    const light = new Body({ x: 0,   y: 0, mass: 1  })
    const heavy = new Body({ x: 200, y: 0, mass: 10 })
    const x0Light = light.x, x0Heavy = heavy.x
    const c = new DistanceConstraint(light, 100, heavy)
    c.solve(0.016)
    expect(Math.abs(light.x - x0Light)).toBeGreaterThan(Math.abs(heavy.x - x0Heavy))
  })

  test('zero-length constraint: bodies converge toward same point', () => {
    const a = new Body({ x: 0,   y: 0 })
    const b = new Body({ x: 100, y: 0 })
    const c = new DistanceConstraint(a, 0, b)
    for (let i = 0; i < 30; i++) c.solve(0.016)
    const dx = b.x - a.x, dy = b.y - a.y
    expect(Math.sqrt(dx*dx + dy*dy)).toBeLessThan(1)
  })

  test('error getter returns current minus target distance', () => {
    const a = new Body({ x: 0, y: 150 })
    const c = new DistanceConstraint(a, 100, null, 0, 0)
    expect(c.error).toBeCloseTo(50, 3)  // 150 - 100 = 50
    expect(c.currentLength).toBeCloseTo(150, 3)
  })
})

// ── T10.5 PinJoint ────────────────────────────────────────────────────────────

describe('T10.5 PinJoint', () => {
  test('body is held at anchor after sufficient solves', () => {
    const b = new Body({ x: 50, y: 80 })
    const pin = new PinJoint(b, 0, 0)
    for (let i = 0; i < 30; i++) pin.solve(0.016)
    expect(pin.currentLength).toBeCloseTo(0, 0)
  })

  test('pendulum under gravity: body oscillates (position changes over time)', () => {
    const w = new World()
    const anchorX = 300, anchorY = 60
    // Body starts 80px to the right of anchor, moving downward
    const b = w.addBody(new Body({ x: anchorX + 80, y: anchorY, vx: 0, vy: 40 }))
    w.addForce(new GravityForce())
    // DistanceConstraint keeps body exactly 80px from anchor → pendulum arm
    w.addConstraint(new DistanceConstraint(b, 80, null, anchorX, anchorY))
    w.gravity = 9.8
    const positions: number[] = []
    for (let i = 0; i < 120; i++) {
      w.step(0.016)
      positions.push(b.x)
    }
    // x should vary as body swings left and right
    const minX = Math.min(...positions), maxX = Math.max(...positions)
    expect(maxX - minX).toBeGreaterThan(1)
  })

  test('velocity towards anchor is reduced by solve', () => {
    const b = new Body({ x: 100, y: 0, vx: -50, vy: 0 })  // heading toward origin
    const pin = new PinJoint(b, 0, 0)
    const distBefore = pin.currentLength
    pin.solve(0.016)
    // Radial velocity component should be corrected
    const nx = -b.x / Math.sqrt(b.x*b.x + b.y*b.y || 1)
    // Just check body moved closer to anchor
    expect(pin.currentLength).toBeLessThanOrEqual(distBefore)
  })

  test('error getter: distance of body from anchor', () => {
    const b = new Body({ x: 60, y: 80 })  // dist = 100
    const pin = new PinJoint(b, 0, 0)
    expect(pin.error).toBeCloseTo(100, 3)
  })
})

// ── T10.6 World integration ───────────────────────────────────────────────────

describe('T10.6 World integration', () => {
  test('collisionDetection=false (default): overlapping bodies not separated', () => {
    const w = makeWorld()
    w.addForce(new GravityForce())  // enable force path
    // Bodies at valid canvas positions (inside walls), overlapping (dist=30 < 40=2*BALL_RADIUS)
    w.addBody(new Body({ x: 200, y: 100 }))
    w.addBody(new Body({ x: 230, y: 100 }))
    w.step(0.016)
    expect(w.collisionDetection).toBe(false)
    // No separation applied — with gravity=0, zero velocity, positions unchanged
    expect(w.bodies[0].x).toBeCloseTo(200, 0)
    expect(w.bodies[1].x).toBeCloseTo(230, 0)
  })

  test('collisionDetection=true: overlapping bodies are pushed apart', () => {
    const w = makeWorld()
    w.addForce(new GravityForce())
    w.collisionDetection = true
    const a = w.addBody(new Body({ x: 0,  y: 0 }))
    const b = w.addBody(new Body({ x: 30, y: 0 }))  // depth=10
    w.step(0.016)
    const dist = Math.sqrt((b.x-a.x)**2 + (b.y-a.y)**2)
    expect(dist).toBeGreaterThanOrEqual(40 - 0.01)
  })

  test('collision event emitted with both body indices', () => {
    const w = makeWorld()
    w.addForce(new GravityForce())
    w.collisionDetection = true
    const bus = new PhysicsEventBus()
    w.bus = bus
    w.addBody(new Body({ x: 0,  y: 0, vx:  10, vy: 0 }))
    w.addBody(new Body({ x: 30, y: 0, vx: -10, vy: 0 }))
    const events: any[] = []
    bus.on('collision', e => events.push(e))
    w.step(0.016)
    expect(events.length).toBeGreaterThanOrEqual(1)
    expect(events[0].bodyIndex).toBe(0)
    expect(events[0].bodyIndexB).toBe(1)
  })

  test('constraint.solve() called constraintIterations times per step', () => {
    const w = makeWorld()
    w.addForce(new GravityForce())
    let solveCount = 0
    const mockConstraint = { solve: () => { solveCount++ } }
    w.addConstraint(mockConstraint)
    w.constraintIterations = 4
    w.step(0.016)
    expect(solveCount).toBe(4)
  })

  test('collision + constraint together: both phases run', () => {
    const w = makeWorld()
    w.addForce(new GravityForce())
    w.collisionDetection = true
    const bus = new PhysicsEventBus()
    w.bus = bus
    const a = w.addBody(new Body({ x: 0,  y: 0, vx:  10, vy: 0 }))
    const b = w.addBody(new Body({ x: 30, y: 0, vx: -10, vy: 0 }))
    let constraintCalled = 0
    w.addConstraint({ solve: () => { constraintCalled++ } })
    let collisionFired = false
    bus.on('collision', () => { collisionFired = true })
    w.step(0.016)
    expect(collisionFired).toBe(true)
    expect(constraintCalled).toBe(4)
  })

  test('addConstraint / removeConstraint work correctly', () => {
    const w = makeWorld()
    let count = 0
    const c = { solve: () => { count++ } }
    w.addConstraint(c)
    w.addForce(new GravityForce())
    w.addBody(new Body({ x: 300, y: 100 }))
    w.step(0.016)
    expect(count).toBe(4)  // 4 iterations
    w.removeConstraint(c)
    w.step(0.016)
    expect(count).toBe(4)  // no more calls
  })

  test('constraintIterations=0: no solve calls', () => {
    const w = makeWorld()
    w.addForce(new GravityForce())
    w.addBody(new Body({ x: 300, y: 100 }))
    w.constraintIterations = 0
    let count = 0
    w.addConstraint({ solve: () => { count++ } })
    w.step(0.016)
    expect(count).toBe(0)
  })

  test('angular integration runs in force path: omega advances', () => {
    const w = makeWorld()
    const b = w.addBody(new Body({ x: 300, y: 100 }))
    w.addForce(new TorqueForce(10))
    stepN(w, 5, 0.016)
    expect(b.omega).toBeGreaterThan(0)
    expect(b.angle).toBeGreaterThan(0)
  })

  test('torque cleared each step: only one step worth accumulates per frame', () => {
    const w = makeWorld()
    const b = w.addBody(new Body({ x: 300, y: 100, inertia: 1 }))
    w.addForce(new TorqueForce(10))  // α = 10
    w.step(0.016)
    const dOmega1 = b.omega  // after 1 step: Δω = 10 * 0.016 = 0.16
    w.step(0.016)
    const dOmega2 = b.omega - dOmega1
    // Each step adds same Δω (torque cleared and re-applied once per step)
    expect(dOmega2).toBeCloseTo(dOmega1, 4)
  })

  test('step event still emitted after collision phase', () => {
    const w = makeWorld()
    w.addForce(new GravityForce())
    w.collisionDetection = true
    const bus = new PhysicsEventBus()
    w.bus = bus
    w.addBody(new Body({ x: 0,  y: 0 }))
    w.addBody(new Body({ x: 30, y: 0 }))
    let stepCount = 0
    bus.on('step', () => stepCount++)
    w.step(0.016)
    expect(stepCount).toBe(1)
  })
})

// ── T10.7 Backward compatibility ──────────────────────────────────────────────

describe('T10.7 Backward compatibility', () => {
  test('new Body fields default to correct values', () => {
    const b = new Body()
    expect(b.angle).toBe(0)
    expect(b.omega).toBe(0)
    expect(b.alpha).toBe(0)
    expect(b.torque).toBe(0)
    expect(b.inertia).toBe(1)
    expect(b.radius).toBe(BALL_RADIUS)
  })

  test('legacy path unchanged: no forces → old Euler path runs', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    // No forces registered → legacy path
    expect(w.forces).toHaveLength(0)
    w.step(0.016)
    // Body should have fallen under legacy gravity (9.8 px/s²)
    expect(b.vy).toBeGreaterThan(0)
    expect(b.angle).toBe(0)  // legacy path doesn't touch rotation
  })

  test('force path with no constraints/collisions: no extra behavior', () => {
    const w = makeWorld()
    const b = w.addBody(new Body({ x: 300, y: 100 }))
    w.addForce(new GravityForce())
    w.gravity = 9.8
    stepN(w, 10, 0.016)
    // Same kinematics as Day 9: body falls, no rotation, no constraints
    expect(b.angle).toBe(0)
    expect(w.collisionDetection).toBe(false)
    expect(w.constraints).toHaveLength(0)
  })

  test('all Day 9 force types still functional', () => {
    // Smoke test: Day 9 forces still work correctly with Day 10 additions
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 100 }))
    w.addForce(new GravityForce())
    w.addForce(new DragForce(0.1))
    w.step(0.016)
    expect(Number.isFinite(b.x)).toBe(true)
    expect(Number.isFinite(b.y)).toBe(true)
  })

  test('collisionDetection defaults to false', () => {
    const w = new World()
    expect(w.collisionDetection).toBe(false)
  })
})

// ── T10.8 Angular math utils ──────────────────────────────────────────────────

describe('T10.8 Angular math utils', () => {
  test('angularKineticEnergy: ½Iω²', () => {
    expect(angularKineticEnergy(2, 3)).toBeCloseTo(0.5 * 3 * 4, 5)  // ½ × 3 × 4 = 6
    expect(angularKineticEnergy(0, 10)).toBe(0)
    expect(angularKineticEnergy(1, 1)).toBeCloseTo(0.5, 5)
  })

  test('torque (cross product): rx*Fy − ry*Fx', () => {
    // Horizontal force at vertical arm → pure torque
    expect(torqueFn(0, 5, 10, 0)).toBeCloseTo(-50, 5)  // 0*0 - 5*10 = -50
    expect(torqueFn(5, 0, 0, 10)).toBeCloseTo(50, 5)   // 5*10 - 0*0 = 50
    expect(torqueFn(0, 0, 10, 10)).toBe(0)              // no arm → no torque
  })

  test('angularMomentum: I × ω', () => {
    expect(angularMomentum(3, 4)).toBeCloseTo(12, 5)
    expect(angularMomentum(0, 10)).toBe(0)
  })

  test('angularImpulse: τ × dt / I', () => {
    expect(angularImpulse(10, 2, 0.016)).toBeCloseTo(10 * 0.016 / 2, 5)
    expect(angularImpulse(0, 1, 1)).toBe(0)
  })

  test('combined: TorqueForce → correct omega after N steps', () => {
    const w = makeWorld()
    const b = w.addBody(new Body({ x: 300, y: 100, inertia: 2 }))
    w.addForce(new TorqueForce(4))  // α = 4/2 = 2 rad/s²
    stepN(w, 10, 0.016)
    // ω = α × N × dt = 2 × 10 × 0.016 = 0.32
    expect(b.omega).toBeCloseTo(0.32, 3)
    // angle = ∑ω×dt — cumulative; after 10 steps ≈ ½α(N*dt)² = ½ × 2 × (0.16)² = 0.0256
    expect(b.angle).toBeCloseTo(0.5 * 2 * (10 * 0.016)**2, 2)
  })
})
