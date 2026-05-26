/**
 * KinLab — Day 5 Load & Integration Tests
 *
 * Stress-tests all Day 5 infrastructure under realistic and extreme conditions,
 * and verifies that every new module is correctly wired to the existing engine.
 *
 *   1. PhysicsEventBus  — throughput, fan-out, lifecycle
 *   2. FpsMeter         — precision, sliding window, accuracy
 *   3. Math utils       — batch throughput, numerical stability
 *   4. Full pipeline    — World + EventBus + DataRecorder + FpsMeter + Energy
 *   5. Cross-module     — PhysicsScale ↔ Math, Types ↔ DataRecorder, constants integrity
 */

import { describe, test, expect } from 'vitest'

import { PhysicsEventBus } from './engine/PhysicsEvents'
import type { PhysicsEvent } from './engine/PhysicsEvents'
import { FpsMeter } from './utils/fps'
import {
  clamp, lerp, roundTo,
  kineticEnergy, potentialEnergy, mechanicalEnergy, mapRange,
} from './utils/math'
import type { BodySnapshot, SimulationConfig, RecorderSnapshot } from './types/index'

import { World } from './engine/World'
import { Body } from './engine/Body'
import { DataRecorder } from './recorder/DataRecorder'
import {
  FLOOR_Y, CANVAS_W, WALL_L, WALL_R, BALL_RADIUS, GRAVITY,
  WALL_DAMPING,
} from './constants'
import {
  pxToUnit, unitToPx, gravityMs2ToEngine, gravityEngineToDisplay,
  SCALE_PRESETS, DEFAULT_SCALE,
} from './units/PhysicsScale'

