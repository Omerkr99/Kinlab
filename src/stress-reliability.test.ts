/**
 * KinLab Stress & Reliability Test Suite — v0.2.0
 *
 * Purpose: surface bugs, edge-cases, and invariant violations before Day 3.
 * Categories:
 *   1. Physics stress         — scale, extreme inputs, long runs
 *   2. Physics invariants     — properties that must ALWAYS hold
 *   3. Determinism at scale   — same inputs → same outputs, always
 *   4. Boundary / edge cases  — dt=0, dt<0, body below floor, vy=-∞
 *   5. DataRecorder state machine — all state transitions
 *   6. GraphEngine degenerate inputs — zero range, huge range, negatives
 *   7. InteractionLayer state machine — drag, pause, edge cases
 *   8. Full pipeline reliability — N play/reset cycles, no state leakage
 */

import { describe, test, expect } from 'vitest'
import { World } from './engine/World'
import { Body } from './engine/Body'
import { DataRecorder } from './recorder/DataRecorder'
import { GraphEngine } from './graph/GraphEngine'
import { InteractionLayer } from './engine/InteractionLayer'
import { FLOOR_Y, GRAVITY } from './constants'

// ─── helpers ────────────────────────────────────────────────────────────────

const isFinite_ = (n: number) => Number.isFinite(n) && !Number.isNaN(n)

function runWorld(steps: number, init: Partial<{ x: number; y: number; vx: number; vy: number }> = {}) {
  const w = new World()
  const b = w.addBody(new Body({ x: 300, y: 50, ...init }))
  for (let i = 0; i < steps; i++) w.step(0.016)
  return { w, b }
}

function elapsed(fn: () => void) {
  const t0 = performance.now(); fn(); return performance.now() - t0
}

// ─── 1. PHYSICS STRESS ──────────────────────────────────────────────────────

describe('Stress: Physics engine at scale', () => {
  test('100 000 steps — no NaN / Infinity in any body property', () => {
    const { b } = runWorld(100_000)
    expect(isFinite_(b.x)).toBe(true)
    expect(isFinite_(b.y)).toBe(true)
    expect(isFinite_(b.vx)).toBe(true)
    expect(isFinite_(b.vy)).toBe(true)
    expect(isFinite_(b.ax)).toBe(true)
    expect(isFinite_(b.ay)).toBe(true)
  })

  test('100 000 steps < 500 ms (long-run performance budget)', () => {
    const w = new World()
    w.addBody(new Body({ x: 300, y: 50 }))
    const ms = elapsed(() => { for (let i = 0; i < 100_000; i++) w.step(0.016) })
    console.log(`  [STRESS] 100k steps → ${ms.toFixed(1)} ms`)
    expect(ms).toBeLessThan(500)
  })

  test('500 bodies × 1 000 steps — all settle, no NaN', () => {
    const w = new World()
    const bodies = Array.from({ length: 500 }, (_, i) =>
      w.addBody(new Body({ x: 10 + (i % 50) * 12, y: 10 + Math.floor(i / 50) * 10 }))
    )
    const ms = elapsed(() => { for (let i = 0; i < 1_000; i++) w.step(0.016) })
    console.log(`  [STRESS] 500 bodies × 1k steps → ${ms.toFixed(1)} ms`)
    expect(ms).toBeLessThan(2000)
    bodies.forEach(b => {
      expect(isFinite_(b.y)).toBe(true)
      expect(b.y).toBeLessThanOrEqual(FLOOR_Y)
    })
  })

  test('world.time grows correctly over 10 000 steps (no drift)', () => {
    const w = new World()
    w.addBody(new Body({ x: 300, y: 50 }))
    for (let i = 0; i < 10_000; i++) w.step(0.016)
    expect(w.time).toBeCloseTo(10_000 * 0.016, 3)   // 160.000 s ± 0.001
  })
})

// ─── 2. PHYSICS INVARIANTS ───────────────────────────────────────────────────

