/**
 * KinLab Day 3 Test Suite
 * KAN-41 RecordingIndicator (state logic)
 * KAN-42 Wall collisions
 * KAN-43 DataTable (formatter utility)
 * KAN-44 CSV export
 * KAN-45 Gravity slider
 */

import { describe, test, expect } from 'vitest'
import { World } from './engine/World'
import { Body } from './engine/Body'
import { DataRecorder } from './recorder/DataRecorder'
import { buildCsv } from './components/CsvExportButton'
import { FLOOR_Y, WALL_L, WALL_R, WALL_DAMPING, GRAVITY, CANVAS_W, BALL_RADIUS } from './constants'

// ─── KAN-41  Recording state machine ────────────────────────────────────────

describe('KAN-41: DataRecorder.isRecording()', () => {
  test('false before start()', () => {
    const r = new DataRecorder()
    expect(r.isRecording()).toBe(false)
  })

  test('true after start()', () => {
    const r = new DataRecorder()
    r.start()
    expect(r.isRecording()).toBe(true)
  })

  test('false after stop()', () => {
    const r = new DataRecorder()
    r.start()
    r.stop()
    expect(r.isRecording()).toBe(false)
  })

  test('false after reset() even if was recording', () => {
    const r = new DataRecorder()
    r.start()
    r.reset()
    expect(r.isRecording()).toBe(false)
  })

  test('true again after start() → stop() → start()', () => {
    const r = new DataRecorder()
    r.start(); r.stop(); r.start()
    expect(r.isRecording()).toBe(true)
  })
})

// ─── KAN-42  Wall collisions ─────────────────────────────────────────────────

describe('KAN-42: Wall collisions', () => {
  test('WALL_L = BALL_RADIUS, WALL_R = CANVAS_W - BALL_RADIUS', () => {
    expect(WALL_L).toBe(BALL_RADIUS)
    expect(WALL_R).toBe(CANVAS_W - BALL_RADIUS)
  })

  test('ball moving left hits left wall — vx flips positive', () => {
    // Start exactly at WALL_L so one step of vx=-50 overshoots: x = WALL_L - 0.8
    const w = new World()
    const b = w.addBody(new Body({ x: WALL_L, y: 200, vx: -50 }))
    w.step(0.016)
    expect(b.x).toBeGreaterThanOrEqual(WALL_L)
    expect(b.vx).toBeGreaterThan(0)   // bounced rightward
  })

  test('ball moving right hits right wall — vx flips negative', () => {
    // Start exactly at WALL_R so one step of vx=+50 overshoots
    const w = new World()
    const b = w.addBody(new Body({ x: WALL_R, y: 200, vx: 50 }))
    w.step(0.016)
    expect(b.x).toBeLessThanOrEqual(WALL_R)
    expect(b.vx).toBeLessThan(0)   // bounced leftward
  })

  test('wall bounce absorbs energy — |vx| after < |vx| before', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: WALL_L + 1, y: 200, vx: -80 }))
    const vxBefore = Math.abs(b.vx)
    w.step(0.016)
    expect(Math.abs(b.vx)).toBeLessThan(vxBefore)
    expect(Math.abs(b.vx)).toBeCloseTo(vxBefore * WALL_DAMPING, 3)
  })

  test('ball moving away from left wall is NOT bounced', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: WALL_L, y: 200, vx: 30 }))   // at wall, moving right
    w.step(0.016)
    expect(b.vx).toBeGreaterThan(0)   // still moving right — no flip
  })

  test('ball starting below left wall boundary is clipped to WALL_L', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 0, y: 200, vx: 0 }))
    w.step(0.016)
    expect(b.x).toBeGreaterThanOrEqual(WALL_L)
  })

  test('ball starting above right wall boundary is clipped to WALL_R', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: CANVAS_W, y: 200, vx: 0 }))
    w.step(0.016)
    expect(b.x).toBeLessThanOrEqual(WALL_R)
  })

  test('x stays within [WALL_L, WALL_R] over 5000 steps with horizontal velocity', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 100, vx: 200, vy: 0 }))
    for (let i = 0; i < 5000; i++) {
      w.step(0.016)
      expect(b.x).toBeGreaterThanOrEqual(WALL_L)
      expect(b.x).toBeLessThanOrEqual(WALL_R)
    }
  })

  test('wall + floor: ball with both vx and vy eventually settles', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50, vx: 100, vy: 0 }))
    for (let i = 0; i < 20_000; i++) w.step(0.016)
    expect(b.y).toBe(FLOOR_Y)
    expect(b.vy).toBe(0)
    expect(b.vx).toBe(0)
  })

  test('no wall bounce when gravity=0 and ball drifts left — x stays bounded', () => {
    const w = new World()
    w.gravity = 0
    const b = w.addBody(new Body({ x: 300, y: 200, vx: -100 }))
    for (let i = 0; i < 1000; i++) w.step(0.016)
    expect(b.x).toBeGreaterThanOrEqual(WALL_L)
  })
})

// ─── KAN-44  CSV export ───────────────────────────────────────────────────────