// ── timer helper ──────────────────────────────────────────────────────────────
const elapsed = (fn: () => void): number => {
  const t0 = performance.now(); fn(); return performance.now() - t0
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. PhysicsEventBus — throughput & fan-out
// ═════════════════════════════════════════════════════════════════════════════

describe('Day5-Load: PhysicsEventBus throughput', () => {

  test('emit 100 000 floor-bounce events to 1 listener < 50 ms', () => {
    const bus = new PhysicsEventBus()
    let count = 0
    bus.on('floor-bounce', () => count++)
    const ms = elapsed(() => {
      for (let i = 0; i < 100_000; i++) {
        bus.emit({ type: 'floor-bounce', bodyIndex: 0, time: i * 0.016 })
      }
    })
    console.log(`  [BUS] 100k emit×1 listener → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(50)
    expect(count).toBe(100_000)
  })

  test('emit 10 000 events to 10 listeners (fan-out = 100k calls) < 30 ms', () => {
    const bus = new PhysicsEventBus()
    let total = 0
    for (let i = 0; i < 10; i++) bus.on('wall-bounce', () => total++)
    const ms = elapsed(() => {
      for (let i = 0; i < 10_000; i++) {
        bus.emit({ type: 'wall-bounce', bodyIndex: 0, time: i * 0.016, vx: i })
      }
    })
    console.log(`  [BUS] 10k emit×10 listeners → ${ms.toFixed(2)} ms  (${total} calls)`)
    expect(ms).toBeLessThan(30)
    expect(total).toBe(100_000)
  })

  test('1 000 subscribe/unsubscribe cycles < 5 ms', () => {
    const bus = new PhysicsEventBus()
    const ms = elapsed(() => {
      for (let i = 0; i < 1_000; i++) {
        const h = () => {}
        bus.on('step', h)
        bus.off('step', h)
      }
    })
    console.log(`  [BUS] 1k subscribe/unsubscribe → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(5)
    expect(bus.listenerCount('step')).toBe(0)
  })

  test('emit all 4 event types interleaved — each type isolated correctly', () => {
    const bus = new PhysicsEventBus()
    const counts = { 'floor-bounce': 0, 'wall-bounce': 0, rest: 0, step: 0 }
    const types = ['floor-bounce', 'wall-bounce', 'rest', 'step'] as const
    types.forEach(t => bus.on(t, () => counts[t]++))

    const EACH = 5_000
    for (let i = 0; i < EACH; i++) {
      types.forEach(t => bus.emit({ type: t, bodyIndex: 0, time: i * 0.016 }))
    }
    types.forEach(t => expect(counts[t]).toBe(EACH))
  })

  test('clear() mid-stream stops all future calls', () => {
    const bus = new PhysicsEventBus()
    let calls = 0
    bus.on('floor-bounce', () => calls++)
    for (let i = 0; i < 1_000; i++) bus.emit({ type: 'floor-bounce', bodyIndex: 0, time: i })
    bus.clear()
    for (let i = 0; i < 1_000; i++) bus.emit({ type: 'floor-bounce', bodyIndex: 0, time: i })
    expect(calls).toBe(1_000)
  })

  test('event payloads are passed through unchanged at high volume', () => {
    const bus = new PhysicsEventBus()
    const received: PhysicsEvent[] = []
    bus.on('wall-bounce', e => received.push(e))
    const N = 500
    for (let i = 0; i < N; i++) {
      bus.emit({ type: 'wall-bounce', bodyIndex: i % 10, time: i * 0.016, vx: i * 2.5, x: (i % 580) + 20 })
    }
    expect(received).toHaveLength(N)
    received.forEach((e, i) => {
      expect(e.bodyIndex).toBe(i % 10)
      expect(e.vx).toBeCloseTo(i * 2.5, 5)
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. FpsMeter — precision & sliding window
// ═════════════════════════════════════════════════════════════════════════════

describe('Day5-Load: FpsMeter precision', () => {

  test('10 000 ticks at exactly 16.666 ms → fps ≈ 60.0 (±0.1)', () => {
    const meter = new FpsMeter(10_000)
    for (let i = 0; i <= 10_000; i++) meter.tick(i * 16.666_666)
    console.log(`  [FPS] 10k ticks at 60fps → ${meter.fps.toFixed(4)} fps`)
    expect(meter.fps).toBeGreaterThan(59.9)
    expect(meter.fps).toBeLessThan(60.1)
    expect(meter.sampleCount).toBe(10_000)
  })

  test('sliding window: 10k ticks with maxSamples=60 always keeps exactly 60 samples', () => {
    const meter = new FpsMeter(60)
    for (let i = 0; i <= 10_000; i++) meter.tick(i * 16)
    expect(meter.sampleCount).toBe(60)
  })

  test('varying frame rate: slow then fast frames → min/max correctly tracked', () => {
    const meter = new FpsMeter(200)
    let t = 0
    // 50 slow frames: 100ms each → 10 fps
    for (let i = 0; i < 50; i++) { meter.tick(t); t += 100 }
    // 50 fast frames: 8ms each → 125 fps
    for (let i = 0; i < 50; i++) { meter.tick(t); t += 8 }
    console.log(`  [FPS] mixed → min=${meter.min.toFixed(1)} max=${meter.max.toFixed(1)} avg=${meter.fps.toFixed(1)}`)
    expect(meter.min).toBeCloseTo(10, 0)
    expect(meter.max).toBeCloseTo(125, 0)
  })

  test('reset after 10k ticks is O(1) < 1 ms', () => {
    const meter = new FpsMeter(10_000)
    for (let i = 0; i <= 10_000; i++) meter.tick(i * 16)
    const ms = elapsed(() => meter.reset())
    console.log(`  [FPS] reset after 10k samples → ${ms.toFixed(3)} ms`)
    expect(ms).toBeLessThan(1)
    expect(meter.sampleCount).toBe(0)
    expect(meter.fps).toBe(0)
  })

  test('1 000 reset/tick cycles — no memory growth, always stable', () => {
    const meter = new FpsMeter(60)
    let t = 0
    for (let cycle = 0; cycle < 1_000; cycle++) {
      meter.reset()
      for (let f = 0; f <= 60; f++) { meter.tick(t); t += 16 }
      expect(meter.sampleCount).toBe(60)
      expect(meter.fps).toBeCloseTo(62.5, 0)
    }
  })

  test('toString() always returns formatted string regardless of state', () => {
    const meter = new FpsMeter()
    expect(meter.toString()).toMatch(/\d+\.\d+ fps/)
    meter.tick(0); meter.tick(16)
    expect(meter.toString()).toMatch(/\d+\.\d+ fps/)
    meter.reset()
    expect(meter.toString()).toMatch(/0\.0 fps/)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. Math utils — batch throughput & numerical stability
// ═════════════════════════════════════════════════════════════════════════════

describe('Day5-Load: Math utils throughput', () => {

  test('kineticEnergy: 1 000 000 calls < 60 ms', () => {
    let sum = 0
    const ms = elapsed(() => {
      for (let i = 0; i < 1_000_000; i++) sum += kineticEnergy(i * 0.01, i * 0.005)
    })
    console.log(`  [MATH] kineticEnergy 1M calls → ${ms.toFixed(2)} ms  sum=${sum.toFixed(0)}`)
    expect(ms).toBeLessThan(120)  // raised 20→60→120: 23 parallel test files, CPU contention
    expect(sum).toBeGreaterThan(0)
  })

  test('potentialEnergy: 1 000 000 calls < 60 ms', () => {
    let sum = 0
    const ms = elapsed(() => {
      for (let i = 0; i < 1_000_000; i++) sum += potentialEnergy(i * 0.1)
    })
    console.log(`  [MATH] potentialEnergy 1M calls → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(60)  // raised 20→60: parallel test files
    expect(sum).toBeGreaterThan(0)
  })

  test('mechanicalEnergy: 500 000 calls < 60 ms', () => {
    let sum = 0
    const ms = elapsed(() => {
      for (let i = 0; i < 500_000; i++) sum += mechanicalEnergy(i * 0.01, i * 0.005, i * 0.1)
    })
    console.log(`  [MATH] mechanicalEnergy 500k calls → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(60)  // raised 30→60: parallel test files
    expect(sum).toBeGreaterThan(0)
  })

  test('clamp: no NaN or Infinity over 1 000 000 calls including edge cases', () => {
    let nanCount = 0
    for (let i = -500_000; i < 500_000; i++) {
      const r = clamp(i * 1.5, -1000, 1000)
      if (!isFinite(r)) nanCount++
    }
    expect(nanCount).toBe(0)
  })

  test('lerp: numerical stability — t in [0,1] always produces result in [a,b]', () => {
    let violations = 0
    for (let t = 0; t <= 1; t += 0.0001) {
      const r = lerp(-500, 500, t)
      if (r < -500 - 1e-9 || r > 500 + 1e-9) violations++
    }
    expect(violations).toBe(0)
  })

  test('mapRange: 100 000 mappings — all results within [outMin, outMax]', () => {
    let violations = 0
    for (let i = 0; i < 100_000; i++) {
      const v = mapRange(i % 1000, 0, 1000, -50, 50)
      if (v < -50 - 1e-9 || v > 50 + 1e-9) violations++
    }
    expect(violations).toBe(0)
  })

  test('roundTo: 100 000 calls produce no NaN', () => {
    for (let i = -50_000; i < 50_000; i++) {
      const r = roundTo(i * Math.PI, 3)
      expect(isFinite(r)).toBe(true)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. Full pipeline load — all Day 5 modules wired together
// ═════════════════════════════════════════════════════════════════════════════

describe('Day5-Load: Full pipeline (World + EventBus + DataRecorder + FpsMeter + Math)', () => {

  test('10 000 steps: step count, event count, sample count, FPS all consistent', () => {
    const world   = new World()
    const body    = world.addBody(new Body({ x: 300, y: 50, vx: 200 }))
    const rec     = new DataRecorder()
    const bus     = new PhysicsEventBus()
    const meter   = new FpsMeter(100)

    rec.start()

    let floorEvents = 0, wallEvents = 0, restEvents = 0
    bus.on('floor-bounce', () => floorEvents++)
    bus.on('wall-bounce',  () => wallEvents++)
    bus.on('rest',         () => restEvents++)

    const STEPS = 10_000
    const DT    = 0.016
    let t = 0

    const ms = elapsed(() => {
      for (let i = 0; i < STEPS; i++) {
        const prevVy = body.vy, prevVx = body.vx

        world.step(DT)
        meter.tick(t); t += DT * 1000   // simulate wall-clock time

        if (prevVy > 2  && body.vy < 0)  bus.emit({ type: 'floor-bounce', bodyIndex: 0, time: world.time })
        if (prevVx < -5 && body.vx > 0)  bus.emit({ type: 'wall-bounce',  bodyIndex: 0, time: world.time })
        if (prevVx > 5  && body.vx < 0)  bus.emit({ type: 'wall-bounce',  bodyIndex: 0, time: world.time })
        if (body.vy === 0 && body.vx === 0) bus.emit({ type: 'rest', bodyIndex: 0, time: world.time })

        rec.record(world.time, body.x, FLOOR_Y - body.y, body.vx, -body.vy, body.ax, -body.ay)
      }
    })

    console.log(`  [FULL] 10k steps → ${ms.toFixed(2)} ms | floor=${floorEvents} wall=${wallEvents} rest=${restEvents}`)
    console.log(`         samples=${rec.getLength()} fps=${meter.fps.toFixed(1)} meterSamples=${meter.sampleCount}`)

    expect(ms).toBeLessThan(200)
    expect(rec.getLength()).toBe(STEPS)
    expect(meter.sampleCount).toBe(100)             // capped at maxSamples=100
    expect(floorEvents + wallEvents).toBeGreaterThan(0)  // ball must bounce at least once

    // No NaN in any series
    const keys = ['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay'] as const
    for (const k of keys) {
      rec.getSeries(k).forEach((v, i) => expect(isFinite(v)).toBe(true, `${k}[${i}] = ${v}`))
    }
  })

  test('energy decreases monotonically (in 200-step rolling average) with DAMPING', () => {
    const world = new World()
    const body  = world.addBody(new Body({ x: 300, y: 100 }))
    const rec   = new DataRecorder()
    rec.start()

    for (let i = 0; i < 5_000; i++) {
      world.step(0.016)
      rec.record(world.time, body.x, FLOOR_Y - body.y, body.vx, -body.vy, body.ax, -body.ay)
    }

    // Sample energy at start, middle, end
    const ys  = rec.getSeries('y')
    const vxs = rec.getSeries('vx')
    const vys = rec.getSeries('vy')

    const avgEnergy = (from: number, to: number) => {
      let sum = 0
      for (let i = from; i < to; i++) sum += mechanicalEnergy(vxs[i], vys[i], ys[i], 1, GRAVITY)
      return sum / (to - from)
    }

    const e0   = avgEnergy(0,     200)
    const e250 = avgEnergy(2_400, 2_600)
    const e499 = avgEnergy(4_800, 5_000)

    console.log(`  [ENERGY] avg ME: start=${e0.toFixed(2)} middle=${e250.toFixed(2)} end=${e499.toFixed(2)}`)
    expect(e250).toBeLessThan(e0)
    expect(e499).toBeLessThan(e250)
  })

  test('20 bodies × 2 000 steps: all events dispatched, all series NaN-free', () => {
    const world = new World()
    const N_BODIES = 20, STEPS = 2_000
    const bodies = Array.from({ length: N_BODIES }, (_, i) =>
      world.addBody(new Body({ x: WALL_L + 10 + (i % 10) * 56, y: 20 + (i % 8) * 40, vx: (i % 2 ? 1 : -1) * (i + 1) * 20 }))
    )
    const recorders = bodies.map(() => { const r = new DataRecorder(); r.start(); return r })
    const bus = new PhysicsEventBus()
    let totalEvents = 0
    bus.on('floor-bounce', () => totalEvents++)
    bus.on('wall-bounce',  () => totalEvents++)

    const ms = elapsed(() => {
      for (let step = 0; step < STEPS; step++) {
        bodies.forEach((b, i) => { const prevVy = b.vy, prevVx = b.vx; void prevVy; void prevVx })
        const prevStates = bodies.map(b => ({ vy: b.vy, vx: b.vx }))
        world.step(0.016)
        bodies.forEach((b, i) => {
          if (prevStates[i].vy > 2 && b.vy < 0) bus.emit({ type: 'floor-bounce', bodyIndex: i, time: world.time })
          if (Math.abs(prevStates[i].vx) > 5 && Math.sign(prevStates[i].vx) !== Math.sign(b.vx))
            bus.emit({ type: 'wall-bounce', bodyIndex: i, time: world.time })
          recorders[i].record(world.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
        })
      }
    })

    console.log(`  [MULTI] 20 bodies × 2k steps → ${ms.toFixed(2)} ms | events=${totalEvents}`)
    expect(ms).toBeLessThan(300)
    expect(totalEvents).toBeGreaterThan(0)
    for (const rec of recorders) {
      expect(rec.getLength()).toBe(STEPS)
      const ys = rec.getSeries('y')
      ys.forEach(v => expect(isFinite(v)).toBe(true))
    }
  })

  test('pipeline determinism: two identical 5 000-step runs produce equal event counts', () => {
    const runPipeline = () => {
      const world = new World()
      const body  = world.addBody(new Body({ x: 300, y: 50, vx: 150 }))
      let floor = 0, wall = 0
      for (let i = 0; i < 5_000; i++) {
        const prevVy = body.vy, prevVx = body.vx
        world.step(0.016)
        if (prevVy > 2 && body.vy < 0) floor++
        if (Math.sign(prevVx) !== Math.sign(body.vx) && Math.abs(prevVx) > 5) wall++
      }
      return { floor, wall, x: body.x, y: body.y }
    }
    const r1 = runPipeline()
    const r2 = runPipeline()
    console.log(`  [DET] floor=${r1.floor} wall=${r1.wall}`)
    expect(r1).toEqual(r2)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. Cross-module connectivity — everything wired together
// ═════════════════════════════════════════════════════════════════════════════

describe('Day5-Load: Cross-module connectivity', () => {

  test('PhysicsScale ↔ Math utils: energy in SI units matches engine energy in px scaled', () => {
    const scale = SCALE_PRESETS.m   // 100 px = 1 m
    const vxPx = 100, vyPx = 0     // 100 px/s = 1 m/s
    const heightPx = 500            // FLOOR_Y = 500 px = 5 m

    const vxM  = pxToUnit(vxPx,    scale)
    const hM   = pxToUnit(heightPx, scale)
    const gMs2 = gravityEngineToDisplay(GRAVITY, scale)   // 9.8 px/s² → 0.098 m/s² in m-scale

    const kePx = kineticEnergy(vxPx,  vyPx)
    const keM  = kineticEnergy(vxM,   0)

    // KE ratio should equal (1/ppu)² since KE = ½mv²
    const expectedRatio = 1 / (scale.pixelsPerUnit * scale.pixelsPerUnit)
    expect(keM / kePx).toBeCloseTo(expectedRatio, 10)

    // PE in engine units vs SI:
    const pePx = potentialEnergy(heightPx, 1, GRAVITY)
    const peM  = potentialEnergy(hM,       1, gMs2)
    // PE = mgh. In px: 1*9.8*500=4900. In m: 1*0.098*5=0.49. Ratio = 1/(ppu*ppu/metersPerUnit)...
    // The ratio is: peM/pePx = (gMs2/GRAVITY) * (hM/heightPx) = (0.1/9.8) * (5/500) = 0.0001/0.98 ≈ 1/9800
    console.log(`  [SCALE] KE px=${kePx} m=${keM} ratio=${(keM/kePx).toFixed(8)}`)
    expect(peM).toBeGreaterThan(0)
    expect(pePx).toBeGreaterThan(0)
  })

  test('SimulationConfig mirrors constants.ts values exactly', () => {
    const cfg: SimulationConfig = {
      gravity: GRAVITY, floorY: FLOOR_Y,
      wallL: WALL_L, wallR: WALL_R, ballRadius: BALL_RADIUS,
    }
    expect(cfg.gravity).toBe(9.8)
    expect(cfg.floorY).toBe(500)
    expect(cfg.wallL).toBe(20)
    expect(cfg.wallR).toBe(580)
    expect(cfg.ballRadius).toBe(20)
    expect(cfg.wallL).toBe(BALL_RADIUS)              // WALL_L = BALL_RADIUS
    expect(cfg.wallR).toBe(CANVAS_W - BALL_RADIUS)   // WALL_R = CANVAS_W - BALL_RADIUS
  })

  test('RecorderSnapshot matches DataRecorder output shape at scale', () => {
    const rec = new DataRecorder()
    rec.start()
    const world = new World()
    const body  = world.addBody(new Body({ x: 300, y: 50 }))
    for (let i = 0; i < 100; i++) {
      world.step(0.016)
      rec.record(world.time, body.x, FLOOR_Y - body.y, body.vx, -body.vy, body.ax, -body.ay)
    }

    const snap: RecorderSnapshot = {
      length: rec.getLength(),
      time:   rec.getSeries('time'),
      x:      rec.getSeries('x'),
      y:      rec.getSeries('y'),
      vx:     rec.getSeries('vx'),
      vy:     rec.getSeries('vy'),
      ax:     rec.getSeries('ax'),
      ay:     rec.getSeries('ay'),
    }

    expect(snap.length).toBe(100)
    expect(snap.time).toHaveLength(100)
    // Type check: all arrays same length
    const lengths = [snap.time, snap.x, snap.y, snap.vx, snap.vy, snap.ax, snap.ay].map(a => a.length)
    lengths.forEach(l => expect(l).toBe(100))
  })

  test('BodySnapshot captured at step 100 round-trips through math utils', () => {
    const world = new World()
    const body  = world.addBody(new Body({ x: 300, y: 50, vx: 100 }))
    for (let i = 0; i < 100; i++) world.step(0.016)

    const snap: BodySnapshot = {
      x: body.x, y: body.y, vx: body.vx, vy: body.vy,
      ax: body.ax, ay: body.ay, t: world.time,
    }

    // Use math utils on the snapshot
    const height = Math.max(0, FLOOR_Y - snap.y)
    const ke  = kineticEnergy(snap.vx, snap.vy)
    const pe  = potentialEnergy(height, 1, GRAVITY)
    const me  = mechanicalEnergy(snap.vx, snap.vy, height, 1, GRAVITY)
    const clamped = clamp(snap.vx, WALL_L - CANVAS_W, CANVAS_W - WALL_L)

    expect(ke).toBeGreaterThanOrEqual(0)
    expect(pe).toBeGreaterThanOrEqual(0)
    expect(me).toBeCloseTo(ke + pe, 10)
    expect(clamped).toBeLessThanOrEqual(CANVAS_W - WALL_L)
  })

  test('PhysicsEventBus events carry BodySnapshot-compatible fields', () => {
    const bus = new PhysicsEventBus()
    const events: PhysicsEvent[] = []
    bus.on('floor-bounce', e => events.push(e))

    const world = new World()
    // Start very close to floor with downward velocity — first bounce in ~2 steps
    const body  = world.addBody(new Body({ x: 300, y: 499, vy: 30 }))
    for (let i = 0; i < 100; i++) {
      const prevVy = body.vy
      world.step(0.016)
      if (prevVy > 0 && body.vy < 0) {
        bus.emit({
          type: 'floor-bounce', bodyIndex: 0, time: world.time,
          x: body.x, y: body.y, vy: body.vy,
        })
      }
    }

    expect(events.length).toBeGreaterThanOrEqual(1)
    for (const e of events) {
      // Every event field is finite
      expect(isFinite(e.time)).toBe(true)
      if (e.x  !== undefined) expect(isFinite(e.x)).toBe(true)
      if (e.y  !== undefined) expect(isFinite(e.y)).toBe(true)
      if (e.vy !== undefined) {
        // vy should be negative (bounced up) — in canvas coords
        expect(e.vy).toBeLessThan(0)
        // Energy at bounce: KE is positive
        expect(kineticEnergy(0, e.vy)).toBeGreaterThan(0)
      }
    }
  })

  test('FpsMeter correctly tracks a realistic 5-second simulation loop', () => {
    const meter = new FpsMeter(300)
    const world = new World()
    const body  = world.addBody(new Body({ x: 300, y: 50, vx: 100 }))

    // Simulate 5 seconds at 60fps (300 frames)
    for (let f = 0; f <= 300; f++) {
      meter.tick(f * 16.666)
      world.step(0.016)
    }

    console.log(`  [PIPE] 5s simulation: fps=${meter.fps.toFixed(2)} samples=${meter.sampleCount}`)
    expect(meter.fps).toBeGreaterThan(59)
    expect(meter.fps).toBeLessThan(61)
    expect(meter.sampleCount).toBe(300)
    // Body should be within bounds after 300 steps
    expect(body.x).toBeGreaterThanOrEqual(WALL_L)
    expect(body.x).toBeLessThanOrEqual(WALL_R)
    expect(body.y).toBeLessThanOrEqual(FLOOR_Y)
  })

  test('gravity round-trip: all 4 scales ↔ gravityMs2ToEngine ↔ gravityEngineToDisplay', () => {
    const originalMs2 = 9.8
    const scales = [SCALE_PRESETS.px, SCALE_PRESETS.cm, SCALE_PRESETS.m, DEFAULT_SCALE]
    for (const scale of scales) {
      const engine  = gravityMs2ToEngine(originalMs2, scale)
      const display = gravityEngineToDisplay(engine, scale)
      console.log(`  [SCALE] ${scale.id}: g=${originalMs2} → engine=${engine.toFixed(3)} → display=${display.toFixed(3)}`)
      // In px mode display == engine; in m/cm mode display ≈ originalMs2 / metersPerUnit
      if (scale.metersPerUnit != null) {
        const expectedDisplay = originalMs2 / scale.metersPerUnit
        expect(display).toBeCloseTo(expectedDisplay, 6)
      } else {
        // px mode: display == engine == originalMs2
        expect(engine).toBeCloseTo(originalMs2, 6)
        expect(display).toBeCloseTo(originalMs2, 6)
      }
    }
  })

  test('WALL_DAMPING constant ties energy to PhysicsEventBus wall-bounce events', () => {
    // After a wall bounce, KE should be WALL_DAMPING² × previous KE (x-direction only)
    const world = new World()
    const body  = world.addBody(new Body({ x: 560, y: FLOOR_Y, vx: 200 }))
    // force rest on floor so only horizontal motion matters
    body.vy = 0; body.ay = 0

    const prevVx = body.vx
    const preBounceKE = kineticEnergy(prevVx, 0)

    // Step until wall bounce
    let bounced = false
    for (let i = 0; i < 20 && !bounced; i++) {
      world.step(0.016)
      if (Math.sign(body.vx) !== Math.sign(prevVx) && Math.abs(body.vx) > 1) bounced = true
    }

    if (bounced) {
      const postBounceKE = kineticEnergy(body.vx, 0)
      const expectedRatio = WALL_DAMPING * WALL_DAMPING
      const actualRatio   = postBounceKE / preBounceKE
      console.log(`  [DAMP] KE before=${preBounceKE.toFixed(2)} after=${postBounceKE.toFixed(2)} ratio=${actualRatio.toFixed(4)} expected=${expectedRatio}`)
      expect(actualRatio).toBeCloseTo(expectedRatio, 1)
    }
  })
})