describe('Invariants: Physics properties that must always hold', () => {
  test('y never exceeds FLOOR_Y — floor is a hard boundary', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    for (let i = 0; i < 5000; i++) {
      w.step(0.016)
      expect(b.y).toBeLessThanOrEqual(FLOOR_Y)
    }
  })

  test('world.time never decreases — time is monotone', () => {
    const w = new World()
    w.addBody(new Body({ x: 300, y: 50 }))
    let prev = -Infinity
    for (let i = 0; i < 1000; i++) {
      w.step(0.016)
      expect(w.time).toBeGreaterThanOrEqual(prev)
      prev = w.time
    }
  })

  test('bounce energy is strictly absorbed — |vy| after bounce < |vy| before', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    let lastVyAtFloor = Infinity

    for (let i = 0; i < 5000; i++) {
      const prevY = b.y
      w.step(0.016)
      if (prevY < FLOOR_Y && b.y === FLOOR_Y) {
        // Bounce frame: vy was flipped. Check magnitude shrank.
        expect(Math.abs(b.vy)).toBeLessThan(lastVyAtFloor)
        lastVyAtFloor = Math.abs(b.vy)
      }
    }
    expect(lastVyAtFloor).toBeLessThan(Infinity)   // at least one bounce occurred
  })

  test('once settled, body never moves again without external input', () => {
    const { b, w } = runWorld(5000)  // settles by ~3339 steps
    const snapX = b.x, snapY = b.y, snapVy = b.vy, snapAy = b.ay
    for (let i = 0; i < 1000; i++) w.step(0.016)
    expect(b.x).toBe(snapX)
    expect(b.y).toBe(snapY)
    expect(b.vy).toBe(snapVy)
    expect(b.ay).toBe(snapAy)
  })

  test('two independent World instances share no state', () => {
    const w1 = new World(); const b1 = w1.addBody(new Body({ x: 300, y: 50 }))
    const w2 = new World(); const b2 = w2.addBody(new Body({ x: 300, y: 50 }))

    for (let i = 0; i < 100; i++) w1.step(0.016)  // advance w1 only

    // w2 should be untouched
    expect(w2.time).toBe(0)
    expect(b2.y).toBe(50)
    expect(b2.vy).toBe(0)
    // w1 and b1 are independent
    expect(b1.y).toBeGreaterThan(50)
  })
})

// ─── 3. DETERMINISM AT SCALE ─────────────────────────────────────────────────

describe('Determinism: same inputs always produce same outputs', () => {
  test('10 independent runs from same initial state give identical final state', () => {
    const run = () => {
      const w = new World()
      const b = w.addBody(new Body({ x: 300, y: 50 }))
      for (let i = 0; i < 10_000; i++) w.step(0.016)
      return { x: b.x, y: b.y, vx: b.vx, vy: b.vy, ax: b.ax, ay: b.ay, time: w.time }
    }
    const results = Array.from({ length: 10 }, run)
    results.forEach(r => expect(r).toEqual(results[0]))
  })

  test('fresh World after reset produces same data as first run', () => {
    const simulate = () => {
      const w = new World()
      const b = w.addBody(new Body({ x: 300, y: 50 }))
      const r = new DataRecorder(); r.start()
      for (let i = 0; i < 1000; i++) { w.step(0.016); r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay) }
      const ts = r.getSeries('time')
      return { finalY: b.y, finalVy: b.vy, samples: r.getLength(), lastT: ts[ts.length - 1] }
    }
    expect(simulate()).toEqual(simulate())
  })
})

// ─── 4. BOUNDARY / EDGE CASES ────────────────────────────────────────────────

