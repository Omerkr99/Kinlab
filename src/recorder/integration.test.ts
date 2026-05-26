/**
 * KAN-13 T5.3 — DataRecorder × World Integration Tests
 *
 * Verifies the full step→record pipeline: every World.step() followed by
 * recorder.record() must produce a consistent, monotonic, NaN-free time series.
 *
 * These tests sit in src/recorder/ because they specifically validate that
 * DataRecorder behaves correctly when driven by a live World.
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { World } from '../engine/World'
import { Body } from '../engine/Body'
import { DataRecorder } from './DataRecorder'
import { FLOOR_Y, WALL_L, WALL_R } from '../constants'

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeWorld() {
  const world = new World()
  const body = world.addBody(new Body({ x: 300, y: 50 }))
  const recorder = new DataRecorder()
  recorder.start()
  return { world, body, recorder }
}

function runPipeline(world: World, body: Body, recorder: DataRecorder, steps: number) {
  for (let i = 0; i < steps; i++) {
    world.step(0.016)
    recorder.record(world.time, body.x, body.y, body.vx, body.vy, body.ax, body.ay)
  }
}

// ─── T5.3 Core: step count = recorder length ─────────────────────────────────

describe('T5.3 — step count matches recorder length', () => {
  let world: World, body: Body, recorder: DataRecorder

  beforeEach(() => {
    ;({ world, body, recorder } = makeWorld())
  })

  test('World.step() × 1 → recorder.getLength() === 1', () => {
    world.step(0.016)
    recorder.record(world.time, body.x, body.y, body.vx, body.vy, body.ax, body.ay)
    expect(recorder.getLength()).toBe(1)
  })

  test('World.step() × 20 → recorder.getLength() === 20', () => {
    runPipeline(world, body, recorder, 20)
    expect(recorder.getLength()).toBe(20)
  })

  test('World.step() × 600 → recorder.getLength() === 600', () => {
    runPipeline(world, body, recorder, 600)
    expect(recorder.getLength()).toBe(600)
  })

  test('World.step() × 5000 → recorder.getLength() === 5000', () => {
    runPipeline(world, body, recorder, 5_000)
    expect(recorder.getLength()).toBe(5_000)
  })
})

// ─── Time monotonicity ────────────────────────────────────────────────────────

describe('T5.3 — time series is strictly monotonically increasing', () => {
  test('100 steps: each time sample > previous', () => {
    const { world, body, recorder } = makeWorld()
    runPipeline(world, body, recorder, 100)
    const times = recorder.getSeries('time')
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1])
    }
  })

  test('time[n] ≈ n × 0.016 (cumulative Euler time)', () => {
    const { world, body, recorder } = makeWorld()
    runPipeline(world, body, recorder, 50)
    const times = recorder.getSeries('time')
    times.forEach((t, i) => expect(t).toBeCloseTo((i + 1) * 0.016, 8))
  })
})

// ─── NaN / Infinity guard ─────────────────────────────────────────────────────

describe('T5.3 — no NaN or Infinity in any series after 1000 steps', () => {
  const KEYS = ['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay'] as const

  test('ball starting at (300, 50) — 1000 steps', () => {
    const { world, body, recorder } = makeWorld()
    runPipeline(world, body, recorder, 1_000)
    for (const key of KEYS) {
      const series = recorder.getSeries(key)
      series.forEach((v, i) => {
        expect(isFinite(v)).toBe(true, `${key}[${i}] = ${v} is not finite`)
      })
    }
  })

  test('high-vx ball (vx=300) — 500 steps with wall bounces', () => {
    const world = new World()
    const body = world.addBody(new Body({ x: 300, y: 100, vx: 300 }))
    const recorder = new DataRecorder()
    recorder.start()
    runPipeline(world, body, recorder, 500)
    for (const key of KEYS) {
      const series = recorder.getSeries(key)
      series.forEach(v => expect(isFinite(v)).toBe(true))
    }
  })
})

// ─── stop() gate ─────────────────────────────────────────────────────────────

describe('T5.3 — stop() freezes recorder length', () => {
  test('stop after 30 steps — further steps do not increase length', () => {
    const { world, body, recorder } = makeWorld()
    runPipeline(world, body, recorder, 30)
    recorder.stop()
    const frozenLength = recorder.getLength()
    runPipeline(world, body, recorder, 20)   // 20 more steps — should not record
    expect(recorder.getLength()).toBe(frozenLength)
    expect(frozenLength).toBe(30)
  })
})

// ─── reset + restart ──────────────────────────────────────────────────────────

describe('T5.3 — reset/start cycles preserve data integrity', () => {
  test('reset clears all series; start enables fresh recording', () => {
    const { world, body, recorder } = makeWorld()
    runPipeline(world, body, recorder, 100)
    recorder.reset()
    expect(recorder.getLength()).toBe(0)
    recorder.start()
    runPipeline(world, body, recorder, 10)
    expect(recorder.getLength()).toBe(10)
  })

  test('500 reset/start cycles of 20 steps each — final length is 20', () => {
    const { world, body, recorder } = makeWorld()
    for (let cycle = 0; cycle < 500; cycle++) {
      recorder.reset()
      recorder.start()
      for (let i = 0; i < 20; i++) {
        world.step(0.016)
        recorder.record(world.time, body.x, body.y, body.vx, body.vy, body.ax, body.ay)
      }
    }
    expect(recorder.getLength()).toBe(20)
  })
})

// ─── Physical bounds ──────────────────────────────────────────────────────────

describe('T5.3 — recorded positions stay in physical bounds', () => {
  test('y is always ≤ FLOOR_Y (ball never sinks below floor)', () => {
    const { world, body, recorder } = makeWorld()
    runPipeline(world, body, recorder, 2_000)
    const ys = recorder.getSeries('y')
    ys.forEach(y => expect(y).toBeLessThanOrEqual(FLOOR_Y))
  })

  test('x stays within [WALL_L, WALL_R] at all times', () => {
    const world = new World()
    const body = world.addBody(new Body({ x: 300, y: 200, vx: 500 }))
    const recorder = new DataRecorder()
    recorder.start()
    runPipeline(world, body, recorder, 1_000)
    const xs = recorder.getSeries('x')
    xs.forEach(x => {
      expect(x).toBeGreaterThanOrEqual(WALL_L)
      expect(x).toBeLessThanOrEqual(WALL_R)
    })
  })
})

// ─── Multi-body independence ──────────────────────────────────────────────────

describe('T5.3 — multiple recorders are independent', () => {
  test('5 bodies × 5 recorders — each recorder length == step count', () => {
    const world = new World()
    const STEPS = 200
    const pairs = Array.from({ length: 5 }, (_, i) => {
      const body = world.addBody(new Body({ x: 50 + i * 100, y: 20 + i * 30, vx: (i - 2) * 50 }))
      const recorder = new DataRecorder()
      recorder.start()
      return { body, recorder }
    })

    for (let s = 0; s < STEPS; s++) {
      world.step(0.016)
      for (const { body, recorder } of pairs) {
        recorder.record(world.time, body.x, body.y, body.vx, body.vy, body.ax, body.ay)
      }
    }

    for (const { recorder } of pairs) {
      expect(recorder.getLength()).toBe(STEPS)
    }
  })

  test('5 recorders report the same world.time in their time series', () => {
    const world = new World()
    const STEPS = 50
    const pairs = Array.from({ length: 5 }, (_, i) => {
      const body = world.addBody(new Body({ x: 50 + i * 100, y: 50 }))
      const recorder = new DataRecorder()
      recorder.start()
      return { body, recorder }
    })

    for (let s = 0; s < STEPS; s++) {
      world.step(0.016)
      for (const { body, recorder } of pairs) {
        recorder.record(world.time, body.x, body.y, body.vx, body.vy, body.ax, body.ay)
      }
    }

    const referenceTimes = pairs[0].recorder.getSeries('time')
    for (let r = 1; r < pairs.length; r++) {
      const times = pairs[r].recorder.getSeries('time')
      times.forEach((t, i) => expect(t).toBeCloseTo(referenceTimes[i], 10))
    }
  })
})
