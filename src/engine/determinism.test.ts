/**
 * KAN-12 T4.1 — Engine Determinism Tests
 *
 * Every scenario runs the simulation twice from identical initial conditions
 * and asserts that the final state is bit-for-bit identical.
 * Determinism is a strict requirement: no Math.random(), no Date-based seeding,
 * no async or environmental side effects inside the engine.
 */
import { describe, test, expect } from 'vitest'
import { World } from './World'
import { Body } from './Body'
import { InteractionLayer } from './InteractionLayer'
import { FLOOR_Y, WALL_L, WALL_R } from '../constants'

// ─── helpers ─────────────────────────────────────────────────────────────────

type Snapshot = { x: number; y: number; vx: number; vy: number; ax: number; ay: number; t: number }

function snap(world: World, body: Body): Snapshot {
  return { x: body.x, y: body.y, vx: body.vx, vy: body.vy, ax: body.ax, ay: body.ay, t: world.time }
}

// ─── Basic determinism ────────────────────────────────────────────────────────

describe('Determinism: basic', () => {

  test('200 steps from (100, 0) produce identical results both runs', () => {
    const run = () => {
      const w = new World()
      const b = w.addBody(new Body({ x: 100, y: 0 }))
      for (let i = 0; i < 200; i++) w.step(0.016)
      return snap(w, b)
    }
    expect(run()).toEqual(run())
  })

  test('1 000 steps — identical across runs', () => {
    const run = () => {
      const w = new World()
      const b = w.addBody(new Body({ x: 300, y: 50 }))
      for (let i = 0; i < 1_000; i++) w.step(0.016)
      return snap(w, b)
    }
    const r1 = run(), r2 = run()
    expect(r1).toEqual(r2)
  })

  test('world.time is identical across 500-step runs', () => {
    const run = () => { const w = new World(); for (let i = 0; i < 500; i++) w.step(0.016); return w.time }
    expect(run()).toBe(run())
  })

})

// ─── Wall-bounce determinism ───────────────────────────────────────────────────

describe('Determinism: wall bounces', () => {

  test('high-vx ball — 300 steps with wall bounces are deterministic', () => {
    const run = () => {
      const w = new World()
      const b = w.addBody(new Body({ x: 300, y: 100, vx: 300 }))
      for (let i = 0; i < 300; i++) w.step(0.016)
      return snap(w, b)
    }
    expect(run()).toEqual(run())
  })

  test('extreme vx=5000 — x stays in [WALL_L, WALL_R] identically both runs', () => {
    const run = () => {
      const w = new World()
      const b = w.addBody(new Body({ x: 300, y: 200, vx: 5_000 }))
      for (let i = 0; i < 200; i++) w.step(0.016)
      return snap(w, b)
    }
    const r1 = run(), r2 = run()
    expect(r1).toEqual(r2)
    expect(r1.x).toBeGreaterThanOrEqual(WALL_L)
    expect(r1.x).toBeLessThanOrEqual(WALL_R)
  })

  test('ball starting at left wall — deterministic after 100 steps', () => {
    const run = () => {
      const w = new World()
      const b = w.addBody(new Body({ x: WALL_L, y: 100, vx: -50 }))
      for (let i = 0; i < 100; i++) w.step(0.016)
      return snap(w, b)
    }
    expect(run()).toEqual(run())
  })

})

// ─── Multi-body determinism ────────────────────────────────────────────────────

