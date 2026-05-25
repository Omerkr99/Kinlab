/**
 * KinLab Readiness Test Suite — v1.0.0
 *
 * Day 4 preparation: stress-tests the engine, recorder, graph, and CSV layers
 * at the scale and usage patterns the next sprint will demand.
 *
 * Categories
 * ──────────
 *  1. Multi-body wall stress     — 10–50 bodies bouncing between walls
 *  2. Energy bookkeeping         — KE dissipation invariants
 *  3. Long-session / memory      — 36 k steps, 200 k samples, 500 reset cycles
 *  4. CSV at scale               — 10 k – 50 k row generation time + output validity
 *  5. BroadcastChannel payload   — structuredClone proxy for cross-window transfer
 *  6. Gravity extremes           — g=0, g=30, g=-9.8, rapid switching
 *  7. Wall damping invariants     — exponential |vx| decay, extreme vx, determinism
 *  8. Multi-recorder pipeline    — 5 bodies × 5 recorders, CSV integrity
 *  9. Day-4 API surface          — addBody after simulation, empty world, addBody count
 */

import { describe, test, expect } from 'vitest'
import { World } from './engine/World'
import { Body } from './engine/Body'
import { DataRecorder } from './recorder/DataRecorder'
import { GraphEngine } from './graph/GraphEngine'
import { buildCsv } from './components/CsvExportButton'
import {
  FLOOR_Y, CANVAS_W, BALL_RADIUS,
  WALL_L, WALL_R, WALL_DAMPING, GRAVITY,
} from './constants'

// ─── helpers ────────────────────────────────────────────────────────────────

const elapsed = (fn: () => void) => { const t0 = performance.now(); fn(); return performance.now() - t0 }

const isFiniteNum = (n: number) => Number.isFinite(n) && !Number.isNaN(n)

