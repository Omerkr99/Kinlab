/**
 * KinLab Data Integrity Test Suite
 *
 * Verifies that every series in DataRecorder carries physically meaningful
 * values, that the recording happens at the right point in the loop, and
 * that the graph direction (which value is "up") matches the physics.
 *
 * Coordinate convention (canvas):
 *   x  → right is positive
 *   y  → DOWN is positive  (y=50 = near top of canvas, y=500 = floor)
 *   vy → positive = moving DOWN (falling)
 *   ay → positive = accelerating DOWN (gravity, 9.8 px/s²)
 *        ay = 0 when resting on floor (normal force cancels gravity)
 */

import { describe, test, expect } from 'vitest'
import { World } from './engine/World'
import { Body } from './engine/Body'
import { DataRecorder } from './recorder/DataRecorder'
import { FLOOR_Y, GRAVITY } from './constants'

// ─── helpers ────────────────────────────────────────────────────────────────

/** Run world + record for N steps, return final body state and recorder. */
function simulate(steps: number, dt = 0.016) {
  const w = new World()
  const b = w.addBody(new Body({ x: 300, y: 50 }))
  const r = new DataRecorder()
  r.start()
  // Record t=0 initial state (mirrors ControlBar.handlePlay behaviour)
  r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
  for (let i = 0; i < steps; i++) {
    w.step(dt)
    r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
  }
  return { w, b, r }
}

/** Run until ball reaches FLOOR_Y for the first time.  Returns step index. */
function stepUntilFloor(w: World, b: Body, r: DataRecorder, maxSteps = 2000): number {
  for (let i = 0; i < maxSteps; i++) {
    w.step(0.016)
    r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
    if (b.y >= FLOOR_Y) return i
  }
  return -1  // never hit floor (test will catch via expect)
}

// ─── 1. RECORDING LIFECYCLE ─────────────────────────────────────────────────

describe('Data flow: recording lifecycle', () => {
  test('t=0 initial state is the very first recorded sample', () => {
    const { r } = simulate(1)
    expect(r.getSeries('time')[0]).toBe(0)
    expect(r.getSeries('y')[0]).toBe(50)
    expect(r.getSeries('vy')[0]).toBe(0)
    expect(r.getSeries('ay')[0]).toBe(0)
    expect(r.getSeries('x')[0]).toBe(300)
    expect(r.getSeries('vx')[0]).toBe(0)
    expect(r.getSeries('ax')[0]).toBe(0)
  })

  test('second sample (after step 1) reflects Euler integration', () => {
    const { r } = simulate(1)
    const dt = 0.016
    // After one step: vy += GRAVITY*dt, y += vy*dt
    const expectedVy = GRAVITY * dt                // 0.1568
    const expectedY  = 50 + expectedVy * dt        // 50.002509
    expect(r.getSeries('vy')[1]).toBeCloseTo(expectedVy, 4)
    expect(r.getSeries('y')[1]).toBeCloseTo(expectedY, 4)
    expect(r.getSeries('time')[1]).toBeCloseTo(dt, 6)
  })

  test('record() is a no-op when recorder is not started', () => {
    const r = new DataRecorder()  // NOT started
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    w.step(0.016)
    r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
    expect(r.getLength()).toBe(0)
  })

  test('all 7 series grow in lockstep — equal length at every step', () => {
    const { r } = simulate(50)
    const keys = ['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay'] as const
    const lengths = keys.map(k => r.getSeries(k).length)
    expect(new Set(lengths).size).toBe(1)   // all equal
    expect(lengths[0]).toBe(51)             // t=0 + 50 steps
  })
})

// ─── 2. FREE-FALL DIRECTION ──────────────────────────────────────────────────

describe('Direction: free fall (y=50 → y=500)', () => {
  test('y strictly increases during free fall — falling = +y direction (canvas coords)', () => {
    // Ball drops from y=50; each step before reaching floor must have y > previous y
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    const r = new DataRecorder()
    r.start()
    r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)

    while (b.y < FLOOR_Y) {
      w.step(0.016)
      r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
    }

    const ys = r.getSeries('y')
    for (let i = 1; i < ys.length - 1; i++) {  // skip last (bounce frame)
      expect(ys[i]).toBeGreaterThan(ys[i - 1])
    }
  })

  test('vy > 0 during free fall — positive vy = moving downward (canvas convention)', () => {
    const { r } = simulate(100)   // ~100 steps, well before floor
    const vys = r.getSeries('vy')
    // Every recorded vy from step 1 onward should be positive (falling)
    for (let i = 1; i < vys.length; i++) {
      expect(vys[i]).toBeGreaterThan(0)
    }
  })

  test('vy increases monotonically during free fall — acceleration is constant', () => {
    const { r } = simulate(100)
    const vys = r.getSeries('vy')
    for (let i = 2; i < vys.length; i++) {
      expect(vys[i]).toBeGreaterThan(vys[i - 1])
    }
  })

  test('ay = GRAVITY (9.8) during free fall — gravity always active', () => {
    const { r } = simulate(100)
    const ays = r.getSeries('ay')
    // Skip index 0 (t=0 initial, ay=0 before any step ran)
    for (let i = 1; i < ays.length; i++) {
      expect(ays[i]).toBeCloseTo(GRAVITY, 5)
    }
  })

  test('time series is strictly monotonically increasing', () => {
    const { r } = simulate(200)
    const ts = r.getSeries('time')
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]).toBeGreaterThan(ts[i - 1])
    }
  })
})