describe('Boundary: Edge inputs that could crash or corrupt state', () => {
  test('dt = 0 — world advances nothing, body stays put', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 200 }))
    w.step(0); w.step(0); w.step(0)
    expect(w.time).toBe(0)
    expect(b.y).toBe(200)
    expect(b.vy).toBe(0)
  })

  test('dt < 0 — clamped to 0, time does not go backward', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 200 }))
    w.step(0.016)
    const timeBefore = w.time
    w.step(-0.016)   // negative dt must be rejected
    w.step(-999)
    expect(w.time).toBe(timeBefore)   // time unchanged
    expect(b.y).toBeGreaterThan(200)  // only moved from the first valid step
  })

  test('dt > MAX_DT — clamped to 0.016, no giant leap', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    w.step(999)   // should be clamped to 0.016
    expect(b.y).toBeCloseTo(50 + GRAVITY * 0.016 * 0.016, 4)  // 1 normal step
    expect(b.y).toBeLessThanOrEqual(FLOOR_Y)
  })

  test('body starts exactly at FLOOR_Y — settles immediately (1 step)', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: FLOOR_Y }))
    w.step(0.016)
    expect(b.y).toBe(FLOOR_Y)
    expect(b.vy).toBe(0)
    expect(b.ay).toBe(0)
  })

  test('body starts below FLOOR_Y — teleported to floor within 1 step', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: FLOOR_Y + 100 }))
    w.step(0.016)
    expect(b.y).toBe(FLOOR_Y)
    expect(b.vy).toBe(0)
    expect(b.ay).toBe(0)
  })

  test('body with huge downward vy — clamps on first step, no Infinity', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50, vy: 1_000_000 }))
    w.step(0.016)
    expect(b.y).toBe(FLOOR_Y)
    expect(isFinite_(b.vy)).toBe(true)
    expect(b.vy).toBeLessThanOrEqual(0)   // after bounce, going up
  })

  test('body with large upward vy — rises, slows, falls, settles normally', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 400, vy: -500 }))  // fast upward
    for (let i = 0; i < 100_000; i++) w.step(0.016)
    expect(b.y).toBe(FLOOR_Y)
    expect(b.vy).toBe(0)
    expect(isFinite_(b.y)).toBe(true)
  })

  test('body at y=0 (top of canvas) falls normally to FLOOR_Y', () => {
    const { b } = runWorld(5000, { y: 0 })
    expect(b.y).toBe(FLOOR_Y)
    expect(b.vy).toBe(0)
  })
})

// ─── 5. DATARECORDER STATE MACHINE ───────────────────────────────────────────

describe('Reliability: DataRecorder state transitions', () => {
  test('start() is idempotent — calling twice does not duplicate data', () => {
    const r = new DataRecorder()
    r.start(); r.start()   // second start should be harmless
    r.record(0.016, 1, 2, 3, 4, 5, 6)
    expect(r.getLength()).toBe(1)
  })

  test('stop() → record() is a no-op', () => {
    const r = new DataRecorder()
    r.start()
    r.record(0.016, 1, 2, 3, 4, 5, 6)
    r.stop()
    r.record(0.032, 2, 3, 4, 5, 6, 7)  // must be ignored
    expect(r.getLength()).toBe(1)
  })

  test('reset() while recording — stops recording and clears data', () => {
    const r = new DataRecorder()
    r.start()
    r.record(0.016, 1, 2, 3, 4, 5, 6)
    r.reset()
    r.record(0.032, 2, 3, 4, 5, 6, 7)  // must be ignored (not recording)
    expect(r.getLength()).toBe(0)
  })

  test('start() → stop() → start() — resumes recording correctly', () => {
    const r = new DataRecorder()
    r.start()
    r.record(0.016, 1, 2, 3, 4, 5, 6)
    r.stop()
    r.record(0.032, 2, 3, 4, 5, 6, 7)  // ignored
    r.start()
    r.record(0.048, 3, 4, 5, 6, 7, 8)  // recorded
    expect(r.getLength()).toBe(2)
    expect(r.getSeries('time')).toEqual([0.016, 0.048])
  })

  test('large dataset integrity — 500 000 samples, first and last values correct', () => {
    const r = new DataRecorder()
    r.start()
    for (let i = 0; i < 500_000; i++) r.record(i * 0.016, i, i * 2, i * 3, i * -1, 0, 9.8)
    const ts = r.getSeries('time')
    const xs = r.getSeries('x')
    expect(r.getLength()).toBe(500_000)
    expect(ts[0]).toBeCloseTo(0, 6)
    expect(ts[499_999]).toBeCloseTo(499_999 * 0.016, 3)
    expect(xs[0]).toBe(0)
    expect(xs[499_999]).toBe(499_999)
  })

  test('getSeries returns a fresh copy each call — mutation does not corrupt recorder', () => {
    const r = new DataRecorder()
    r.start()
    for (let i = 0; i < 10; i++) r.record(i * 0.016, i, i, i, i, 0, 9.8)
    const a = r.getSeries('x')
    const b = r.getSeries('x')
    a[0] = -9999
    expect(b[0]).toBe(0)          // b not affected by mutation of a
    expect(r.getSeries('x')[0]).toBe(0)  // recorder not affected either
  })
})