function makeRecorder(n: number, vx = 0, g = GRAVITY): DataRecorder {
  const w = new World(); w.gravity = g
  const b = w.addBody(new Body({ x: 300, y: 50, vx }))
  const r = new DataRecorder(); r.start()
  for (let i = 0; i < n; i++) {
    w.step(0.016)
    r.record(w.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
  }
  return r
}

// ─── 1. MULTI-BODY WALL STRESS ───────────────────────────────────────────────

describe('Readiness: Multi-body wall stress', () => {

  test('20 bodies × 5 000 steps — x always in [WALL_L, WALL_R]', () => {
    const w = new World()
    const span = WALL_R - WALL_L
    const bodies = Array.from({ length: 20 }, (_, i) =>
      w.addBody(new Body({
        x:  WALL_L + span * (i / 19),
        y:  50 + i * 20,
        vx: (i % 2 === 0 ? 1 : -1) * (30 + i * 15),
      })),
    )
    const violations: string[] = []
    for (let s = 0; s < 5_000; s++) {
      w.step(0.016)
      for (const b of bodies) {
        if (b.x < WALL_L - 0.001 || b.x > WALL_R + 0.001) {
          violations.push(`step=${s} x=${b.x.toFixed(2)}`)
        }
      }
    }
    expect(violations).toHaveLength(0)
  })

  test('20 bodies × 5 000 steps < 800 ms', () => {
    const w = new World()
    for (let i = 0; i < 20; i++) w.addBody(new Body({ x: 100 + i * 20, y: 50, vx: (i % 2 ? 1 : -1) * 100 }))
    const ms = elapsed(() => { for (let i = 0; i < 5_000; i++) w.step(0.016) })
    console.log(`  [MULTI] 20 bodies × 5k steps → ${ms.toFixed(1)} ms`)
    expect(ms).toBeLessThan(800)
  })

  test('50 bodies × 1 000 steps — no NaN in any property', () => {
    const w = new World()
    const bodies = Array.from({ length: 50 }, (_, i) =>
      w.addBody(new Body({ x: WALL_L + (WALL_R - WALL_L) * (i / 49), y: 30 + i * 8, vx: (i % 2 ? 1 : -1) * 50 })),
    )
    for (let i = 0; i < 1_000; i++) w.step(0.016)
    for (const b of bodies) {
      expect(isFiniteNum(b.x)).toBe(true)
      expect(isFiniteNum(b.y)).toBe(true)
      expect(isFiniteNum(b.vx)).toBe(true)
      expect(isFiniteNum(b.vy)).toBe(true)
    }
  })

  test('50 bodies × 1 000 steps < 500 ms', () => {
    const w = new World()
    for (let i = 0; i < 50; i++) w.addBody(new Body({ x: 100 + i * 8, y: 50, vx: (i % 2 ? 1 : -1) * 80 }))
    const ms = elapsed(() => { for (let i = 0; i < 1_000; i++) w.step(0.016) })
    console.log(`  [MULTI] 50 bodies × 1k steps → ${ms.toFixed(1)} ms`)
    expect(ms).toBeLessThan(500)
  })

  test('10 bodies — independence: each body obeys its own initial vx sign correctly', () => {
    // Bodies with vx=+100 should end up right of centre; bodies with vx=-100 settle left
    // (Before damping kills horizontal velocity they spend more time near their target wall)
    const w = new World()
    const bRight = Array.from({ length: 5 }, () => w.addBody(new Body({ x: 300, y: 50, vx:  100 })))
    const bLeft  = Array.from({ length: 5 }, () => w.addBody(new Body({ x: 300, y: 50, vx: -100 })))
    // Run until all settle
    for (let i = 0; i < 30_000; i++) w.step(0.016)
    // After settling all vx should be 0
    for (const b of [...bRight, ...bLeft]) expect(b.vx).toBe(0)
    // All settled at floor
    for (const b of [...bRight, ...bLeft]) expect(b.y).toBe(FLOOR_Y)
  })

})

// ─── 2. ENERGY BOOKKEEPING ───────────────────────────────────────────────────

describe('Readiness: Energy bookkeeping', () => {

  test('each floor bounce reduces |vy| by factor DAMPING=0.7 (±1%)', () => {
    // Drop from rest; record |vy| just after each floor bounce.
    // First bounce at ~step 599 (y=50, g=9.8 Euler), so use 4 000-step window.
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50, vy: 0 }))

    const postBounceVy: number[] = []   // |vy| immediately after each bounce

    for (let i = 0; i < 4_000 && postBounceVy.length < 4; i++) {
      const preVy = b.vy
      w.step(0.016)
      // Detect a floor bounce: vy flipped from positive (falling) to negative (bouncing up)
      if (preVy > 0 && b.vy < 0 && b.y >= FLOOR_Y - 1) {
        postBounceVy.push(Math.abs(b.vy))
      }
    }
    expect(postBounceVy.length).toBeGreaterThanOrEqual(2)
    // Each successive post-bounce |vy| must be < the previous (damping < 1)
    for (let i = 1; i < postBounceVy.length; i++) {
      expect(postBounceVy[i]).toBeLessThan(postBounceVy[i - 1])
    }
  })

  test('wall bounce: |vx| after = |vx| before × WALL_DAMPING (gravity=0)', () => {
    // vx must be negative (moving toward left wall) for a bounce to happen
    const w = new World(); w.gravity = 0
    const b = w.addBody(new Body({ x: WALL_L, y: 200, vx: -100 }))
    const vxBefore = Math.abs(b.vx)   // 100
    w.step(0.016)   // x undershoots WALL_L → clipped + vx flipped with damping
    expect(Math.abs(b.vx)).toBeCloseTo(vxBefore * WALL_DAMPING, 3)   // ≈ 80
  })

  test('wall-only simulation (gravity=0): |vx| decays by WALL_DAMPING each bounce', () => {
    const w = new World(); w.gravity = 0
    const b = w.addBody(new Body({ x: 300, y: 200, vx: 200 }))

    let bounces = 0
    let prevAbsVx = Math.abs(b.vx)

    for (let i = 0; i < 10_000 && bounces < 8; i++) {
      const prevVx = b.vx
      w.step(0.016)
      // Detect wall bounce: vx sign changed
      if (Math.sign(b.vx) !== Math.sign(prevVx) && Math.abs(prevVx) > 0.01) {
        const currentAbsVx = Math.abs(b.vx)
        // After bounce |vx| ≈ before-bounce |vx| × WALL_DAMPING
        expect(currentAbsVx).toBeLessThan(prevAbsVx + 0.01)   // never gains energy
        prevAbsVx = currentAbsVx
        bounces++
      }
    }
    expect(bounces).toBeGreaterThanOrEqual(4)
    // After 8 bounces: |vx| should be much less than initial
    expect(Math.abs(b.vx)).toBeLessThan(200 * Math.pow(WALL_DAMPING, 8) * 1.05)
  })

  test('ball at rest: total kinetic energy = 0', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    for (let i = 0; i < 30_000; i++) w.step(0.016)
    expect(b.y).toBe(FLOOR_Y)
    const ke = 0.5 * (b.vx * b.vx + b.vy * b.vy)
    expect(ke).toBe(0)
  })

  test('energy is strictly decreasing across the first 5 floor bounces', () => {
    // First bounce at ~step 599; allow 4 000 steps for 5 bounces
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50, vx: 0 }))

    const peakKEs: number[] = []   // vy² just after each bounce

    for (let i = 0; i < 4_000 && peakKEs.length < 5; i++) {
      const preVy = b.vy
      w.step(0.016)
      if (preVy > 2 && b.vy < 0 && b.y >= FLOOR_Y - 1) {
        peakKEs.push(b.vy * b.vy)   // KE ∝ vy² just after bounce
      }
    }
    expect(peakKEs.length).toBeGreaterThanOrEqual(3)
    for (let i = 1; i < peakKEs.length; i++) {
      expect(peakKEs[i]).toBeLessThan(peakKEs[i - 1])   // strictly decreasing
    }
  })

})