// ─── 3. X-AXIS INVARIANCE ───────────────────────────────────────────────────

describe('Direction: horizontal invariance (no sideways forces)', () => {
  test('x stays exactly 300 — no horizontal movement', () => {
    const { r } = simulate(500)
    r.getSeries('x').forEach(v => expect(v).toBe(300))
  })

  test('vx stays 0 — no horizontal velocity', () => {
    const { r } = simulate(500)
    r.getSeries('vx').forEach(v => expect(v).toBe(0))
  })

  test('ax stays 0 — no horizontal acceleration', () => {
    const { r } = simulate(500)
    r.getSeries('ax').forEach(v => expect(v).toBe(0))
  })
})

// ─── 4. BOUNCE BEHAVIOUR ────────────────────────────────────────────────────

describe('Direction: bounce at FLOOR_Y', () => {
  test('vy flips to negative immediately after first bounce (ball rebounds upward)', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    const r = new DataRecorder()
    r.start()
    r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)

    const floorIdx = stepUntilFloor(w, b, r)
    expect(floorIdx).toBeGreaterThan(0)   // ball reached the floor

    // At floor frame, y == FLOOR_Y and vy < 0 (just bounced)
    const ys  = r.getSeries('y')
    const vys = r.getSeries('vy')
    const floorSampleIdx = ys.lastIndexOf(FLOOR_Y)
    expect(vys[floorSampleIdx]).toBeLessThan(0)   // rebounding upward
  })

  test('y decreases after first bounce — ball moving up', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    const r = new DataRecorder()
    r.start()
    r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)

    stepUntilFloor(w, b, r)

    // Record a few more steps after the bounce
    for (let i = 0; i < 20; i++) {
      w.step(0.016)
      r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
    }

    const ys  = r.getSeries('y')
    const vys = r.getSeries('vy')
    const bounceIdx = ys.lastIndexOf(FLOOR_Y)

    // Immediately after bounce, vy < 0 and y should be decreasing
    expect(ys[bounceIdx + 1]).toBeLessThan(FLOOR_Y)
    expect(vys[bounceIdx]).toBeLessThan(0)
  })

  test('vy before bounce is larger than vy after bounce (energy lost to damping)', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    const r = new DataRecorder()
    r.start()
    r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)

    stepUntilFloor(w, b, r)

    const vys = r.getSeries('vy')
    const ys  = r.getSeries('y')
    const bounceIdx = ys.lastIndexOf(FLOOR_Y)

    const vyBefore = vys[bounceIdx - 1]   // last vy before hitting floor (positive, large)
    const vyAfter  = vys[bounceIdx]       // vy at bounce frame (negative, smaller magnitude)

    expect(vyBefore).toBeGreaterThan(0)
    expect(vyAfter).toBeLessThan(0)
    expect(Math.abs(vyAfter)).toBeLessThan(Math.abs(vyBefore))   // energy absorbed
  })
})

// ─── 5. RESTING STATE ───────────────────────────────────────────────────────

describe('Direction: resting on floor', () => {
  test('vy = 0 when ball is fully at rest', () => {
    // Ball settles at ~step 3339 (DAMPING=0.7, GRAVITY=9.8, h=450px)
    // Use 4000 steps for 20 % headroom
    const { b } = simulate(4000)
    expect(b.y).toBe(FLOOR_Y)
    expect(b.vy).toBe(0)
  })

  test('ay = 0 when ball is at rest — net force is zero (gravity + normal force)', () => {
    const { b } = simulate(4000)
    expect(b.ay).toBe(0)
  })

  test('recorded ay transitions from GRAVITY to 0 when ball settles', () => {
    const { r } = simulate(4000)
    const ays = r.getSeries('ay')

    // Early values (during fall) should be GRAVITY
    expect(ays[10]).toBeCloseTo(GRAVITY, 5)

    // Last values (after settling) should be 0
    const last = ays[ays.length - 1]
    expect(last).toBe(0)
  })

  test('vx = 0 and vy = 0 when ball is at rest — no residual motion', () => {
    const { b } = simulate(4000)
    expect(b.vx).toBe(0)
    expect(b.vy).toBe(0)
  })
})

// ─── 6. SERIES CONSISTENCY ──────────────────────────────────────────────────

describe('Series consistency', () => {
  test('getSeries returns a copy — mutating it does not affect the recorder', () => {
    const { r } = simulate(10)
    const ys = r.getSeries('y')
    const lenBefore = r.getLength()
    ys.push(9999)         // mutate the returned copy
    expect(r.getLength()).toBe(lenBefore)  // internal data unchanged
    expect(r.getSeries('y').includes(9999)).toBe(false)
  })

  test('reset clears all series and getLength returns 0', () => {
    const { r } = simulate(100)
    expect(r.getLength()).toBeGreaterThan(0)
    r.reset()
    expect(r.getLength()).toBe(0);
    (['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay'] as const)
      .forEach(k => expect(r.getSeries(k).length).toBe(0))
  })

  test('recorded time matches world.time exactly at every sample', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    const r = new DataRecorder()
    r.start()
    r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)

    const snapshots: number[] = [w.time]
    for (let i = 0; i < 50; i++) {
      w.step(0.016)
      snapshots.push(w.time)
      r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
    }

    const ts = r.getSeries('time')
    snapshots.forEach((t, i) => expect(ts[i]).toBeCloseTo(t, 10))
  })
})