describe('KAN-44: CSV export (buildCsv)', () => {
  function makeRecorder(n: number): DataRecorder {
    const r = new DataRecorder()
    r.start()
    for (let i = 0; i < n; i++) r.record(i * 0.016, i, i * 2, i * 0.1, -i * 0.1, 0, -9.8)
    return r
  }

  test('CSV header is correct', () => {
    const r = makeRecorder(5)
    const csv = buildCsv(r)
    const header = csv.split('\n')[0]
    expect(header).toBe('time,x,y_height,vx,vy,ax,ay')
  })

  test('row count = samples + 1 header', () => {
    const r = makeRecorder(10)
    const lines = buildCsv(r).split('\n').filter(l => l.length > 0)
    expect(lines.length).toBe(11)   // 1 header + 10 data rows
  })

  test('first data row has correct time=0', () => {
    const r = makeRecorder(5)
    const rows = buildCsv(r).split('\n')
    const first = rows[1].split(',').map(Number)
    expect(first[0]).toBeCloseTo(0, 5)
  })

  test('values are 6-decimal floats', () => {
    const r = makeRecorder(3)
    const row = buildCsv(r).split('\n')[1]
    const cell = row.split(',')[0]
    expect(cell).toMatch(/^\d+\.\d{6}$/)
  })

  test('empty recorder returns header-only CSV', () => {
    const r = new DataRecorder()
    const lines = buildCsv(r).split('\n').filter(l => l.length > 0)
    expect(lines.length).toBe(1)   // only header
  })

  test('500 samples CSV has correct last row time', () => {
    const r = makeRecorder(500)
    const lines = buildCsv(r).split('\n')
    const last = lines[500].split(',').map(Number)
    expect(last[0]).toBeCloseTo(499 * 0.016, 3)
  })
})

// ─── KAN-45  Gravity slider ───────────────────────────────────────────────────

describe('KAN-45: World.gravity (mutable)', () => {
  test('default gravity = GRAVITY constant', () => {
    const w = new World()
    expect(w.gravity).toBe(GRAVITY)
  })

  test('gravity = 0 — ball does not fall', () => {
    const w = new World()
    w.gravity = 0
    const b = w.addBody(new Body({ x: 300, y: 100 }))
    for (let i = 0; i < 1000; i++) w.step(0.016)
    expect(b.y).toBe(100)   // no movement
    expect(b.vy).toBe(0)
  })

  test('gravity = 0 — ball at rest stays at rest', () => {
    const w = new World()
    w.gravity = 0
    const b = w.addBody(new Body({ x: 300, y: FLOOR_Y }))
    // Force rest state
    b.vy = 0; b.vx = 0; b.ay = 0
    for (let i = 0; i < 100; i++) w.step(0.016)
    expect(b.y).toBe(FLOOR_Y)
  })

  test('gravity = 19.6 — ball falls ~2× faster than at 9.8', () => {
    const run = (g: number, steps: number) => {
      const w = new World()
      w.gravity = g
      const b = w.addBody(new Body({ x: 300, y: 0 }))
      for (let i = 0; i < steps; i++) w.step(0.016)
      return b.y
    }
    const y98  = run(9.8,  100)
    const y196 = run(19.6, 100)
    // Double gravity → double displacement (Euler: y ≈ ½g·t²)
    expect(y196).toBeCloseTo(y98 * 2, 0)
  })

  test('changing gravity mid-flight takes effect immediately', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    for (let i = 0; i < 100; i++) w.step(0.016)
    w.gravity = 0          // kill gravity mid-flight
    for (let i = 0; i < 10; i++) w.step(0.016)
    // With gravity=0, ball drifts at constant vy — y changes by vy*dt*10
    // In all cases it should have moved less than with gravity=9.8
    const yWith0 = b.y
    // Run same scenario with gravity=9.8 still on
    const w2 = new World()
    const b2 = w2.addBody(new Body({ x: 300, y: 50 }))
    for (let i = 0; i < 110; i++) w2.step(0.016)
    // Ball with gravity=0 from step 100 should be higher (less fallen) than w2
    expect(yWith0).toBeLessThan(b2.y)
  })

  test('two World instances have independent gravity', () => {
    const w1 = new World(); w1.gravity = 0
    const w2 = new World(); w2.gravity = 9.8
    const b1 = w1.addBody(new Body({ x: 300, y: 100 }))
    const b2 = w2.addBody(new Body({ x: 300, y: 100 }))
    for (let i = 0; i < 100; i++) { w1.step(0.016); w2.step(0.016) }
    expect(b1.y).toBe(100)       // no gravity
    expect(b2.y).toBeGreaterThan(100)  // falls normally
  })

  test('gravity restores correctly after being changed', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    w.gravity = 0
    for (let i = 0; i < 50; i++) w.step(0.016)
    const yAfterZero = b.y
    w.gravity = GRAVITY
    for (let i = 0; i < 50; i++) w.step(0.016)
    expect(b.y).toBeGreaterThan(yAfterZero)  // falling again
  })
})