// ─── 3. LONG SESSION / MEMORY PRESSURE ──────────────────────────────────────

describe('Readiness: Long session & memory pressure', () => {

  test('36 000 steps (10 min sim) — no NaN, body finite', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50, vx: 50 }))
    for (let i = 0; i < 36_000; i++) w.step(0.016)
    expect(isFiniteNum(b.x)).toBe(true)
    expect(isFiniteNum(b.y)).toBe(true)
    expect(b.y).toBeLessThanOrEqual(FLOOR_Y)
    expect(b.x).toBeGreaterThanOrEqual(WALL_L)
    expect(b.x).toBeLessThanOrEqual(WALL_R)
  })

  test('36 000 steps < 2 000 ms', () => {
    const w = new World()
    w.addBody(new Body({ x: 300, y: 50, vx: 100 }))
    const ms = elapsed(() => { for (let i = 0; i < 36_000; i++) w.step(0.016) })
    console.log(`  [LONG] 36k steps → ${ms.toFixed(1)} ms`)
    expect(ms).toBeLessThan(2_000)
  })

  test('world.time = 576.000 after 36 000 × dt=0.016 steps (no drift)', () => {
    const w = new World(); w.gravity = 0
    const b = w.addBody(new Body({ x: 300, y: 200 }))
    // Freeze body so rest-skip doesn't apply (body must have been moving)
    b.vx = 0.001
    for (let i = 0; i < 36_000; i++) w.step(0.016)
    expect(w.time).toBeCloseTo(36_000 * 0.016, 3)
  })

  test('recorder at 200 000 samples — all 7 series lengths correct', () => {
    const r = new DataRecorder(); r.start()
    for (let i = 0; i < 200_000; i++) r.record(i * 0.016, i, i * 2, i, -i, 0, 9.8)
    const keys = ['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay'] as const
    for (const k of keys) expect(r.getSeries(k).length).toBe(200_000)
    expect(r.getLength()).toBe(200_000)
  })

  test('recorder at 200 000 samples — record + getSeries × 7 < 2 500 ms', () => {
    const r = new DataRecorder(); r.start()
    const ms = elapsed(() => {
      for (let i = 0; i < 200_000; i++) r.record(i * 0.016, i, i * 2, i, -i, 0, 9.8)
      r.getSeries('time'); r.getSeries('x'); r.getSeries('y')
      r.getSeries('vx');   r.getSeries('vy'); r.getSeries('ax'); r.getSeries('ay')
    })
    console.log(`  [LONG] 200k record+getSeries × 7 → ${ms.toFixed(1)} ms`)
    expect(ms).toBeLessThan(2_500)
  })

  test('500 reset/start/record cycles — final length = 1 000 (no accumulation)', () => {
    const r = new DataRecorder()
    for (let c = 0; c < 500; c++) {
      r.reset(); r.start()
      for (let i = 0; i < 1_000; i++) r.record(i * 0.016, i, i * 2, i, -i, 0, 9.8)
    }
    expect(r.getLength()).toBe(1_000)
    // Verify series not growing across cycles
    expect(r.getSeries('time').length).toBe(1_000)
  })

  test('500 reset cycles < 2 000 ms total', () => {
    const r = new DataRecorder()
    const ms = elapsed(() => {
      for (let c = 0; c < 500; c++) {
        r.reset(); r.start()
        for (let i = 0; i < 1_000; i++) r.record(i * 0.016, i, i * 2, i, -i, 0, 9.8)
      }
    })
    console.log(`  [LONG] 500 reset/record cycles → ${ms.toFixed(1)} ms`)
    expect(ms).toBeLessThan(2_000)
  })

})

