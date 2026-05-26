/**
 * KinLab — Day 5 Readiness Tests
 *
 * Validates all new architectural infrastructure introduced in Day 5:
 *   • src/types/index.ts        — shared type definitions
 *   • src/engine/PhysicsEvents.ts — physics event bus
 *   • src/utils/math.ts         — physics math helpers
 *   • src/utils/fps.ts          — FPS measurement utility
 *
 * Also verifies cross-module integration and API surface completeness.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

// ── New infrastructure imports ────────────────────────────────────────────────
import type {
  PlayState,
  SimulationConfig,
  BodySnapshot,
  SeriesKey,
  RecorderSnapshot,
  AxisDescriptor,
} from './types/index'
import { PhysicsEventBus } from './engine/PhysicsEvents'
import type { PhysicsEvent, PhysicsEventType } from './engine/PhysicsEvents'
import { clamp, lerp, roundTo, kineticEnergy, potentialEnergy, mechanicalEnergy, mapRange } from './utils/math'
import { FpsMeter } from './utils/fps'

// ── Existing engine (verify no regression) ────────────────────────────────────
import { World } from './engine/World'
import { Body } from './engine/Body'
import { DataRecorder } from './recorder/DataRecorder'
import { FLOOR_Y, WALL_L, WALL_R, GRAVITY } from './constants'

// ═════════════════════════════════════════════════════════════════════════════
// 1. Types — compile-time shape verification
// ═════════════════════════════════════════════════════════════════════════════

describe('Day5: Types — shape and defaults', () => {
  test('PlayState accepts all four valid values', () => {
    const states: PlayState[] = ['idle', 'playing', 'paused', 'stopped']
    expect(states).toHaveLength(4)
  })

  test('SimulationConfig holds all required fields', () => {
    const cfg: SimulationConfig = {
      gravity: GRAVITY,
      floorY: FLOOR_Y,
      wallL: WALL_L,
      wallR: WALL_R,
      ballRadius: 20,
    }
    expect(cfg.gravity).toBe(GRAVITY)
    expect(cfg.floorY).toBe(FLOOR_Y)
    expect(cfg.wallL).toBe(WALL_L)
    expect(cfg.wallR).toBe(WALL_R)
    expect(cfg.ballRadius).toBe(20)
  })

  test('BodySnapshot holds x/y/vx/vy/ax/ay + t', () => {
    const snap: BodySnapshot = { x: 300, y: 100, vx: 5, vy: -10, ax: 0, ay: 9.8, t: 0.5 }
    expect(Object.keys(snap)).toHaveLength(7)
    expect(snap.t).toBe(0.5)
  })

  test('SeriesKey union covers all 7 data channels', () => {
    const keys: SeriesKey[] = ['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay']
    expect(keys).toHaveLength(7)
  })

  test('RecorderSnapshot structure matches DataRecorder output shape', () => {
    const snap: RecorderSnapshot = {
      length: 3,
      time: [0, 0.016, 0.032],
      x: [300, 301, 302],
      y: [50, 51, 52],
      vx: [0, 0, 0],
      vy: [0, 9.8, 19.6],
      ax: [0, 0, 0],
      ay: [9.8, 9.8, 9.8],
    }
    expect(snap.length).toBe(3)
    expect(snap.time).toHaveLength(3)
  })

  test('AxisDescriptor carries key, label, unit', () => {
    const desc: AxisDescriptor = { key: 'vx', label: 'vx', unit: 'px/s' }
    expect(desc.key).toBe('vx')
    expect(desc.unit).toBe('px/s')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. PhysicsEventBus
// ═════════════════════════════════════════════════════════════════════════════

describe('Day5: PhysicsEventBus — on / emit', () => {
  let bus: PhysicsEventBus

  beforeEach(() => { bus = new PhysicsEventBus() })

  test('listenerCount is 0 for unknown type', () => {
    expect(bus.listenerCount('floor-bounce')).toBe(0)
  })

  test('on() registers a listener', () => {
    bus.on('floor-bounce', () => {})
    expect(bus.listenerCount('floor-bounce')).toBe(1)
  })

  test('on() is idempotent — registering same handler twice counts as 1', () => {
    const h = () => {}
    bus.on('floor-bounce', h)
    bus.on('floor-bounce', h)
    expect(bus.listenerCount('floor-bounce')).toBe(1)
  })

  test('emit() calls the registered handler with the correct payload', () => {
    const received: PhysicsEvent[] = []
    bus.on('floor-bounce', e => received.push(e))
    const evt: PhysicsEvent = { type: 'floor-bounce', bodyIndex: 0, time: 1.0, vy: -5.5 }
    bus.emit(evt)
    expect(received).toHaveLength(1)
    expect(received[0]).toEqual(evt)
  })

  test('emit() to type with no listeners is a no-op (no throw)', () => {
    expect(() => bus.emit({ type: 'rest', bodyIndex: 0, time: 0 })).not.toThrow()
  })

  test('multiple handlers for the same event all receive it', () => {
    const calls: number[] = []
    bus.on('wall-bounce', () => calls.push(1))
    bus.on('wall-bounce', () => calls.push(2))
    bus.on('wall-bounce', () => calls.push(3))
    bus.emit({ type: 'wall-bounce', bodyIndex: 0, time: 0.5, vx: 10 })
    expect(calls.sort()).toEqual([1, 2, 3])
  })

  test('handlers for different types do not cross-fire', () => {
    const floorCalls: number[] = []
    const wallCalls: number[] = []
    bus.on('floor-bounce', () => floorCalls.push(1))
    bus.on('wall-bounce', () => wallCalls.push(1))
    bus.emit({ type: 'floor-bounce', bodyIndex: 0, time: 1 })
    expect(floorCalls).toHaveLength(1)
    expect(wallCalls).toHaveLength(0)
  })
})

describe('Day5: PhysicsEventBus — off / clear', () => {
  let bus: PhysicsEventBus

  beforeEach(() => { bus = new PhysicsEventBus() })

  test('off() removes exactly the specified handler', () => {
    const h1 = vi.fn(); const h2 = vi.fn()
    bus.on('rest', h1); bus.on('rest', h2)
    bus.off('rest', h1)
    bus.emit({ type: 'rest', bodyIndex: 0, time: 2 })
    expect(h1).not.toHaveBeenCalled()
    expect(h2).toHaveBeenCalledOnce()
  })

  test('off() on unregistered handler is a no-op (no throw)', () => {
    expect(() => bus.off('floor-bounce', () => {})).not.toThrow()
  })

  test('clear(type) removes all handlers for that type only', () => {
    const floor = vi.fn(); const wall = vi.fn()
    bus.on('floor-bounce', floor); bus.on('wall-bounce', wall)
    bus.clear('floor-bounce')
    bus.emit({ type: 'floor-bounce', bodyIndex: 0, time: 0 })
    bus.emit({ type: 'wall-bounce',  bodyIndex: 0, time: 0 })
    expect(floor).not.toHaveBeenCalled()
    expect(wall).toHaveBeenCalledOnce()
  })

  test('clear() with no argument removes all handlers', () => {
    const h = vi.fn()
    const types: PhysicsEventType[] = ['floor-bounce', 'wall-bounce', 'rest', 'step']
    types.forEach(t => bus.on(t, h))
    bus.clear()
    types.forEach(t => bus.emit({ type: t, bodyIndex: 0, time: 0 }))
    expect(h).not.toHaveBeenCalled()
  })

  test('hasListeners() reflects registration state', () => {
    expect(bus.hasListeners('step')).toBe(false)
    const h = () => {}
    bus.on('step', h)
    expect(bus.hasListeners('step')).toBe(true)
    bus.off('step', h)
    expect(bus.hasListeners('step')).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. Math utilities
// ═════════════════════════════════════════════════════════════════════════════

describe('Day5: clamp()', () => {
  test('value below min returns min', () => expect(clamp(-5, 0, 100)).toBe(0))
  test('value above max returns max', () => expect(clamp(150, 0, 100)).toBe(100))
  test('value in range returns unchanged', () => expect(clamp(42, 0, 100)).toBe(42))
  test('value exactly at min returns min', () => expect(clamp(0, 0, 100)).toBe(0))
  test('value exactly at max returns max', () => expect(clamp(100, 0, 100)).toBe(100))
  test('negative range works', () => expect(clamp(-3, -10, -1)).toBe(-3))
})

describe('Day5: lerp()', () => {
  test('t=0 returns a', () => expect(lerp(10, 20, 0)).toBe(10))
  test('t=1 returns b', () => expect(lerp(10, 20, 1)).toBe(20))
  test('t=0.5 returns midpoint', () => expect(lerp(0, 100, 0.5)).toBe(50))
  test('t=0.25 returns quarter', () => expect(lerp(0, 10, 0.25)).toBe(2.5))
  test('works with negative values', () => expect(lerp(-10, 10, 0.5)).toBe(0))
})

describe('Day5: roundTo()', () => {
  test('rounds to 0 decimals', () => expect(roundTo(3.7, 0)).toBe(4))
  test('rounds to 2 decimals', () => expect(roundTo(3.14159, 2)).toBe(3.14))
  test('rounds to 4 decimals', () => expect(roundTo(Math.PI, 4)).toBeCloseTo(3.1416, 4))
  test('zero is zero', () => expect(roundTo(0, 5)).toBe(0))
})

describe('Day5: kineticEnergy()', () => {
  test('zero velocity → KE = 0', () => expect(kineticEnergy(0, 0)).toBe(0))
  test('vx=1, vy=0, mass=2 → KE = 1', () => expect(kineticEnergy(1, 0, 2)).toBe(1))
  test('vx=3, vy=4 (speed=5), mass=1 → KE = 12.5', () => expect(kineticEnergy(3, 4)).toBe(12.5))
  test('KE is always non-negative', () => expect(kineticEnergy(-10, -20)).toBeGreaterThanOrEqual(0))
  test('mass scales linearly', () => {
    expect(kineticEnergy(1, 0, 4)).toBe(4 * kineticEnergy(1, 0, 1))
  })
})

describe('Day5: potentialEnergy()', () => {
  test('height=0 → PE = 0', () => expect(potentialEnergy(0)).toBe(0))
  test('height=10, mass=1, g=9.8 → PE = 98', () => expect(potentialEnergy(10, 1, 9.8)).toBe(98))
  test('mass scales linearly', () => {
    expect(potentialEnergy(5, 2, 9.8)).toBe(2 * potentialEnergy(5, 1, 9.8))
  })
})

describe('Day5: mechanicalEnergy()', () => {
  test('at rest at height h → E = PE only', () => {
    const h = 50; const g = 9.8
    expect(mechanicalEnergy(0, 0, h, 1, g)).toBeCloseTo(potentialEnergy(h, 1, g), 10)
  })
  test('at floor (h=0) moving → E = KE only', () => {
    expect(mechanicalEnergy(3, 4, 0, 1, 9.8)).toBeCloseTo(kineticEnergy(3, 4), 10)
  })
})

describe('Day5: mapRange()', () => {
  test('maps midpoint correctly', () => expect(mapRange(5, 0, 10, 0, 100)).toBe(50))
  test('maps lower bound to outMin', () => expect(mapRange(0, 0, 10, 0, 100)).toBe(0))
  test('maps upper bound to outMax', () => expect(mapRange(10, 0, 10, 0, 100)).toBe(100))
  test('handles inMin === inMax (returns outMin)', () => {
    expect(mapRange(5, 5, 5, 0, 100)).toBe(0)
  })
  test('reverse mapping', () => expect(mapRange(0, 0, 10, 100, 0)).toBe(100))
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. FpsMeter
// ═════════════════════════════════════════════════════════════════════════════

describe('Day5: FpsMeter — initial state', () => {
  test('fps is 0 before any ticks', () => {
    const m = new FpsMeter()
    expect(m.fps).toBe(0)
  })

  test('min is 0 before any ticks', () => expect(new FpsMeter().min).toBe(0))
  test('max is 0 before any ticks', () => expect(new FpsMeter().max).toBe(0))
  test('sampleCount is 0 before any ticks', () => expect(new FpsMeter().sampleCount).toBe(0))
})

describe('Day5: FpsMeter — tick behavior', () => {
  test('single tick produces no sample (no dt yet)', () => {
    const m = new FpsMeter()
    m.tick(0)
    expect(m.sampleCount).toBe(0)
  })

  test('two ticks 16ms apart → fps ≈ 62.5', () => {
    const m = new FpsMeter()
    m.tick(0)
    m.tick(16)
    expect(m.fps).toBeCloseTo(62.5, 0)
    expect(m.sampleCount).toBe(1)
  })

  test('60 ticks at 16ms apart → fps ≈ 62.5', () => {
    const m = new FpsMeter(60)
    for (let i = 0; i <= 60; i++) m.tick(i * 16)
    expect(m.fps).toBeCloseTo(62.5, 0)
    expect(m.sampleCount).toBe(60)
  })

  test('sliding window caps at maxSamples', () => {
    const m = new FpsMeter(10)
    for (let i = 0; i <= 20; i++) m.tick(i * 16)
    expect(m.sampleCount).toBe(10)
  })

  test('min and max are computable after several ticks', () => {
    const m = new FpsMeter()
    // 2 slow frames (100ms = 10fps) then 1 fast (10ms = 100fps)
    m.tick(0)
    m.tick(100)   // dt=100ms → 10fps
    m.tick(200)   // dt=100ms → 10fps
    m.tick(210)   // dt=10ms  → 100fps
    expect(m.min).toBeCloseTo(10, 0)
    expect(m.max).toBeCloseTo(100, 0)
  })

  test('reset() clears all samples and resets timer', () => {
    const m = new FpsMeter()
    m.tick(0); m.tick(16); m.tick(32)
    m.reset()
    expect(m.fps).toBe(0)
    expect(m.sampleCount).toBe(0)
    // After reset: first tick establishes new baseline (no sample yet)
    m.tick(1000)
    expect(m.sampleCount).toBe(0)
    // Second tick records the delta from the new baseline
    m.tick(1016)
    expect(m.sampleCount).toBe(1)
    expect(m.fps).toBeCloseTo(62.5, 0)
  })

  test('toString() returns formatted fps string', () => {
    const m = new FpsMeter()
    m.tick(0); m.tick(16)
    expect(m.toString()).toMatch(/\d+\.\d+ fps/)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. Cross-module integration
// ═════════════════════════════════════════════════════════════════════════════

describe('Day5: PhysicsEventBus × World integration', () => {
  test('bus can receive events driven by World output', () => {
    const bus = new PhysicsEventBus()
    const world = new World()
    // Start very close to the floor with a downward velocity so first bounce
    // happens within a handful of steps (y=498, vy=30 → floor in ~1 step)
    const body = world.addBody(new Body({ x: 300, y: 498, vy: 30 }))
    const bounces: PhysicsEvent[] = []
    bus.on('floor-bounce', e => bounces.push(e))

    // Run 100 steps and emit floor-bounce whenever vy flips sign at the floor
    for (let i = 0; i < 100; i++) {
      const prevVy = body.vy
      world.step(0.016)
      // floor bounce: was moving down (vy > 0), now moving up (vy < 0)
      if (prevVy > 0 && body.vy < 0) {
        bus.emit({ type: 'floor-bounce', bodyIndex: 0, time: world.time, y: body.y, vy: body.vy })
      }
    }

    expect(bounces.length).toBeGreaterThanOrEqual(1)
    bounces.forEach(e => expect(e.type).toBe('floor-bounce'))
  })

  test('FpsMeter tracks simulated frame times', () => {
    const meter = new FpsMeter(30)
    const BASE = 1000
    for (let f = 0; f <= 30; f++) {
      meter.tick(BASE + f * 16.666)
    }
    // Should be close to 60fps (16.666ms per frame)
    expect(meter.fps).toBeGreaterThan(55)
    expect(meter.fps).toBeLessThan(65)
    expect(meter.sampleCount).toBe(30)
  })

  test('math helpers: energy conservation check over 10 floor bounces', () => {
    const world = new World()
    const b = world.addBody(new Body({ x: 300, y: 200, vx: 0, vy: 0 }))
    // Run until ball has bounced several times
    let bounces = 0
    let prevVy = 0
    for (let i = 0; i < 5_000 && bounces < 10; i++) {
      world.step(0.016)
      if (prevVy > 0 && b.vy < 0) bounces++
      prevVy = b.vy
    }
    // After bounces, KE at floor level should be non-negative (energy only lost, not gained)
    const ke = kineticEnergy(b.vx, b.vy)
    expect(ke).toBeGreaterThanOrEqual(0)
    // Final KE must be less than initial PE (energy lost to damping)
    const initialPE = potentialEnergy(FLOOR_Y - 200, 1, GRAVITY)
    expect(ke).toBeLessThan(initialPE)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6. Architecture surface — barrel exports and module completeness
// ═════════════════════════════════════════════════════════════════════════════

describe('Day5: Architecture surface', () => {
  test('engine barrel exports Body, World, InteractionLayer', async () => {
    const barrel = await import('./engine/index')
    expect(barrel.Body).toBeDefined()
    expect(barrel.World).toBeDefined()
    expect(barrel.InteractionLayer).toBeDefined()
  })

  test('PhysicsEventBus is instantiable and exposes required API', () => {
    const bus = new PhysicsEventBus()
    expect(typeof bus.on).toBe('function')
    expect(typeof bus.off).toBe('function')
    expect(typeof bus.emit).toBe('function')
    expect(typeof bus.clear).toBe('function')
    expect(typeof bus.listenerCount).toBe('function')
    expect(typeof bus.hasListeners).toBe('function')
  })

  test('FpsMeter is instantiable and exposes required API', () => {
    const m = new FpsMeter()
    expect(typeof m.tick).toBe('function')
    expect(typeof m.fps).toBe('number')
    expect(typeof m.min).toBe('number')
    expect(typeof m.max).toBe('number')
    expect(typeof m.sampleCount).toBe('number')
    expect(typeof m.reset).toBe('function')
    expect(typeof m.toString).toBe('function')
  })

  test('math module exports all six helpers', () => {
    expect(typeof clamp).toBe('function')
    expect(typeof lerp).toBe('function')
    expect(typeof roundTo).toBe('function')
    expect(typeof kineticEnergy).toBe('function')
    expect(typeof potentialEnergy).toBe('function')
    expect(typeof mechanicalEnergy).toBe('function')
    expect(typeof mapRange).toBe('function')
  })

  test('constants module is stable — all 7 exports present', async () => {
    const consts = await import('./constants')
    const expected = ['FLOOR_Y', 'CANVAS_W', 'CANVAS_H', 'BALL_RADIUS', 'GRAVITY', 'WALL_L', 'WALL_R', 'WALL_DAMPING']
    for (const key of expected) {
      expect(consts).toHaveProperty(key)
    }
  })
})
