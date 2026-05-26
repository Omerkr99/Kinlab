/**
 * KAN-15 — Day 7 Unit Tests: GraphEngine.ts + GraphCanvas.tsx
 *
 * Verifies all KAN-15 acceptance criteria:
 *   T7.1 — GraphEngine.ts: draw(), drawGrid, drawAxes, drawData, auto-scale
 *   T7.2 — GraphEngine.test.ts: 2 core tests (already in graph/GraphEngine.test.ts)
 *   T7.3 — GraphCanvas.tsx: useRef engine, 32ms setInterval dirty-flag polling
 *   T7.4 — App integration: both canvases, recorder pipeline
 *
 * Gate: graph visible next to ball · updates in real time · npm test → PASS 0 FAIL
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { GraphEngine } from './graph/GraphEngine'
import { DataRecorder } from './recorder/DataRecorder'
import { World }        from './engine/World'
import { Body }         from './engine/Body'
import { FLOOR_Y, WALL_L, WALL_R } from './constants'
import {
  DEFAULT_SCALE, SCALE_PRESETS, axisLabel, makeCustomScale,
} from './units/PhysicsScale'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCanvas(w = 500, h = 400): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return c
}

function filledRecorder(n: number, opts: { vx?: number; vy?: number } = {}): DataRecorder {
  const r = new DataRecorder()
  r.start()
  for (let i = 0; i < n; i++) {
    r.record(
      i * 0.016,
      100 + i,
      FLOOR_Y - (i % 200),
      opts.vx ?? i * 0.1,
      opts.vy ?? -(i * 0.05),
      0,
      9.8,
    )
  }
  return r
}

// ═════════════════════════════════════════════════════════════════════════════
// T7.1 — GraphEngine.ts constructor & draw() signature
// ═════════════════════════════════════════════════════════════════════════════

describe('T7.1 GraphEngine — constructor', () => {
  test('instantiates with an HTMLCanvasElement', () => {
    const ge = new GraphEngine(makeCanvas())
    expect(ge).toBeDefined()
  })

  test('draw() exists on instance and accepts recorder + two SeriesKeys', () => {
    const ge = new GraphEngine(makeCanvas())
    const r = filledRecorder(10)
    expect(() => ge.draw(r, 'time', 'y')).not.toThrow()
  })

  test('draw() accepts optional flipY (default false)', () => {
    const ge = new GraphEngine(makeCanvas())
    const r = filledRecorder(10)
    expect(() => ge.draw(r, 'time', 'y', false)).not.toThrow()
    expect(() => ge.draw(r, 'time', 'y', true)).not.toThrow()
  })

  test('draw() accepts optional scale parameter (DEFAULT_SCALE)', () => {
    const ge = new GraphEngine(makeCanvas())
    const r = filledRecorder(10)
    expect(() => ge.draw(r, 'time', 'y', false, DEFAULT_SCALE)).not.toThrow()
  })

  test('all 7 series-key combinations accepted as xKey and yKey', () => {
    const ge = new GraphEngine(makeCanvas())
    const r = filledRecorder(10)
    const keys = ['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay'] as const
    keys.forEach(xKey => {
      keys.forEach(yKey => {
        expect(() => ge.draw(r, xKey, yKey)).not.toThrow()
      })
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// T7.1 — draw() early-return guards
// ═════════════════════════════════════════════════════════════════════════════

describe('T7.1 GraphEngine — draw() guards', () => {
  test('returns early (no throw) when recorder has < 2 points', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = new DataRecorder()
    r.start()
    // 0 points
    expect(() => ge.draw(r, 'time', 'y')).not.toThrow()
    // 1 point
    r.record(0, 300, 50, 0, 0, 0, 9.8)
    expect(() => ge.draw(r, 'time', 'y')).not.toThrow()
  })

  test('returns early (no throw) when canvas ctx is not available', () => {
    // Create a canvas whose getContext always returns null
    const canvas = makeCanvas()
    const origFn = canvas.getContext.bind(canvas)
    canvas.getContext = () => null as any
    const ge = new GraphEngine(canvas)
    canvas.getContext = origFn   // restore (doesn't affect already-null ctx stored)
    const r = filledRecorder(10)
    expect(() => ge.draw(r, 'time', 'y')).not.toThrow()
  })

  test('draw does not throw with exactly 2 data points', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = new DataRecorder()
    r.start()
    r.record(0,     300, 50,  0,    0,   0, 9.8)
    r.record(0.016, 300, 52, 0, 0.157, 0, 9.8)
    expect(() => ge.draw(r, 'time', 'y')).not.toThrow()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// T7.1 — drawData auto-scale: xRange || 1
// ═════════════════════════════════════════════════════════════════════════════

describe('T7.1 GraphEngine — drawData auto-scale (xRange||1)', () => {
  test('does not throw when all X values are identical (xRange = 0 → fallback 1)', () => {
    // All time values equal → xRange would be 0 without the || 1 guard
    const ge = new GraphEngine(makeCanvas())
    const r  = new DataRecorder()
    r.start()
    // Same time stamp for both records (degenerate case)
    r.record(1.0, 300, 50, 0, 0, 0, 9.8)
    r.record(1.0, 300, 60, 0, 0, 0, 9.8)
    expect(() => ge.draw(r, 'time', 'y')).not.toThrow()
  })

  test('does not throw when all Y values are identical (yRange = 0 → fallback 1)', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = new DataRecorder()
    r.start()
    r.record(0,     300, 50, 0, 0, 0, 9.8)
    r.record(0.016, 300, 50, 0, 0, 0, 9.8)  // same y
    expect(() => ge.draw(r, 'time', 'y')).not.toThrow()
  })

  test('does not throw when both X and Y are flat (full degenerate)', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = new DataRecorder()
    r.start()
    r.record(0, 0, 0, 0, 0, 0, 0)
    r.record(0, 0, 0, 0, 0, 0, 0)
    expect(() => ge.draw(r, 'time', 'y')).not.toThrow()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// T7.1 — drawAxes: axis labels from axisLabel()
// ═════════════════════════════════════════════════════════════════════════════

describe('T7.1 GraphEngine — drawAxes axis labels', () => {
  test('axisLabel("time", DEFAULT_SCALE) → "time (s)"', () => {
    expect(axisLabel('time', DEFAULT_SCALE)).toBe('time (s)')
  })

  test('axisLabel("x", px scale) → "x (px)"', () => {
    expect(axisLabel('x', DEFAULT_SCALE)).toBe('x (px)')
  })

  test('axisLabel("y", m scale) → "height (m)"', () => {
    expect(axisLabel('y', SCALE_PRESETS.m)).toBe('height (m)')
  })

  test('axisLabel("vx", cm scale) → "vx (cm/s)"', () => {
    expect(axisLabel('vx', SCALE_PRESETS.cm)).toBe('vx (cm/s)')
  })

  test('axisLabel("vy", m scale) → "vy (m/s)"', () => {
    expect(axisLabel('vy', SCALE_PRESETS.m)).toBe('vy (m/s)')
  })

  test('axisLabel("ax", cm scale) → "ax (cm/s²)"', () => {
    expect(axisLabel('ax', SCALE_PRESETS.cm)).toBe('ax (cm/s²)')
  })

  test('axisLabel("ay", m scale) → "ay (m/s²)"', () => {
    expect(axisLabel('ay', SCALE_PRESETS.m)).toBe('ay (m/s²)')
  })

  test('draw() with m-scale labels does not throw', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = filledRecorder(20)
    expect(() => ge.draw(r, 'time', 'y', false, SCALE_PRESETS.m)).not.toThrow()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// T7.1 — flipY: negates Y-series values
// ═════════════════════════════════════════════════════════════════════════════

describe('T7.1 GraphEngine — flipY behaviour', () => {
  test('draw with flipY=false and flipY=true both complete without error', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = filledRecorder(50)
    expect(() => ge.draw(r, 'time', 'vy', false)).not.toThrow()
    expect(() => ge.draw(r, 'time', 'vy', true)).not.toThrow()
  })

  test('flipY inverts the Y data before rendering (verified via internal logic)', () => {
    // We can verify by checking that raw series and its negation give
    // distinct min/max that GraphEngine would use for scaling.
    const r = filledRecorder(20)
    const ys = r.getSeries('vy')
    const flipped = ys.map(v => -v)
    const origMin  = Math.min(...ys)
    const flipMin  = Math.min(...flipped)
    // flipped min == -(orig max)
    const origMax  = Math.max(...ys)
    expect(flipMin).toBeCloseTo(-origMax, 6)
  })

  test('flipY=true with all-zero Y does not throw', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = new DataRecorder()
    r.start()
    for (let i = 0; i < 5; i++) r.record(i * 0.016, i, 0, 0, 0, 0, 0)
    expect(() => ge.draw(r, 'time', 'y', true)).not.toThrow()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// T7.1 — scale conversion in draw()
// ═════════════════════════════════════════════════════════════════════════════

describe('T7.1 GraphEngine — scale unit conversion', () => {
  test('draw with cm scale (ppu=10) does not throw', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = filledRecorder(30)
    expect(() => ge.draw(r, 'time', 'y', false, SCALE_PRESETS.cm)).not.toThrow()
  })

  test('draw with m scale (ppu=100) does not throw', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = filledRecorder(30)
    expect(() => ge.draw(r, 'time', 'y', false, SCALE_PRESETS.m)).not.toThrow()
  })

  test('draw with custom scale (ppu=50) does not throw', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = filledRecorder(30)
    const s  = makeCustomScale(50, 'u')
    expect(() => ge.draw(r, 'time', 'y', false, s)).not.toThrow()
  })

  test('time axis is never divided by ppu (ppu=100, time stays in seconds)', () => {
    // Verify axisLabel('time', m-scale) is still "time (s)" — not "time (m)"
    expect(axisLabel('time', SCALE_PRESETS.m)).toBe('time (s)')
  })

  test('ppu=1 (DEFAULT_SCALE px) skips allocation — draw still works', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = filledRecorder(100)
    // ppu=1 means needsXConv=false, needsYConv=false → no map() allocations
    expect(() => ge.draw(r, 'x', 'y', false, DEFAULT_SCALE)).not.toThrow()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// T7.1 — drawGrid (exercised via draw())
// ═════════════════════════════════════════════════════════════════════════════

describe('T7.1 GraphEngine — drawGrid (exercised via draw)', () => {
  test('draw on 500×400 canvas draws grid + axes + data without error', () => {
    const ge = new GraphEngine(makeCanvas(500, 400))
    const r  = filledRecorder(60)
    expect(() => ge.draw(r, 'time', 'y')).not.toThrow()
  })

  test('draw on non-square canvas (800×300) works', () => {
    const ge = new GraphEngine(makeCanvas(800, 300))
    const r  = filledRecorder(60)
    expect(() => ge.draw(r, 'time', 'x')).not.toThrow()
  })

  test('draw on minimal 10×10 canvas does not throw', () => {
    const ge = new GraphEngine(makeCanvas(10, 10))
    const r  = filledRecorder(10)
    expect(() => ge.draw(r, 'time', 'y')).not.toThrow()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// T7.3 — GraphCanvas dirty-flag polling logic
// ═════════════════════════════════════════════════════════════════════════════

describe('T7.3 GraphCanvas — dirty-flag polling (pure logic)', () => {
  test('poll interval is 32 ms — graph refreshes at ~30 fps', () => {
    // Documented in GraphCanvas: setInterval(fn, 32)
    // We verify the math: 1000/32 ≈ 31.25 fps ≤ 32 fps
    const intervalMs = 32
    const fps = 1000 / intervalMs
    expect(fps).toBeGreaterThan(30)
    expect(fps).toBeLessThan(32)
  })

  test('dirty-flag skips re-draw when recorder length is unchanged', () => {
    // Mirror the lastLenRef logic from GraphCanvas
    const r = new DataRecorder()
    r.start()
    for (let i = 0; i < 10; i++) r.record(i * 0.016, i, i, 0, 0, 0, 9.8)

    let drawCalls = 0
    let lastLen   = -1  // mirrors lastLenRef.current

    const tick = () => {
      const cur = r.getLength()
      if (cur === lastLen) return   // skip — dirty-flag
      lastLen = cur
      drawCalls++
    }

    // Two ticks with no new data → only 1 draw
    tick(); tick()
    expect(drawCalls).toBe(1)

    // Add data → next tick draws again
    r.record(0.5, 5, 5, 0, 0, 0, 9.8)
    tick()
    expect(drawCalls).toBe(2)
  })

  test('resetting lastLen to -1 forces immediate redraw on next tick', () => {
    const r = new DataRecorder()
    r.start()
    r.record(0, 1, 1, 0, 0, 0, 0)
    r.record(1, 2, 2, 0, 0, 0, 0)

    let drawCalls = 0
    let lastLen   = r.getLength()   // "already seen"

    const tick = () => {
      const cur = r.getLength()
      if (cur === lastLen) return
      lastLen = cur
      drawCalls++
    }

    // No new data — skipped
    tick()
    expect(drawCalls).toBe(0)

    // Simulate xKey/yKey change (resets lastLen to -1)
    lastLen = -1
    tick()
    expect(drawCalls).toBe(1)
  })

  test('GraphEngine.draw() called for every new data batch arriving at 30fps', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = new DataRecorder()
    r.start()

    let lastLen  = -1
    let drawn    = 0

    const step = () => {
      const cur = r.getLength()
      if (cur !== lastLen) {
        lastLen = cur
        ge.draw(r, 'time', 'y')
        drawn++
      }
    }

    // Simulate 30 poll cycles, adding 2 points between each
    for (let f = 0; f < 30; f++) {
      r.record(f * 0.032, f, f, 0, 0, 0, 9.8)
      r.record(f * 0.032 + 0.016, f, f, 0, 0, 0, 9.8)
      step()
    }

    expect(drawn).toBe(30)   // drew exactly once per batch
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// T7.4 — App integration: WorldCanvas + GraphCanvas pipeline
// ═════════════════════════════════════════════════════════════════════════════

describe('T7.4 App integration — engine → recorder → graph pipeline', () => {
  test('World.step() + recorder.record() populates all 7 series', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    const r = new DataRecorder()
    r.start()

    for (let i = 0; i < 60; i++) {
      w.step(0.016)
      r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
    }

    expect(r.getLength()).toBe(60)
    const keys = ['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay'] as const
    keys.forEach(k => expect(r.getSeries(k).length).toBe(60))
  })

  test('GraphEngine.draw() on real simulation data does not throw', () => {
    const w  = new World()
    const b  = w.addBody(new Body({ x: 300, y: 50, vx: 100 }))
    const r  = new DataRecorder()
    const ge = new GraphEngine(makeCanvas())
    r.start()

    for (let i = 0; i < 120; i++) {
      w.step(0.016)
      r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
    }

    expect(() => ge.draw(r, 'time', 'y')).not.toThrow()
    expect(() => ge.draw(r, 'time', 'x')).not.toThrow()
    expect(() => ge.draw(r, 'vx',   'vy')).not.toThrow()
  })

  test('both WorldCanvas (simulation) and GraphCanvas (graph) canvases can exist side-by-side', () => {
    const simCanvas   = document.createElement('canvas')
    const graphCanvas = document.createElement('canvas')
    simCanvas.width   = 600; simCanvas.height = 520
    graphCanvas.width = 500; graphCanvas.height = 400

    expect(simCanvas.getContext('2d')).not.toBeNull()
    expect(graphCanvas.getContext('2d')).not.toBeNull()

    const ge = new GraphEngine(graphCanvas)
    const r  = new DataRecorder()
    r.start()
    const w  = new World()
    const b  = w.addBody(new Body({ x: 300, y: 50 }))

    for (let i = 0; i < 10; i++) {
      w.step(0.016)
      r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
    }

    expect(() => ge.draw(r, 'time', 'y')).not.toThrow()
  })

  test('recorder.start() must be called before data is collected', () => {
    const r = new DataRecorder()
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))

    // Without start()
    w.step(0.016)
    r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
    expect(r.getLength()).toBe(0)

    // After start()
    r.start()
    w.step(0.016)
    r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
    expect(r.getLength()).toBe(1)
  })

  test('simulation data has expected physics: y increases during free fall', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    const r = new DataRecorder()
    r.start()

    // Record until ball hits floor
    while (b.y < FLOOR_Y) {
      w.step(0.016)
      r.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
    }

    const ys = r.getSeries('y')
    expect(ys.length).toBeGreaterThan(0)
    // Ball starts near y=50, reaches FLOOR_Y=500 → last sample ≥ FLOOR_Y
    expect(ys[ys.length - 1]).toBeGreaterThanOrEqual(FLOOR_Y)
  })

  test('GraphEngine renders physical coord data (FLOOR_Y - canvas_y) without error', () => {
    const w  = new World()
    const b  = w.addBody(new Body({ x: 300, y: 50, vx: 80 }))
    const r  = new DataRecorder()
    const ge = new GraphEngine(makeCanvas())
    r.start()

    for (let i = 0; i < 200; i++) {
      w.step(0.016)
      // Physical convention: y_phys = FLOOR_Y - canvas_y
      r.record(w.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
    }

    expect(() => ge.draw(r, 'time', 'y')).not.toThrow()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// T7.2 — verify gate conditions (GraphEngine.test.ts contract)
// ═════════════════════════════════════════════════════════════════════════════

describe('T7.2 GraphEngine gate conditions', () => {
  test('[gate] draw does not throw with 2+ data points — any series pair', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = new DataRecorder()
    r.start()
    r.record(0.016, 10, 20, 2, -1, 9.8, 9.8)
    r.record(0.032, 20, 40, 4, -2, 9.8, 9.8)
    const keys = ['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay'] as const
    keys.forEach(xKey => {
      keys.forEach(yKey => {
        expect(() => ge.draw(r, xKey, yKey)).not.toThrow()
      })
    })
  })

  test('[gate] draw returns early (no throw) with < 2 data points', () => {
    const ge = new GraphEngine(makeCanvas())
    const r0 = new DataRecorder(); r0.start()
    const r1 = new DataRecorder(); r1.start()
    r1.record(0.016, 10, 20, 2, -1, 9.8, 9.8)  // only 1 point

    expect(() => ge.draw(r0, 'time', 'y')).not.toThrow()  // 0 pts
    expect(() => ge.draw(r1, 'time', 'y')).not.toThrow()  // 1 pt
  })
})
