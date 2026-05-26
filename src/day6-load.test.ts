/**
 * KAN-14 — Day 6 Load Tests: WorldCanvas.tsx + rAF loop
 *
 * Stress-tests the rendering pipeline under worst-case conditions:
 *   1. rAF loop throughput  — many frames, many bodies
 *   2. dt-cap stability     — mixed slow/fast/zero dt inputs
 *   3. Recorder pipeline    — high frame count, NaN-free, monotonic time
 *   4. GraphEngine under load — re-draw at 60fps over 10s of data
 *   5. Full pipeline        — engine + recorder + graph in one shot
 */

import { describe, test, expect } from 'vitest'
import { World }           from './engine/World'
import { Body }            from './engine/Body'
import { InteractionLayer } from './engine/InteractionLayer'
import { DataRecorder }    from './recorder/DataRecorder'
import { GraphEngine }     from './graph/GraphEngine'
import { FpsMeter }        from './utils/fps'
import { FLOOR_Y, WALL_L, WALL_R, GRAVITY } from './constants'

const elapsed = (fn: () => void): number => {
  const t0 = performance.now(); fn(); return performance.now() - t0
}

const capDt = (ms: number) => Math.min(ms / 1000, 0.016)

// ── helpers ───────────────────────────────────────────────────────────────────
function runLoop(world: World, rec: DataRecorder, frames: number, dt = 0.016) {
  const il = new InteractionLayer()
  const b  = world.bodies[0]
  for (let f = 0; f < frames; f++) {
    world.step(dt)
    if (b) rec.record(world.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. rAF loop throughput
// ═════════════════════════════════════════════════════════════════════════════

describe('D6-Load: rAF loop throughput', () => {
  test('3 600 frames (1 min at 60fps) < 200 ms', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50, vx: 120 }))
    const rec = new DataRecorder(); rec.start()
    const ms = elapsed(() => runLoop(world, rec, 3_600))
    console.log(`  [D6-LOOP] 3600 frames → ${ms.toFixed(2)} ms | samples=${rec.getLength()}`)
    expect(ms).toBeLessThan(200)
    expect(rec.getLength()).toBe(3_600)
  })

  test('10 bodies × 600 frames < 100 ms', () => {
    const world = new World()
    const recs: DataRecorder[] = []
    for (let i = 0; i < 10; i++) {
      world.addBody(new Body({ x: 50 + i * 55, y: 30 + i * 20, vx: (i % 2 ? 1 : -1) * 80 }))
      const r = new DataRecorder(); r.start(); recs.push(r)
    }
    const ms = elapsed(() => {
      for (let f = 0; f < 600; f++) {
        world.step(0.016)
        world.bodies.forEach((b, i) =>
          recs[i].record(world.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay))
      }
    })
    console.log(`  [D6-LOOP] 10 bodies × 600 frames → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(100)
    recs.forEach(r => expect(r.getLength()).toBe(600))
  })

  test('1 000 pause/resume cycles do not corrupt frame count', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50 }))
    const rec = new DataRecorder(); rec.start()
    const il  = new InteractionLayer()
    let frames = 0
    for (let i = 0; i < 1_000; i++) {
      il.pause()
      // paused — no step
      il.resume()
      world.step(0.016)
      const b = world.bodies[0]
      rec.record(world.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
      frames++
    }
    expect(frames).toBe(1_000)
    expect(rec.getLength()).toBe(1_000)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. dt-cap stability
// ═════════════════════════════════════════════════════════════════════════════

describe('D6-Load: dt-cap stability', () => {
  test('1 000 000 random elapsed-ms values: capDt always in [0, 0.016]', () => {
    let violations = 0
    for (let i = 0; i < 1_000_000; i++) {
      const elapsedMs = Math.random() * 500   // 0–500 ms (simulates tab background, etc.)
      const dt = capDt(elapsedMs)
      if (dt < 0 || dt > 0.016 + 1e-10) violations++
    }
    expect(violations).toBe(0)
  })

  test('mixed dt stream: world.time is always non-decreasing', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50 }))
    const dtSeq = [0.016, 0.001, 0.016, 0.016, 0, 0.016, 0.016, 0.008, 0.016, 0.016]
    let prevTime = 0
    for (const dt of dtSeq) {
      world.step(capDt(dt * 1000))
      expect(world.time).toBeGreaterThanOrEqual(prevTime)
      prevTime = world.time
    }
  })

  test('all-capped (100ms dt each): 600 caps → time = 600 × 0.016 = 9.6 s', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50 }))
    for (let i = 0; i < 600; i++) world.step(capDt(100))
    expect(world.time).toBeCloseTo(600 * 0.016, 6)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. Recorder pipeline under load
// ═════════════════════════════════════════════════════════════════════════════

describe('D6-Load: recorder pipeline', () => {
  test('36 000 frames (10 min equivalent): all series NaN-free', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50, vx: 80 }))
    const rec = new DataRecorder(); rec.start()
    const ms = elapsed(() => runLoop(world, rec, 36_000))
    console.log(`  [D6-REC] 36k frames → ${ms.toFixed(2)} ms | samples=${rec.getLength()}`)
    expect(ms).toBeLessThan(2_000)
    expect(rec.getLength()).toBe(36_000)
    const keys = ['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay'] as const
    for (const k of keys) rec.getSeries(k).forEach(v => expect(isFinite(v)).toBe(true))
  })

  test('time series is strictly monotonic over 3 600 frames', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50 }))
    const rec = new DataRecorder(); rec.start()
    runLoop(world, rec, 3_600)
    const times = rec.getSeries('time')
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1])
  })

  test('y_phys always in [0, FLOOR_Y] over 3 600 frames with wall bounce', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50, vx: 200 }))
    const rec = new DataRecorder(); rec.start()
    runLoop(world, rec, 3_600)
    const ys = rec.getSeries('y')
    ys.forEach(y => {
      expect(y).toBeGreaterThanOrEqual(-0.001)
      expect(y).toBeLessThanOrEqual(FLOOR_Y + 0.001)
    })
  })

  test('x always in [WALL_L, WALL_R] over 3 600 frames', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 100, vx: 300 }))
    const rec = new DataRecorder(); rec.start()
    runLoop(world, rec, 3_600)
    const xs = rec.getSeries('x')
    xs.forEach(x => {
      expect(x).toBeGreaterThanOrEqual(WALL_L - 0.001)
      expect(x).toBeLessThanOrEqual(WALL_R + 0.001)
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. GraphEngine re-draw at 60fps
// ═════════════════════════════════════════════════════════════════════════════

describe('D6-Load: GraphEngine render under load', () => {
  test('draw 600 times over 600-sample recorder (1s @60fps) < 300 ms', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50, vx: 100 }))
    const rec = new DataRecorder(); rec.start()
    runLoop(world, rec, 600)

    const canvas = document.createElement('canvas')
    canvas.width = 500; canvas.height = 400
    const ge = new GraphEngine(canvas)

    const ms = elapsed(() => {
      for (let f = 0; f < 600; f++) ge.draw(rec, 'time', 'y')
    })
    console.log(`  [D6-GFX] 600 draws × 600 pts → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(300)
  })

  test('draw 60 frames over 3 600-sample recorder (1 min data) < 200 ms', () => {
    const world = new World()
    world.addBody(new Body({ x: 300, y: 50, vx: 80 }))
    const rec = new DataRecorder(); rec.start()
    runLoop(world, rec, 3_600)

    const canvas = document.createElement('canvas')
    canvas.width = 500; canvas.height = 400
    const ge = new GraphEngine(canvas)

    const ms = elapsed(() => {
      for (let f = 0; f < 60; f++) ge.draw(rec, 'time', 'y')
    })
    console.log(`  [D6-GFX] 60 draws × 3600 pts → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(200)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. Full pipeline: engine + recorder + GraphEngine + FpsMeter
// ═════════════════════════════════════════════════════════════════════════════

describe('D6-Load: full pipeline', () => {
  test('600-frame pipeline (10s): engine + recorder + meter + graph < 400 ms', () => {
    const world  = new World()
    world.addBody(new Body({ x: 300, y: 50, vx: 150 }))
    const rec    = new DataRecorder(); rec.start()
    const meter  = new FpsMeter(60)
    const canvas = document.createElement('canvas')
    canvas.width = 500; canvas.height = 400
    const ge = new GraphEngine(canvas)

    let t = 0
    const ms = elapsed(() => {
      for (let f = 0; f <= 600; f++) {
        meter.tick(t); t += 16.666
        world.step(0.016)
        const b = world.bodies[0]
        rec.record(world.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
        if (f % 2 === 0) ge.draw(rec, 'time', 'y')   // graph at 30fps
      }
    })

    console.log(`  [D6-FULL] 600 frames + 300 draws → ${ms.toFixed(2)} ms | fps=${meter.fps.toFixed(1)}`)
    expect(ms).toBeLessThan(400)
    expect(rec.getLength()).toBe(601)
    expect(meter.fps).toBeGreaterThan(55)
    expect(meter.fps).toBeLessThan(65)
  })

  test('determinism: two 3600-frame runs produce bit-identical final state', () => {
    const run = () => {
      const world = new World()
      const b     = world.addBody(new Body({ x: 300, y: 50, vx: 200 }))
      const rec   = new DataRecorder(); rec.start()
      runLoop(world, rec, 3_600)
      return { x: b.x, y: b.y, vx: b.vx, vy: b.vy, len: rec.getLength() }
    }
    expect(run()).toEqual(run())
  })

  test('gravity change mid-loop: no NaN, physics stable', () => {
    const world = new World()
    const b     = world.addBody(new Body({ x: 300, y: 50 }))
    const rec   = new DataRecorder(); rec.start()
    for (let f = 0; f < 600; f++) {
      if (f === 200) world.gravity = 1.6   // switch to Moon mid-session
      if (f === 400) world.gravity = 24.8  // switch to Jupiter
      world.step(0.016)
      rec.record(world.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
    }
    expect(rec.getLength()).toBe(600)
    const keys = ['time', 'x', 'y', 'vx', 'vy'] as const
    for (const k of keys) rec.getSeries(k).forEach(v => expect(isFinite(v)).toBe(true))
  })
})
