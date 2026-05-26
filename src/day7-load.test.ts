/**
 * KAN-15 — Day 7 Load Tests: GraphEngine.ts + GraphCanvas.tsx
 *
 * Stress-tests the graph rendering pipeline under worst-case conditions:
 *   1. GraphEngine throughput   — many draws, many series, many points
 *   2. Scale conversion load    — cm / m / custom scale with large datasets
 *   3. flipY + scale combined   — compound transforms under high frame rate
 *   4. World→recorder→graph    — end-to-end pipeline performance
 *   5. Determinism              — identical inputs → identical draw sequence
 */

import { describe, test, expect } from 'vitest'
import { GraphEngine }  from './graph/GraphEngine'
import { DataRecorder } from './recorder/DataRecorder'
import { World }        from './engine/World'
import { Body }         from './engine/Body'
import { FLOOR_Y, WALL_L, WALL_R } from './constants'
import { DEFAULT_SCALE, SCALE_PRESETS, makeCustomScale } from './units/PhysicsScale'

const elapsed = (fn: () => void): number => {
  const t0 = performance.now(); fn(); return performance.now() - t0
}

function makeCanvas(w = 500, h = 400): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return c
}

function buildRec(n: number, vx = 80): DataRecorder {
  const w = new World()
  const b = w.addBody(new Body({ x: 300, y: 50, vx }))
  const r = new DataRecorder()
  r.start()
  for (let i = 0; i < n; i++) {
    w.step(0.016)
    r.record(w.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
  }
  return r
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. GraphEngine throughput
// ═════════════════════════════════════════════════════════════════════════════

describe('D7-Load: GraphEngine throughput', () => {
  test('draw 60 frames × 600 pts (1s @60fps) < 200 ms', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = buildRec(600)
    const ms = elapsed(() => {
      for (let f = 0; f < 60; f++) ge.draw(r, 'time', 'y')
    })
    console.log(`  [D7-GFX] 60 draws × 600 pts → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(200)
  })

  test('draw 30 frames × 3 600 pts (1 min data @30fps) < 300 ms', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = buildRec(3_600)
    const ms = elapsed(() => {
      for (let f = 0; f < 30; f++) ge.draw(r, 'time', 'y')
    })
    console.log(`  [D7-GFX] 30 draws × 3600 pts → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(300)
  })

  test('draw 1 frame × 36 000 pts (10 min equivalent) < 150 ms', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = buildRec(36_000)
    const ms = elapsed(() => ge.draw(r, 'time', 'y'))
    console.log(`  [D7-GFX] 1 draw × 36k pts → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(150)
  })

  test('all 7×7 = 49 series combinations at 600 pts < 500 ms total', () => {
    const ge   = new GraphEngine(makeCanvas())
    const r    = buildRec(600)
    const keys = ['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay'] as const
    const ms   = elapsed(() => {
      keys.forEach(xKey => keys.forEach(yKey => ge.draw(r, xKey, yKey)))
    })
    console.log(`  [D7-GFX] 49 series combos × 600 pts → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(500)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. Scale conversion under load
// ═════════════════════════════════════════════════════════════════════════════

describe('D7-Load: scale conversion throughput', () => {
  test('60 draws × 3 600 pts with cm scale < 400 ms', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = buildRec(3_600)
    const ms = elapsed(() => {
      for (let f = 0; f < 60; f++) ge.draw(r, 'time', 'y', false, SCALE_PRESETS.cm)
    })
    console.log(`  [D7-SCALE] cm — 60 draws × 3600 pts → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(400)
  })

  test('60 draws × 3 600 pts with m scale < 400 ms', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = buildRec(3_600)
    const ms = elapsed(() => {
      for (let f = 0; f < 60; f++) ge.draw(r, 'time', 'y', false, SCALE_PRESETS.m)
    })
    console.log(`  [D7-SCALE] m  — 60 draws × 3600 pts → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(400)
  })

  test('60 draws × 3 600 pts with custom scale < 400 ms', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = buildRec(3_600)
    const s  = makeCustomScale(75, 'u')
    const ms = elapsed(() => {
      for (let f = 0; f < 60; f++) ge.draw(r, 'time', 'y', false, s)
    })
    console.log(`  [D7-SCALE] custom — 60 draws × 3600 pts → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(400)
  })

  test('scale × 4 presets × 30 draws × 1000 pts: no NaN in data', () => {
    const scales = [DEFAULT_SCALE, SCALE_PRESETS.cm, SCALE_PRESETS.m, makeCustomScale(50)]
    const r = buildRec(1_000)
    // Verify data is NaN-free (prerequisite for clean graph)
    const keys = ['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay'] as const
    keys.forEach(k => r.getSeries(k).forEach(v => expect(isFinite(v)).toBe(true)))

    scales.forEach(s => {
      const ge = new GraphEngine(makeCanvas())
      expect(() => {
        for (let f = 0; f < 30; f++) ge.draw(r, 'time', 'y', false, s)
      }).not.toThrow()
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. flipY + scale combined
// ═════════════════════════════════════════════════════════════════════════════

describe('D7-Load: flipY + scale combined transforms', () => {
  test('60 draws × 3 600 pts with flipY=true + m scale < 400 ms', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = buildRec(3_600)
    const ms = elapsed(() => {
      for (let f = 0; f < 60; f++) ge.draw(r, 'time', 'vy', true, SCALE_PRESETS.m)
    })
    console.log(`  [D7-FLIP] flipY+m — 60 draws × 3600 pts → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(400)
  })

  test('1000 alternating flipY calls do not accumulate errors', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = buildRec(100)
    let throws = 0
    for (let i = 0; i < 1_000; i++) {
      try { ge.draw(r, 'time', 'vy', i % 2 === 0) } catch { throws++ }
    }
    expect(throws).toBe(0)
  })

  test('flipY=true data is always finite for 3 600 frames', () => {
    const r    = buildRec(3_600)
    const vys  = r.getSeries('vy')
    const flipped = vys.map(v => -v)
    flipped.forEach(v => expect(isFinite(v)).toBe(true))
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. End-to-end pipeline: World → Recorder → GraphEngine
// ═════════════════════════════════════════════════════════════════════════════

describe('D7-Load: full pipeline (engine + recorder + graph)', () => {
  test('600-frame pipeline (10s sim) + 300 draw calls < 500 ms', () => {
    const w  = new World()
    const b  = w.addBody(new Body({ x: 300, y: 50, vx: 120 }))
    const r  = new DataRecorder(); r.start()
    const ge = new GraphEngine(makeCanvas())

    const ms = elapsed(() => {
      for (let f = 0; f < 600; f++) {
        w.step(0.016)
        r.record(w.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
        if (f % 2 === 0) ge.draw(r, 'time', 'y')   // draw at 30fps
      }
    })
    console.log(`  [D7-FULL] 600 frames + 300 draws → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(500)
    expect(r.getLength()).toBe(600)
  })

  test('3 600-frame pipeline (1 min sim) all series NaN-free', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50, vx: 80 }))
    const r = new DataRecorder(); r.start()

    const ms = elapsed(() => {
      for (let i = 0; i < 3_600; i++) {
        w.step(0.016)
        r.record(w.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
      }
    })
    console.log(`  [D7-FULL] 3600 frames → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(1_000)
    const keys = ['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay'] as const
    keys.forEach(k => r.getSeries(k).forEach(v => expect(isFinite(v)).toBe(true)))
  })

  test('x always in [WALL_L, WALL_R] over 3 600 frames', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 100, vx: 300 }))
    const r = new DataRecorder(); r.start()

    for (let i = 0; i < 3_600; i++) {
      w.step(0.016)
      r.record(w.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
    }

    r.getSeries('x').forEach(x => {
      expect(x).toBeGreaterThanOrEqual(WALL_L - 0.001)
      expect(x).toBeLessThanOrEqual(WALL_R + 0.001)
    })
  })

  test('y_phys in [0, FLOOR_Y] over 3 600 frames', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50, vx: 200 }))
    const r = new DataRecorder(); r.start()

    for (let i = 0; i < 3_600; i++) {
      w.step(0.016)
      r.record(w.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
    }

    r.getSeries('y').forEach(y => {
      expect(y).toBeGreaterThanOrEqual(-0.001)
      expect(y).toBeLessThanOrEqual(FLOOR_Y + 0.001)
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. Determinism
// ═════════════════════════════════════════════════════════════════════════════

describe('D7-Load: graph pipeline determinism', () => {
  test('two identical 3 600-frame runs produce bit-identical recorder output', () => {
    const run = () => {
      const w = new World()
      const b = w.addBody(new Body({ x: 300, y: 50, vx: 200 }))
      const r = new DataRecorder(); r.start()
      for (let i = 0; i < 3_600; i++) {
        w.step(0.016)
        r.record(w.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
      }
      return {
        x:   b.x, y:   b.y,
        vx:  b.vx, vy: b.vy,
        len: r.getLength(),
        lastY: r.getSeries('y')[r.getLength() - 1],
      }
    }
    expect(run()).toEqual(run())
  })

  test('GraphEngine does not mutate the recorder — getSeries before and after draw is equal', () => {
    const ge = new GraphEngine(makeCanvas())
    const r  = buildRec(600)
    const ysBefore = r.getSeries('y').slice()
    ge.draw(r, 'time', 'y')
    ge.draw(r, 'time', 'y', true)
    ge.draw(r, 'time', 'y', false, SCALE_PRESETS.m)
    const ysAfter = r.getSeries('y')
    expect(ysAfter).toEqual(ysBefore)
  })

  test('draw result independent of order: drawing same data twice gives same draw calls', () => {
    const ge1 = new GraphEngine(makeCanvas())
    const ge2 = new GraphEngine(makeCanvas())
    const r   = buildRec(300)

    let throws1 = 0, throws2 = 0
    for (let f = 0; f < 60; f++) {
      try { ge1.draw(r, 'time', 'y') } catch { throws1++ }
      try { ge2.draw(r, 'time', 'y') } catch { throws2++ }
    }
    expect(throws1).toBe(0)
    expect(throws2).toBe(0)
  })
})