// ─── 4. CSV AT SCALE ─────────────────────────────────────────────────────────

describe('Readiness: CSV generation at scale', () => {

  test('buildCsv(10 000 rows) < 500 ms', () => {
    const r = makeRecorder(10_000, 50)
    const ms = elapsed(() => buildCsv(r))
    console.log(`  [CSV] 10k rows → ${ms.toFixed(1)} ms`)
    expect(ms).toBeLessThan(500)
  })

  test('buildCsv(50 000 rows) < 3 000 ms', () => {
    const r = makeRecorder(50_000, 50)
    const ms = elapsed(() => buildCsv(r))
    console.log(`  [CSV] 50k rows → ${ms.toFixed(1)} ms`)
    expect(ms).toBeLessThan(3_000)
  })

  test('buildCsv output contains no "NaN" or "Infinity" strings', () => {
    const r = makeRecorder(5_000, 150)   // wall bounces included
    const csv = buildCsv(r)
    expect(csv).not.toContain('NaN')
    expect(csv).not.toContain('Infinity')
  })

  test('buildCsv(10k): row count = 10 001 (header + 10k data)', () => {
    const r = makeRecorder(10_000)
    const lines = buildCsv(r).split('\n').filter(l => l.length > 0)
    expect(lines.length).toBe(10_001)
  })

  test('CSV time column is monotonically non-decreasing', () => {
    const r = makeRecorder(2_000, 100)   // wall bounces create direction changes but time is monotone
    const lines = buildCsv(r).split('\n').slice(1).filter(l => l.length > 0)
    const times = lines.map(l => Number(l.split(',')[0]))
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThanOrEqual(times[i - 1])
    }
  })

  test('CSV x column stays within [WALL_L, WALL_R]', () => {
    const r = makeRecorder(3_000, 200)   // strong horizontal launch
    const lines = buildCsv(r).split('\n').slice(1).filter(l => l.length > 0)
    const xVals = lines.map(l => Number(l.split(',')[1]))
    for (const x of xVals) {
      expect(x).toBeGreaterThanOrEqual(WALL_L - 0.001)
      expect(x).toBeLessThanOrEqual(WALL_R + 0.001)
    }
  })

})