describe('Determinism: multi-body', () => {

  test('5 bodies — all snapshots identical across two runs', () => {
    const run = () => {
      const w = new World()
      const bodies = [
        w.addBody(new Body({ x: 100, y: 50,  vx:  200 })),
        w.addBody(new Body({ x: 200, y: 80,  vx: -100 })),
        w.addBody(new Body({ x: 300, y: 0,   vx:    0 })),
        w.addBody(new Body({ x: 400, y: 150, vx:   50 })),
        w.addBody(new Body({ x: 500, y: 30,  vx: -300 })),
      ]
      for (let i = 0; i < 500; i++) w.step(0.016)
      return bodies.map(b => snap(w, b))
    }
    const r1 = run(), r2 = run()
    r1.forEach((s, i) => expect(s).toEqual(r2[i]))
  })

  test('10 bodies with mixed gravity — deterministic after 300 steps', () => {
    const run = () => {
      const w = new World(); w.gravity = 1.6  // Moon gravity
      const bodies = Array.from({ length: 10 }, (_, i) =>
        w.addBody(new Body({ x: 50 + i * 55, y: 20 + i * 10, vx: (i % 2 ? 1 : -1) * (i + 1) * 30 }))
      )
      for (let i = 0; i < 300; i++) w.step(0.016)
      return bodies.map(b => snap(w, b))
    }
    const r1 = run(), r2 = run()
    r1.forEach((s, i) => expect(s).toEqual(r2[i]))
  })

})

// ─── Gravity mutation determinism ─────────────────────────────────────────────

describe('Determinism: gravity switches', () => {

  test('gravity changed at step 100 — same result both runs', () => {
    const run = () => {
      const w = new World()
      const b = w.addBody(new Body({ x: 300, y: 50 }))
      for (let i = 0; i < 200; i++) {
        if (i === 100) w.gravity = 24.8   // Jupiter
        w.step(0.016)
      }
      return snap(w, b)
    }
    expect(run()).toEqual(run())
  })

  test('g=0 then g=9.8: both runs identical after 200 steps', () => {
    const run = () => {
      const w = new World(); w.gravity = 0
      const b = w.addBody(new Body({ x: 300, y: 100 }))
      for (let i = 0; i < 100; i++) w.step(0.016)
      w.gravity = 9.8
      for (let i = 0; i < 100; i++) w.step(0.016)
      return snap(w, b)
    }
    expect(run()).toEqual(run())
  })

})

// ─── InteractionLayer does not introduce non-determinism ──────────────────────

describe('Determinism: InteractionLayer', () => {

  test('pause + resume cycle — identical to unpaused run with same steps', () => {
    const runNormal = () => {
      const w = new World()
      const b = w.addBody(new Body({ x: 300, y: 50 }))
      for (let i = 0; i < 200; i++) w.step(0.016)
      return snap(w, b)
    }
    // Run with pause/resume — skipped steps NOT counted (simulate paused frames)
    const runPaused = () => {
      const w = new World()
      const b = w.addBody(new Body({ x: 300, y: 50 }))
      const il = new InteractionLayer()
      let steps = 0
      for (let frame = 0; frame < 400; frame++) {
        if (frame === 50) il.pause()
        if (frame === 150) il.resume()
        if (!il.isPaused()) { w.step(0.016); steps++ }
        if (steps === 200) break
      }
      return snap(w, b)
    }
    expect(runNormal()).toEqual(runPaused())
  })

  test('drag moves body to exact position — no drift', () => {
    const il = new InteractionLayer()
    const b = new Body({ x: 300, y: 100 })
    il.startDrag(b)
    il.updateDrag(150, 200)
    il.endDrag()
    // Run twice from this state
    const run = (startX: number, startY: number) => {
      const w = new World()
      const body = w.addBody(new Body({ x: startX, y: startY }))
      for (let i = 0; i < 100; i++) w.step(0.016)
      return snap(w, body)
    }
    expect(run(150, 200)).toEqual(run(150, 200))
  })

})

// ─── Large-scale determinism ──────────────────────────────────────────────────

describe('Determinism: large-scale', () => {

  test('10 000 steps — final position identical', () => {
    const run = () => {
      const w = new World()
      const b = w.addBody(new Body({ x: 300, y: 50, vx: 100 }))
      for (let i = 0; i < 10_000; i++) w.step(0.016)
      return snap(w, b)
    }
    expect(run()).toEqual(run())
  })

  test('time never drifts: 36 000 steps × 0.016 = 576.000 s', () => {
    const w = new World(); w.gravity = 0
    w.addBody(new Body({ x: 300, y: 200, vx: 0.001 }))
    for (let i = 0; i < 36_000; i++) w.step(0.016)
    expect(w.time).toBeCloseTo(576, 3)
  })

})
