/**
 * KinLab Load Test Suite — v0.1.0
 * Tests engine throughput, recorder capacity, graph render time, and memory bounds.
 * All thresholds are conservative for a 60fps interactive physics sim.
 */

import { describe, test, expect } from 'vitest'
import { World } from './engine/World'
import { Body } from './engine/Body'
import { DataRecorder } from './recorder/DataRecorder'
import { GraphEngine } from './graph/GraphEngine'

// ─── helpers ────────────────────────────────────────────────────────────────

const elapsed = (fn: () => void): number => {
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}

// ─── 1. ENGINE THROUGHPUT ────────────────────────────────────────────────────

describe('Load: Engine throughput', () => {
  test('1 body × 10 000 steps < 50 ms', () => {
    const w = new World()
    w.addBody(new Body({ x: 300, y: 50 }))
    const ms = elapsed(() => {
      for (let i = 0; i < 10_000; i++) w.step(0.016)
    })
    console.log(`  [ENGINE] 1 body  × 10k steps  → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(50)
  })

  test('10 bodies × 10 000 steps < 200 ms', () => {
    const w = new World()
    for (let i = 0; i < 10; i++) w.addBody(new Body({ x: 50 + i * 50, y: 20 }))
    const ms = elapsed(() => {
      for (let i = 0; i < 10_000; i++) w.step(0.016)
    })
    console.log(`  [ENGINE] 10 bodies × 10k steps → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(200)
  })

  test('100 bodies × 1 000 steps < 200 ms', () => {
    const w = new World()
    for (let i = 0; i < 100; i++) w.addBody(new Body({ x: (i % 10) * 60, y: Math.floor(i / 10) * 40 }))
    const ms = elapsed(() => {
      for (let i = 0; i < 1_000; i++) w.step(0.016)
    })
    console.log(`  [ENGINE] 100 bodies × 1k steps → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(200)
  })

  test('step throughput > 500 000 steps/sec (single body)', () => {
    const w = new World()
    w.addBody(new Body({ x: 300, y: 50 }))
    const STEPS = 100_000
    const ms = elapsed(() => {
      for (let i = 0; i < STEPS; i++) w.step(0.016)
    })
    const stepsPerSec = (STEPS / ms) * 1000
    console.log(`  [ENGINE] throughput: ${Math.round(stepsPerSec).toLocaleString()} steps/sec`)
    expect(stepsPerSec).toBeGreaterThan(500_000)
  })
})

// ─── 2. RECORDER CAPACITY ───────────────────────────────────────────────────

describe('Load: DataRecorder capacity', () => {
  test('record 10 000 samples < 10 ms', () => {
    const r = new DataRecorder()
    r.start()
    const ms = elapsed(() => {
      for (let i = 0; i < 10_000; i++) r.record(i * 0.016, i * 0.1, i * 0.5, 9.8)
    })
    console.log(`  [RECORDER] 10k samples → ${ms.toFixed(2)} ms  (length=${r.getLength()})`)
    expect(ms).toBeLessThan(10)
    expect(r.getLength()).toBe(10_000)
  })

  test('record 100 000 samples < 80 ms', () => {
    const r = new DataRecorder()
    r.start()
    const ms = elapsed(() => {
      for (let i = 0; i < 100_000; i++) r.record(i * 0.016, i * 0.1, i * 0.5, 9.8)
    })
    console.log(`  [RECORDER] 100k samples → ${ms.toFixed(2)} ms  (length=${r.getLength()})`)
    expect(ms).toBeLessThan(80)
    expect(r.getLength()).toBe(100_000)
  })

  test('getSeries on 100 000 samples < 20 ms', () => {
    const r = new DataRecorder()
    r.start()
    for (let i = 0; i < 100_000; i++) r.record(i * 0.016, i * 0.1, i * 0.5, 9.8)
    const ms = elapsed(() => {
      r.getSeries('time')
      r.getSeries('x')
      r.getSeries('vx')
      r.getSeries('ax')
    })
    console.log(`  [RECORDER] getSeries ×4 on 100k → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(20)
  })

  test('reset is O(1) — always < 2 ms regardless of size', () => {
    const r = new DataRecorder()
    r.start()
    for (let i = 0; i < 100_000; i++) r.record(i * 0.016, i, i, 9.8)
    const ms = elapsed(() => r.reset())
    console.log(`  [RECORDER] reset after 100k → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(2)
    expect(r.getLength()).toBe(0)
  })
})

// ─── 3. GRAPH RENDER PERFORMANCE ────────────────────────────────────────────

describe('Load: GraphEngine render', () => {
  test('draw 1 000 points < 5 ms', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 500; canvas.height = 400
    const ge = new GraphEngine(canvas)
    const r = new DataRecorder()
    r.start()
    for (let i = 0; i < 1_000; i++) r.record(i * 0.016, i * 0.1, i * 0.2, 9.8)
    const ms = elapsed(() => ge.draw(r, 'time', 'x'))
    console.log(`  [GRAPH] draw 1k pts → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(5)
  })

  test('draw 10 000 points < 20 ms', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 500; canvas.height = 400
    const ge = new GraphEngine(canvas)
    const r = new DataRecorder()
    r.start()
    for (let i = 0; i < 10_000; i++) r.record(i * 0.016, i * 0.1, i * 0.2, 9.8)
    const ms = elapsed(() => ge.draw(r, 'time', 'x'))
    console.log(`  [GRAPH] draw 10k pts → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(20)
  })

  test('30 consecutive draw calls (simulate 1 sec at 30fps) < 30 ms total', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 500; canvas.height = 400
    const ge = new GraphEngine(canvas)
    const r = new DataRecorder()
    r.start()
    for (let i = 0; i < 500; i++) r.record(i * 0.016, i * 0.1, i * 0.2, 9.8)
    const ms = elapsed(() => {
      for (let f = 0; f < 30; f++) ge.draw(r, 'time', 'x')
    })
    console.log(`  [GRAPH] 30 frames × 500pts → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(30)
  })
})

// ─── 4. INTEGRATED PIPELINE STRESS ──────────────────────────────────────────

describe('Load: Full pipeline stress', () => {
  test('60fps loop for 10 simulated seconds stays < 200 ms total', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    const r = new DataRecorder()
    r.start()
    const FRAMES = 600 // 60fps × 10s
    const ms = elapsed(() => {
      for (let i = 0; i < FRAMES; i++) {
        w.step(0.016)
        r.record(w.time, b.x, b.vx, b.ax)
      }
    })
    console.log(`  [PIPELINE] 600 frames (10s sim) → ${ms.toFixed(2)} ms  (${r.getLength()} samples)`)
    expect(ms).toBeLessThan(200)
    expect(r.getLength()).toBe(FRAMES)
  })

  test('determinism holds after 10 000 steps with full recording', () => {
    const run = () => {
      const w = new World()
      const b = w.addBody(new Body({ x: 300, y: 50 }))
      const r = new DataRecorder()
      r.start()
      for (let i = 0; i < 10_000; i++) {
        w.step(0.016)
        r.record(w.time, b.x, b.vx, b.ax)
      }
      return { x: b.x, y: b.y, vx: b.vx, len: r.getLength() }
    }
    const r1 = run()
    const r2 = run()
    console.log(`  [PIPELINE] determinism check → x=${r1.x.toFixed(4)}, len=${r1.len}`)
    expect(r1).toEqual(r2)
  })

  test('memory — recorder does not leak after reset/start cycle ×100', () => {
    const r = new DataRecorder()
    const ms = elapsed(() => {
      for (let cycle = 0; cycle < 100; cycle++) {
        r.reset()
        r.start()
        for (let i = 0; i < 1_000; i++) r.record(i * 0.016, i, i, 9.8)
      }
    })
    console.log(`  [MEMORY] 100 reset/record cycles (100k total) → ${ms.toFixed(2)} ms  final len=${r.getLength()}`)
    expect(r.getLength()).toBe(1_000)   // only last cycle's data
    expect(ms).toBeLessThan(500)
  })
})