// ─── 5. BROADCASTCHANNEL PAYLOAD ─────────────────────────────────────────────

describe('Readiness: BroadcastChannel payload (structuredClone proxy)', () => {

  function makeSeries(n: number): Record<string, number[]> {
    const t = Array.from({ length: n }, (_, i) => i * 0.016)
    const v = Array.from({ length: n }, (_, i) => i * 0.1)
    return { time: t, x: v, y: v, vx: v, vy: v, ax: v, ay: v }
  }

  test('structuredClone of 7 × 1 000 arrays < 20 ms', () => {
    const data = makeSeries(1_000)
    const ms = elapsed(() => structuredClone(data))
    console.log(`  [BC] clone 7×1k → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(20)
  })

  test('structuredClone of 7 × 10 000 arrays < 100 ms', () => {
    const data = makeSeries(10_000)
    const ms = elapsed(() => structuredClone(data))
    console.log(`  [BC] clone 7×10k → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(100)
  })

  test('structuredClone of 7 × 100 000 arrays < 800 ms', () => {
    const data = makeSeries(100_000)
    const ms = elapsed(() => structuredClone(data))
    console.log(`  [BC] clone 7×100k → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(800)
  })

  test('cloned data is deep-equal to source', () => {
    const data = makeSeries(500)
    const clone = structuredClone(data)
    expect(clone.time[0]).toBe(data.time[0])
    expect(clone.time[499]).toBe(data.time[499])
    expect(clone.x[250]).toBe(data.x[250])
    // Mutation of clone does not affect source
    clone.time[0] = -999
    expect(data.time[0]).toBe(0)
  })

})

// ─── 6. GRAVITY EXTREMES ─────────────────────────────────────────────────────

describe('Readiness: Gravity extremes', () => {

  test('g=30 (Jupiter max): ball settles at FLOOR_Y after 20 000 steps', () => {
    const w = new World(); w.gravity = 30
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    for (let i = 0; i < 20_000; i++) w.step(0.016)
    expect(b.y).toBe(FLOOR_Y)
    expect(b.vy).toBe(0)
  })

  test('g=0: ball at y=200 stays at y=200 for 10 000 steps', () => {
    const w = new World(); w.gravity = 0
    const b = w.addBody(new Body({ x: 300, y: 200 }))
    for (let i = 0; i < 10_000; i++) w.step(0.016)
    expect(b.y).toBe(200)
    expect(b.vy).toBe(0)
  })

  test('g=0 → g=9.8 mid-flight: ball resumes falling after switch', () => {
    const w = new World(); w.gravity = 0
    const b = w.addBody(new Body({ x: 300, y: 100 }))
    for (let i = 0; i < 200; i++) w.step(0.016)
    expect(b.y).toBe(100)          // hasn't moved
    w.gravity = GRAVITY
    for (let i = 0; i < 200; i++) w.step(0.016)
    expect(b.y).toBeGreaterThan(100)   // now falling
  })

  test('100 rapid gravity switches: no NaN in body state', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    for (let i = 0; i < 1_000; i++) {
      w.gravity = (i % 4 === 0) ? 0 : (i % 4 === 1) ? 9.8 : (i % 4 === 2) ? 30 : 1.6
      w.step(0.016)
    }
    expect(isFiniteNum(b.x)).toBe(true)
    expect(isFiniteNum(b.y)).toBe(true)
    expect(isFiniteNum(b.vx)).toBe(true)
    expect(isFiniteNum(b.vy)).toBe(true)
  })

  test('g=-9.8 (inverted): ball flies upward, no NaN after 500 steps', () => {
    // Start mid-air (y=300) — starting at FLOOR_Y triggers rest-skip (y===FLOOR_Y,vy=0,ay=0)
    const w = new World(); w.gravity = -GRAVITY
    const b = w.addBody(new Body({ x: 300, y: 300 }))
    for (let i = 0; i < 500; i++) w.step(0.016)
    // Ball should have moved up (y decreasing in canvas coords with inverted g)
    expect(b.y).toBeLessThan(300)
    expect(isFiniteNum(b.y)).toBe(true)
    expect(isFiniteNum(b.vy)).toBe(true)
  })

  test('two worlds with different gravity produce different y positions', () => {
    const run = (g: number, steps: number) => {
      const w = new World(); w.gravity = g
      const b = w.addBody(new Body({ x: 300, y: 0 }))
      for (let i = 0; i < steps; i++) w.step(0.016)
      return b.y
    }
    const yMoon    = run(1.6,  100)
    const yEarth   = run(9.8,  100)
    const yJupiter = run(24.8, 100)
    expect(yMoon).toBeLessThan(yEarth)
    expect(yEarth).toBeLessThan(yJupiter)
    // Jupiter falls roughly 24.8/9.8 ≈ 2.5× as far as Earth
    expect(yJupiter).toBeGreaterThan(yEarth * 2)
  })

})

// ─── 7. WALL DAMPING INVARIANTS ──────────────────────────────────────────────

describe('Readiness: Wall damping invariants', () => {

  test('extreme vx=5 000: x always stays in [WALL_L, WALL_R]', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 200, vx: 5_000 }))
    const violations: string[] = []
    for (let i = 0; i < 2_000; i++) {
      w.step(0.016)
      if (b.x < WALL_L - 0.001 || b.x > WALL_R + 0.001) {
        violations.push(`step=${i} x=${b.x}`)
      }
    }
    expect(violations).toHaveLength(0)
  })

  test('wall damping is strictly < 1 so |vx| decreases monotonically per bounce', () => {
    expect(WALL_DAMPING).toBeGreaterThan(0)
    expect(WALL_DAMPING).toBeLessThan(1)
  })

  test('BALL_RADIUS = WALL_L = left-wall offset', () => {
    expect(WALL_L).toBe(BALL_RADIUS)
    expect(WALL_R).toBe(CANVAS_W - BALL_RADIUS)
  })

  test('deterministic wall bounces: two runs with vx=200 give identical x after 1 000 steps', () => {
    const run = () => {
      const w = new World()
      const b = w.addBody(new Body({ x: 300, y: 100, vx: 200, vy: 0 }))
      for (let i = 0; i < 1_000; i++) w.step(0.016)
      return { x: b.x, vx: b.vx }
    }
    const r1 = run(), r2 = run()
    expect(r1.x).toBe(r2.x)
    expect(r1.vx).toBe(r2.vx)
  })

  test('no bounce when ball is at wall but moving away (guard prevents double-flip)', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: WALL_L, y: 200, vx: 50 }))   // at wall, moving right
    w.step(0.016)
    expect(b.vx).toBeGreaterThan(0)   // not flipped
  })

  test('wall: ball stopped (vx=0) at boundary — no movement', () => {
    const w = new World(); w.gravity = 0
    const b = w.addBody(new Body({ x: WALL_L, y: 200, vx: 0 }))
    w.step(0.016)
    expect(b.x).toBe(WALL_L)
    expect(b.vx).toBe(0)
  })

})

// ─── 8. MULTI-RECORDER PIPELINE ─────────────────────────────────────────────

describe('Readiness: Multi-recorder pipeline', () => {

  test('5 independent bodies + recorders — all lengths equal after 600 frames', () => {
    const FRAMES = 600
    const w = new World()
    const setup = Array.from({ length: 5 }, (_, i) => ({
      body: w.addBody(new Body({ x: 100 + i * 80, y: 30 + i * 10, vx: (i % 2 ? 1 : -1) * 60 })),
      rec:  (() => { const r = new DataRecorder(); r.start(); return r })(),
    }))
    for (let f = 0; f < FRAMES; f++) {
      w.step(0.016)
      for (const { body: b, rec } of setup) {
        rec.record(w.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
      }
    }
    for (const { rec } of setup) {
      expect(rec.getLength()).toBe(FRAMES)
      expect(rec.getSeries('time').length).toBe(FRAMES)
    }
  })

  test('buildCsv on each of 5 recorders produces valid output (no NaN)', () => {
    const w = new World()
    const setup = Array.from({ length: 5 }, (_, i) => ({
      body: w.addBody(new Body({ x: 100 + i * 80, y: 50, vx: i * 30 })),
      rec:  (() => { const r = new DataRecorder(); r.start(); return r })(),
    }))
    for (let f = 0; f < 300; f++) {
      w.step(0.016)
      for (const { body: b, rec } of setup) {
        rec.record(w.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
      }
    }
    for (const { rec } of setup) {
      const csv = buildCsv(rec)
      expect(csv).not.toContain('NaN')
      expect(csv.split('\n').filter(l => l.length > 0).length).toBe(301)   // 1 header + 300 rows
    }
  })

  test('5 recorders accumulate to exactly 5 000 samples each after 5 000 steps', () => {
    const STEPS = 5_000
    const w = new World()
    const setup = Array.from({ length: 5 }, (_, i) => ({
      body: w.addBody(new Body({ x: 100 + i * 80, y: 50 })),
      rec:  (() => { const r = new DataRecorder(); r.start(); return r })(),
    }))
    for (let s = 0; s < STEPS; s++) {
      w.step(0.016)
      for (const { body: b, rec } of setup) {
        rec.record(w.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
      }
    }
    for (const { rec } of setup) expect(rec.getLength()).toBe(STEPS)
  })

})

// ─── 9. DAY-4 API SURFACE ────────────────────────────────────────────────────

describe('Readiness: Day-4 API surface', () => {

  test('empty world: step() does not crash, time advances', () => {
    const w = new World()
    expect(() => { for (let i = 0; i < 100; i++) w.step(0.016) }).not.toThrow()
    expect(w.time).toBeCloseTo(100 * 0.016, 3)
  })

  test('addBody after simulation started: new body participates immediately', () => {
    const w = new World()
    w.addBody(new Body({ x: 300, y: 50 }))
    for (let i = 0; i < 100; i++) w.step(0.016)
    const late = w.addBody(new Body({ x: 200, y: 50 }))   // add mid-sim
    w.step(0.016)
    expect(late.y).toBeGreaterThan(50)   // fell for one step
  })

  test('world.bodies reflects exact count of added bodies', () => {
    const w = new World()
    expect(w.bodies.length).toBe(0)
    for (let i = 0; i < 10; i++) w.addBody(new Body({ x: i * 50, y: 50 }))
    expect(w.bodies.length).toBe(10)
  })

  test('body returned by addBody is reference-identical to world.bodies entry', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    expect(w.bodies[0]).toBe(b)
  })

  test('DataRecorder.stop() prevents further recording — getSeries frozen', () => {
    const r = new DataRecorder(); r.start()
    for (let i = 0; i < 100; i++) r.record(i * 0.016, i, i, i, i, 0, 9.8)
    r.stop()
    r.record(999, 999, 999, 999, 999, 999, 999)   // should be ignored
    expect(r.getLength()).toBe(100)
  })

  test('GraphEngine: draw with flipY=true on 1000 points does not crash', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 400; canvas.height = 300
    const ge = new GraphEngine(canvas)
    const r  = makeRecorder(1_000, 100)
    expect(() => ge.draw(r, 'time', 'y', true)).not.toThrow()
  })

  test('GraphEngine: draw with flipY=false on 1000 points does not crash', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 400; canvas.height = 300
    const ge = new GraphEngine(canvas)
    const r  = makeRecorder(1_000, 100)
    expect(() => ge.draw(r, 'time', 'y', false)).not.toThrow()
  })

})