// ─── 6. GRAPHENGINE DEGENERATE INPUTS ────────────────────────────────────────

describe('Reliability: GraphEngine degenerate data', () => {
  function makeGE() {
    const c = document.createElement('canvas')
    c.width = 500; c.height = 400
    return new GraphEngine(c)
  }

  test('all y values identical (yRange=0) — does not crash', () => {
    const ge = makeGE()
    const r = new DataRecorder(); r.start()
    for (let i = 0; i < 100; i++) r.record(i * 0.016, i, 42, 0, 0, 0, 9.8)
    expect(() => ge.draw(r, 'time', 'y')).not.toThrow()
  })

  test('all x values identical (xRange=0) — does not crash', () => {
    const ge = makeGE()
    const r = new DataRecorder(); r.start()
    for (let i = 0; i < 100; i++) r.record(i * 0.016, 300, i * 2, 0, i, 0, 9.8)
    expect(() => ge.draw(r, 'x', 'vy')).not.toThrow()
  })

  test('negative values in all series — renders without crash', () => {
    const ge = makeGE()
    const r = new DataRecorder(); r.start()
    for (let i = 0; i < 50; i++) r.record(-i * 0.016, -i * 10, -i * 20, -i, -i * 5, -0.5, -9.8)
    expect(() => ge.draw(r, 'time', 'y')).not.toThrow()
    expect(() => ge.draw(r, 'vx', 'vy')).not.toThrow()
  })

  test('very large range (1e12 spread) — does not produce NaN in canvas ops', () => {
    const ge = makeGE()
    const r = new DataRecorder(); r.start()
    r.record(0, 0, 0, 0, 0, 0, 0)
    r.record(1e12, 1e12, 1e12, 1e12, 1e12, 1e12, 1e12)
    expect(() => ge.draw(r, 'time', 'y')).not.toThrow()
  })

  test('exactly 2 data points — minimum valid draw', () => {
    const ge = makeGE()
    const r = new DataRecorder(); r.start()
    r.record(0, 300, 50, 0, 0, 0, 0)
    r.record(0.016, 300, 52, 0, 0.3, 0, 9.8)
    expect(() => ge.draw(r, 'time', 'y')).not.toThrow()
  })

  test('50 000 points draw < 200 ms', () => {
    const ge = makeGE()
    const r = new DataRecorder(); r.start()
    for (let i = 0; i < 50_000; i++) r.record(i * 0.016, i * 0.1, i * 0.2, i * 0.3, i * -0.1, 0, 9.8)
    const ms = elapsed(() => ge.draw(r, 'time', 'y'))
    console.log(`  [STRESS] draw 50k pts → ${ms.toFixed(1)} ms`)
    expect(ms).toBeLessThan(200)
  })
})

// ─── 7. INTERACTIONLAYER STATE MACHINE ───────────────────────────────────────

