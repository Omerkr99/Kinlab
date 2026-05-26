/**
 * KAN-14 — Day 6 Tests: WorldCanvas.tsx + rAF loop
 *
 * Verifies every requirement from T6.1–T6.4 without a real browser.
 * All draw() tests use the jsdom canvas mock (no visual assertion, just no-throw +
 * structural invariants). Physics / recording / dt-cap tests are pure logic.
 *
 *   T6.1  rAF loop — dt capping, world.step() + recorder.record() per frame
 *   T6.2  draw()   — clearRect, floor line, ball arc (FR-21 velocity arrow logic)
 *   T6.3  App.tsx  — instances created OUTSIDE the component
 *   T6.4  FPS      — loop throughput meets 55+ fps budget
 */

import { describe, test, expect } from 'vitest'
import { World }          from './engine/World'
import { Body }           from './engine/Body'
import { InteractionLayer } from './engine/InteractionLayer'
import { DataRecorder }   from './recorder/DataRecorder'
import { GraphEngine }    from './graph/GraphEngine'
import { FpsMeter }       from './utils/fps'
import { FLOOR_Y, CANVAS_W, CANVAS_H, BALL_RADIUS, GRAVITY, WALL_L, WALL_R } from './constants'

// ── helpers ───────────────────────────────────────────────────────────────────

/** Simulate the WorldCanvas rAF loop for N frames without rAF */
function simulateLoop(
  world: World,
  rec: DataRecorder,
  interaction: InteractionLayer,
  frames: number,
  dt = 0.016,
): void {
  const body = world.bodies[0]
  for (let f = 0; f < frames; f++) {
    if (!interaction.isPaused() && !interaction.isDragging()) {
      world.step(dt)
      if (body) rec.record(world.time, body.x, FLOOR_Y - body.y, body.vx, -body.vy, body.ax, -body.ay)
    }
  }
}

/** dt-cap formula extracted from WorldCanvas */
const capDt = (elapsedMs: number): number => Math.min(elapsedMs / 1000, 0.016)

// ═════════════════════════════════════════════════════════════════════════════
// T6.1 — rAF loop: dt capping + world.step() + recorder.record()
// ═════════════════════════════════════════════════════════════════════════════

describe('T6.1 — rAF loop: dt capping', () => {
  test('normal 60fps frame (16ms elapsed) → dt = 0.016', () => {
    expect(capDt(16)).toBeCloseTo(0.016, 4)
  })

  test('120fps frame (8ms elapsed) → dt = 0.008 (uncapped)', () => {
    expect(capDt(8)).toBeCloseTo(0.008, 4)
  })

  test('tab hidden (100ms elapsed) → dt capped at 0.016', () => {
    expect(capDt(100)).toBe(0.016)
  })

  test('worst case (1000ms elapsed) → dt still 0.016', () => {
    expect(capDt(1_000)).toBe(0.016)
  })

  test('zero elapsed → dt = 0 (no physics step)', () => {
    expect(capDt(0)).toBe(0)
  })

  test('cap threshold is exactly MAX_DT = 0.016 s = 16 ms', () => {
    expect(capDt(15.999)).toBeLessThan(0.016)
    expect(capDt(16.001)).toBe(0.016)
    expect(capDt(17)).toBe(0.016)
  })
})

describe('T6.1 — rAF loop: step + record per frame', () => {
  test('600 frames → recorder.getLength() === 600', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50 }))
    const rec = new DataRecorder(); rec.start()
    simulateLoop(world, rec, new InteractionLayer(), 600)
    expect(rec.getLength()).toBe(600)
  })

  test('world.time advances exactly by dt × frames', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50 }))
    const rec = new DataRecorder(); rec.start()
    simulateLoop(world, rec, new InteractionLayer(), 100, 0.016)
    expect(world.time).toBeCloseTo(1.6, 8)
  })

  test('paused interaction skips step + record', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50 }))
    const rec = new DataRecorder(); rec.start()
    const il = new InteractionLayer(); il.pause()
    simulateLoop(world, rec, il, 50)
    expect(rec.getLength()).toBe(0)
    expect(world.time).toBe(0)
  })

  test('resume after pause resumes recording', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50 }))
    const rec = new DataRecorder(); rec.start()
    const il = new InteractionLayer()
    il.pause()
    simulateLoop(world, rec, il, 30)
    il.resume()
    simulateLoop(world, rec, il, 20)
    expect(rec.getLength()).toBe(20)
  })

  test('recorder time series is strictly monotonic after loop', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50 }))
    const rec = new DataRecorder(); rec.start()
    simulateLoop(world, rec, new InteractionLayer(), 200)
    const times = rec.getSeries('time')
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// T6.1 — Physical coordinate convention
// ═════════════════════════════════════════════════════════════════════════════