describe('Reliability: InteractionLayer state machine', () => {
  test('updateDrag() without startDrag() — no crash, no body moved', () => {
    const il = new InteractionLayer()
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    expect(() => il.updateDrag(100, 100)).not.toThrow()
    expect(b.x).toBe(300)  // untouched
  })

  test('endDrag() without startDrag() — no crash', () => {
    const il = new InteractionLayer()
    expect(() => il.endDrag()).not.toThrow()
    expect(il.isDragging()).toBe(false)
  })

  test('pause() is idempotent', () => {
    const il = new InteractionLayer()
    il.pause(); il.pause(); il.pause()
    expect(il.isPaused()).toBe(true)
  })

  test('resume() is idempotent', () => {
    const il = new InteractionLayer()
    il.resume(); il.resume()
    expect(il.isPaused()).toBe(false)
  })

  test('drag sets body position and zeroes velocity', () => {
    const il = new InteractionLayer()
    const b = new Body({ x: 300, y: 200, vx: 5, vy: -10 })
    il.startDrag(b)
    il.updateDrag(150, 80)
    expect(b.x).toBe(150)
    expect(b.y).toBe(80)
    expect(b.vx).toBe(0)
    expect(b.vy).toBe(0)
  })

  test('after endDrag, updateDrag no longer moves body', () => {
    const il = new InteractionLayer()
    const b = new Body({ x: 300, y: 200 })
    il.startDrag(b)
    il.endDrag()
    il.updateDrag(999, 999)
    expect(b.x).toBe(300)
    expect(b.y).toBe(200)
  })

  test('dragging a settled body and releasing above floor wakes it up', () => {
    const w = new World()
    const il = new InteractionLayer()
    const b = w.addBody(new Body({ x: 300, y: 50 }))

    // Settle the ball
    for (let i = 0; i < 5000; i++) w.step(0.016)
    expect(b.y).toBe(FLOOR_Y)
    expect(b.vy).toBe(0)

    // Drag to top
    il.startDrag(b)
    il.updateDrag(300, 50)
    il.endDrag()

    // Ball should now be in free-fall again
    w.step(0.016)
    expect(b.y).toBeGreaterThan(50)   // moved down
    expect(b.vy).toBeGreaterThan(0)   // falling
  })
})

// ─── 8. FULL PIPELINE RELIABILITY ────────────────────────────────────────────

describe('Reliability: Full pipeline — N play/reset cycles', () => {
  test('10 play/reset cycles produce identical recordings', () => {
    const results: { finalY: number; len: number; lastVy: number }[] = []

    for (let cycle = 0; cycle < 10; cycle++) {
      const w = new World()
      const b = w.addBody(new Body({ x: 300, y: 50 }))
      const r = new DataRecorder()

      // Simulate handlePlay()
      w.time = 0; b.x = 300; b.y = 50; b.vx = 0; b.vy = 0; b.ax = 0; b.ay = 0
      r.reset(); r.start()
      r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)  // t=0

      for (let i = 0; i < 1000; i++) {
        w.step(0.016)
        r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
      }

      results.push({ finalY: b.y, len: r.getLength(), lastVy: b.vy })
    }

    results.forEach(res => expect(res).toEqual(results[0]))
  })

  test('world.time resets cleanly between cycles — no accumulated drift', () => {
    for (let cycle = 0; cycle < 5; cycle++) {
      const w = new World()
      const b = w.addBody(new Body({ x: 300, y: 50 }))
      w.time = 0; b.x = 300; b.y = 50; b.vx = 0; b.vy = 0; b.ax = 0; b.ay = 0

      for (let i = 0; i < 100; i++) w.step(0.016)
      expect(w.time).toBeCloseTo(100 * 0.016, 6)
    }
  })

  test('recorder + world in 5-cycle stress: no memory leak (length stays constant)', () => {
    const r = new DataRecorder()
    for (let cycle = 0; cycle < 5; cycle++) {
      const w = new World()
      const b = w.addBody(new Body({ x: 300, y: 50 }))
      r.reset(); r.start()
      r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
      for (let i = 0; i < 500; i++) {
        w.step(0.016)
        r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
      }
    }
    expect(r.getLength()).toBe(501)  // exactly 1 reset cycle kept
  })
})