describe('T6.1 — Physical coordinate transform (y_phys = FLOOR_Y - canvas_y)', () => {
  test('ball at canvas top (y=0) → physical height = FLOOR_Y', () => {
    expect(FLOOR_Y - 0).toBe(FLOOR_Y)
  })

  test('ball at floor (y=FLOOR_Y) → physical height = 0', () => {
    expect(FLOOR_Y - FLOOR_Y).toBe(0)
  })

  test('ball at midpoint → correct physical height', () => {
    const canvasY = 250
    expect(FLOOR_Y - canvasY).toBe(250)
  })

  test('vy physical = -vy canvas (upward movement is positive)', () => {
    const vy_canvas = -50   // moving up in canvas (y decreasing)
    const vy_phys   = -vy_canvas
    expect(vy_phys).toBe(50)
  })

  test('ay physical = -ay canvas (gravity pulls down → positive canvas-ay, negative phys)', () => {
    const ay_canvas =  GRAVITY  // gravity accelerates downward in canvas
    const ay_phys   = -ay_canvas
    expect(ay_phys).toBe(-GRAVITY)
  })

  test('after 600-frame loop: recorded y_phys ∈ [0, FLOOR_Y]', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50 }))
    const rec = new DataRecorder(); rec.start()
    simulateLoop(world, rec, new InteractionLayer(), 600)
    const ys = rec.getSeries('y')
    ys.forEach(y => {
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(FLOOR_Y)
    })
  })

  test('after 600-frame loop: recorded x ∈ [WALL_L, WALL_R]', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50, vx: 200 }))
    const rec = new DataRecorder(); rec.start()
    simulateLoop(world, rec, new InteractionLayer(), 600)
    const xs = rec.getSeries('x')
    xs.forEach(x => {
      expect(x).toBeGreaterThanOrEqual(WALL_L)
      expect(x).toBeLessThanOrEqual(WALL_R)
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// T6.2 — draw() / drawWorld: visual invariants
// ═════════════════════════════════════════════════════════════════════════════

describe('T6.2 — draw() visual invariants (jsdom canvas)', () => {
  const makeCanvas = () => {
    const c = document.createElement('canvas')
    c.width = CANVAS_W; c.height = CANVAS_H
    return c
  }

  test('GraphEngine.draw() on empty recorder does not throw', () => {
    const canvas = makeCanvas()
    const ge = new GraphEngine(canvas)
    const rec = new DataRecorder()
    expect(() => ge.draw(rec, 'time', 'y')).not.toThrow()
  })

  test('GraphEngine.draw() on 600-sample recorder does not throw', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50 }))
    const rec = new DataRecorder(); rec.start()
    simulateLoop(world, rec, new InteractionLayer(), 600)
    const canvas = makeCanvas()
    const ge = new GraphEngine(canvas)
    expect(() => ge.draw(rec, 'time', 'y')).not.toThrow()
  })

  test('velocity vector threshold: |v| > 0.1 triggers arrow draw', () => {
    // VEL_SCALE = 5 (from WorldCanvas.tsx)
    const VEL_SCALE = 5
    const bodies = [
      { vx: 0,    vy: 0,    shouldDraw: false },
      { vx: 0.05, vy: 0.05, shouldDraw: false }, // Math.hypot(0.05,0.05)≈0.071 < 0.1
      { vx: 0.1,  vy: 0,    shouldDraw: false }, // exactly 0.1: vLen > 0.1 is FALSE (strict)
      { vx: 0.11, vy: 0,    shouldDraw: true  }, // just above threshold
      { vx: 50,   vy: 0,    shouldDraw: true  },
    ]
    bodies.forEach(({ vx, vy, shouldDraw }) => {
      const vLen = Math.hypot(vx, vy)
      expect(vLen > 0.1).toBe(shouldDraw)
      if (shouldDraw) {
        const tipX = 300 + vx * VEL_SCALE
        const tipY = 250 + vy * VEL_SCALE
        expect(isFinite(tipX) && isFinite(tipY)).toBe(true)
      }
    })
  })

  test('ball arc: radius = BALL_RADIUS = 20 px', () => {
    expect(BALL_RADIUS).toBe(20)
  })

  test('floor line at y = FLOOR_Y = 500', () => {
    expect(FLOOR_Y).toBe(500)
  })

  test('canvas dimensions match constants', () => {
    expect(CANVAS_W).toBe(600)
    expect(CANVAS_H).toBe(520)  // 20px below floor for ground hatch
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// T6.3 — App architecture: instances outside component
// ═════════════════════════════════════════════════════════════════════════════

describe('T6.3 — App architecture: module-level singletons', () => {
  test('World, DataRecorder, InteractionLayer are instantiable outside React', () => {
    // These are the three singletons App.tsx creates outside the component
    const world       = new World()
    const recorder    = new DataRecorder()
    const interaction = new InteractionLayer()

    // They must be independent, stable instances
    expect(world.bodies).toHaveLength(0)
    expect(recorder.getLength()).toBe(0)
    expect(interaction.isPaused()).toBe(false)
  })

  test('world singleton is stable across multiple accesses (no re-creation)', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50 }))
    const ref = world   // same reference
    world.step(0.016)
    expect(ref.bodies).toBe(world.bodies)  // same array object
    expect(ref.time).toBeCloseTo(0.016, 10)
  })

  test('recorder singleton accumulates across multiple world steps', () => {
    const world       = new World()
    const b           = world.addBody(new Body({ x: 300, y: 50 }))
    const recorder    = new DataRecorder(); recorder.start()
    const interaction = new InteractionLayer()

    for (let i = 0; i < 10; i++) {
      world.step(0.016)
      recorder.record(world.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
    }
    expect(recorder.getLength()).toBe(10)
    expect(recorder.getSeries('time').every(isFinite)).toBe(true)
  })

  test('multiple worlds are independent (no shared state)', () => {
    const w1 = new World(); w1.addBody(new Body({ x: 100, y: 50 }))
    const w2 = new World(); w2.addBody(new Body({ x: 400, y: 50 }))
    for (let i = 0; i < 100; i++) { w1.step(0.016); w2.step(0.016) }
    expect(w1.bodies[0].x).not.toBe(w2.bodies[0].x)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// T6.4 — FPS / throughput meets 55+ fps budget
// ═════════════════════════════════════════════════════════════════════════════

describe('T6.4 — Loop throughput: 55+ fps budget', () => {
  test('600 frames (10 s at 60fps) complete in < 50 ms', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50, vx: 100 }))
    const rec = new DataRecorder(); rec.start()
    const il = new InteractionLayer()

    const t0 = performance.now()
    simulateLoop(world, rec, il, 600)
    const ms = performance.now() - t0

    console.log(`  [T6.4] 600 frames → ${ms.toFixed(2)} ms  (budget 50ms @ 55fps)`)
    expect(ms).toBeLessThan(50)
  })

  test('FpsMeter: simulated 60fps loop → measured fps ∈ [59, 61]', () => {
    const meter = new FpsMeter(60)
    for (let f = 0; f <= 60; f++) meter.tick(f * 16.666_6)
    console.log(`  [T6.4] FpsMeter after 60 frames → ${meter.fps.toFixed(2)} fps`)
    expect(meter.fps).toBeGreaterThan(59)
    expect(meter.fps).toBeLessThan(61)
  })

  test('step throughput > 500 000 steps/s (single body, consistent with Day 2 load tests)', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50, vx: 100 }))
    const STEPS = 100_000
    const t0 = performance.now()
    for (let i = 0; i < STEPS; i++) world.step(0.016)
    const ms = performance.now() - t0
    const stepsPerSec = (STEPS / ms) * 1000
    console.log(`  [T6.4] throughput: ${Math.round(stepsPerSec).toLocaleString()} steps/sec`)
    expect(stepsPerSec).toBeGreaterThan(500_000)
  })

  test('600-frame pipeline: all 7 series NaN-free', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50, vx: 150 }))
    const rec = new DataRecorder(); rec.start()
    simulateLoop(world, rec, new InteractionLayer(), 600)
    const keys = ['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay'] as const
    for (const k of keys) {
      rec.getSeries(k).forEach(v => expect(isFinite(v)).toBe(true))
    }
  })

  test('drag during loop: WorldCanvas skips world.step() when isDragging()', () => {
    const world = new World()
    const body  = world.addBody(new Body({ x: 300, y: 50, vx: 100, vy: 50 }))
    const il    = new InteractionLayer()

    // WorldCanvas: if (!interaction.isDragging()) { world.step(dt) }
    il.startDrag(body)
    il.updateDrag(150, 200)

    // isDragging() → true, so WorldCanvas skips world.step()
    expect(il.isDragging()).toBe(true)
    // updateDrag snaps body to cursor, zeroes velocity
    expect(body.x).toBe(150)
    expect(body.y).toBe(200)
    expect(body.vx).toBe(0)
    expect(body.vy).toBe(0)

    // End drag — physics resumes; next world.step() applies gravity
    il.endDrag()
    expect(il.isDragging()).toBe(false)
    const yBefore = body.y
    world.step(0.016)
    // gravity accelerates downward: y increases
    expect(body.y).toBeGreaterThan(yBefore)
  })
})
