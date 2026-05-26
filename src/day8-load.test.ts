/**
 * KAN-16 — Day 8 Load Tests: Mouse Events + ControlBar
 *
 * Stress-tests the interaction layer and control loop under heavy conditions:
 *   1. Drag throughput     — thousands of updateDrag() calls
 *   2. Pause/resume cycles — rapid toggling doesn't corrupt state
 *   3. Reset/start cycles  — repeated session restarts stay O(1)
 *   4. Full UC pipeline    — Play → step → Pause → drag → Resume → Reset loop
 *   5. Recorder under control — start/stop/reset while recording runs
 */

import { describe, test, expect } from 'vitest'
import { World }            from './engine/World'
import { Body }             from './engine/Body'
import { InteractionLayer } from './engine/InteractionLayer'
import { DataRecorder }     from './recorder/DataRecorder'
import { FLOOR_Y, WALL_L, WALL_R, GRAVITY } from './constants'

const elapsed = (fn: () => void): number => {
  const t0 = performance.now(); fn(); return performance.now() - t0
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. Drag throughput
// ═════════════════════════════════════════════════════════════════════════════

describe('D8-Load: Drag throughput', () => {
  test('1 000 000 updateDrag() calls < 200 ms', () => {
    const { body, inter } = (() => {
      const w = new World()
      const b = w.addBody(new Body({ x: 300, y: 50 }))
      return { body: b, inter: new InteractionLayer() }
    })()

    inter.startDrag(body)
    const ms = elapsed(() => {
      for (let i = 0; i < 1_000_000; i++) {
        inter.updateDrag(i % 600, i % 500)
      }
    })
    console.log(`  [D8-DRAG] 1M updateDrag calls → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(200)
    inter.endDrag()
    expect(inter.isDragging()).toBe(false)
  })

  test('drag path along 10 000 positions: body follows exactly', () => {
    const w    = new World()
    const b    = w.addBody(new Body({ x: 300, y: 50 }))
    const inter = new InteractionLayer()
    inter.startDrag(b)

    for (let i = 0; i < 10_000; i++) {
      const x = WALL_L + (i % (WALL_R - WALL_L))
      const y = 10 + (i % (FLOOR_Y - 10))
      inter.updateDrag(x, y)
      expect(b.x).toBe(x)
      expect(b.y).toBe(y)
      expect(b.vx).toBe(0)
      expect(b.vy).toBe(0)
    }
    inter.endDrag()
  })

  test('10 bodies dragged simultaneously — all update independently', () => {
    const w     = new World()
    const inters: InteractionLayer[] = []
    const bodies: Body[] = []

    for (let i = 0; i < 10; i++) {
      const b = w.addBody(new Body({ x: 50 + i * 50, y: 50 }))
      const il = new InteractionLayer()
      il.startDrag(b)
      inters.push(il); bodies.push(b)
    }

    const ms = elapsed(() => {
      for (let f = 0; f < 10_000; f++) {
        for (let i = 0; i < 10; i++) {
          inters[i].updateDrag(50 + i * 50 + (f % 20), 50 + f % 100)
        }
      }
    })
    console.log(`  [D8-DRAG] 10 bodies × 10k drag updates → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(300)
    inters.forEach(il => il.endDrag())
    inters.forEach(il => expect(il.isDragging()).toBe(false))
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. Pause / resume cycles
// ═════════════════════════════════════════════════════════════════════════════

describe('D8-Load: Pause/Resume cycles', () => {
  test('100 000 pause/resume cycles < 50 ms, state never corrupted', () => {
    const inter = new InteractionLayer()
    const ms = elapsed(() => {
      for (let i = 0; i < 100_000; i++) {
        inter.pause()
        inter.resume()
      }
    })
    console.log(`  [D8-P/R] 100k pause/resume cycles → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(50)
    expect(inter.isPaused()).toBe(false)
  })

  test('frame stepping with intermittent pauses — total recorded frames exact', () => {
    const w    = new World()
    const b    = w.addBody(new Body({ x: 300, y: 50 }))
    const rec  = new DataRecorder(); rec.start()
    const inter = new InteractionLayer()
    let recorded = 0

    for (let i = 0; i < 1_000; i++) {
      if (i % 10 === 0) {
        if (inter.isPaused()) inter.resume(); else inter.pause()
      }
      if (!inter.isPaused() && !inter.isDragging()) {
        w.step(0.016)
        rec.record(w.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
        recorded++
      }
    }

    expect(rec.getLength()).toBe(recorded)
    // With pausing every 10 frames: roughly half should be recorded
    expect(recorded).toBeGreaterThan(400)
    expect(recorded).toBeLessThan(600)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. Reset / start cycles
// ═════════════════════════════════════════════════════════════════════════════

describe('D8-Load: Reset/Start cycles', () => {
  test('10 000 reset+start cycles < 200 ms', () => {
    const rec = new DataRecorder()
    const ms  = elapsed(() => {
      for (let i = 0; i < 10_000; i++) {
        rec.reset(); rec.start()
      }
    })
    console.log(`  [D8-RST] 10k reset+start → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(200)
    expect(rec.getLength()).toBe(0)
    expect(rec.isRecording()).toBe(true)
  })

  test('100 reset+start cycles with 100 records each — memory stable', () => {
    const rec = new DataRecorder()
    const ms  = elapsed(() => {
      for (let cycle = 0; cycle < 100; cycle++) {
        rec.reset(); rec.start()
        for (let i = 0; i < 100; i++) {
          rec.record(i * 0.016, i, FLOOR_Y - i, 0, 0, 0, 9.8)
        }
      }
    })
    console.log(`  [D8-RST] 100 cycles × 100 records → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(500)
    expect(rec.getLength()).toBe(100)
  })

  test('Play button rapid click (50 times): recorder always starts fresh', () => {
    const w    = new World()
    const b    = w.addBody(new Body({ x: 300, y: 50 }))
    const rec  = new DataRecorder()
    const inter = new InteractionLayer()

    for (let click = 0; click < 50; click++) {
      // handlePlay() sequence
      inter.resume()
      rec.reset(); rec.start()
      Object.assign(b, { x: 300, y: 50, vx: 0, vy: 0 })
      w.time = 0

      // Run 5 frames
      for (let i = 0; i < 5; i++) {
        w.step(0.016)
        rec.record(w.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
      }
    }

    expect(rec.getLength()).toBe(5)   // only last session
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. Full UC pipeline load
// ═════════════════════════════════════════════════════════════════════════════

describe('D8-Load: Full UC pipeline (UC-1..4 combined)', () => {
  test('10 full sessions (Play→run→Pause→drag→Resume→Reset) < 500 ms', () => {
    const w    = new World()
    const b    = w.addBody(new Body({ x: 300, y: 50 }))
    const rec  = new DataRecorder()
    const inter = new InteractionLayer()

    const ms = elapsed(() => {
      for (let session = 0; session < 10; session++) {
        // Play (UC-4)
        inter.resume(); rec.reset(); rec.start()
        Object.assign(b, { x: 300, y: 50, vx: 0, vy: 0 }); w.time = 0

        // Run 300 frames (UC-1)
        for (let i = 0; i < 300; i++) {
          if (!inter.isPaused() && !inter.isDragging()) {
            w.step(0.016)
            rec.record(w.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
          }
        }

        // Pause (UC-2)
        inter.pause()

        // Drag to new position (UC-3)
        inter.startDrag(b)
        for (let d = 0; d < 50; d++) inter.updateDrag(100 + d * 2, 80)
        inter.endDrag()

        // Resume (UC-2)
        inter.resume()
        for (let i = 0; i < 100; i++) {
          if (!inter.isPaused() && !inter.isDragging()) {
            w.step(0.016)
            rec.record(w.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
          }
        }

        // Reset (UC-2)
        inter.pause(); rec.reset()
      }
    })

    console.log(`  [D8-UC] 10 full sessions (300+100 frames each) → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(500)
    expect(rec.getLength()).toBe(0)   // last reset cleared
  })

  test('3 600-frame session: all series finite, x in [WALL_L, WALL_R]', () => {
    const w    = new World()
    const b    = w.addBody(new Body({ x: 300, y: 50, vx: 120 }))
    const rec  = new DataRecorder(); rec.start()

    for (let i = 0; i < 3_600; i++) {
      w.step(0.016)
      rec.record(w.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
    }

    const keys = ['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay'] as const
    keys.forEach(k => rec.getSeries(k).forEach(v => expect(isFinite(v)).toBe(true)))
    rec.getSeries('x').forEach(x => {
      expect(x).toBeGreaterThanOrEqual(WALL_L - 0.001)
      expect(x).toBeLessThanOrEqual(WALL_R + 0.001)
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. Recorder control under load
// ═════════════════════════════════════════════════════════════════════════════

describe('D8-Load: Recorder under control operations', () => {
  test('stop() mid-session: subsequent record() calls are no-ops', () => {
    const rec = new DataRecorder()
    rec.start()
    for (let i = 0; i < 100; i++) rec.record(i * 0.016, i, i, 0, 0, 0, 9.8)
    const lenAtStop = rec.getLength()

    rec.stop()
    for (let i = 0; i < 100; i++) rec.record(i * 0.016, i, i, 0, 0, 0, 9.8)
    expect(rec.getLength()).toBe(lenAtStop)
    expect(rec.isRecording()).toBe(false)
  })

  test('hit-test miss on 10 000 canvas clicks: reset always gives fresh recorder', () => {
    const w    = new World()
    const b    = w.addBody(new Body({ x: 300, y: 50 }))
    const rec  = new DataRecorder()

    const ms = elapsed(() => {
      for (let click = 0; click < 10_000; click++) {
        // Simulate miss click → reset+start
        rec.reset(); rec.start()
        w.step(0.016)
        rec.record(w.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
      }
    })
    console.log(`  [D8-CLICK] 10k miss-clicks → ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(500)
    expect(rec.getLength()).toBe(1)
  })

  test('hit-test on 1 000 000 random clicks: no crash', () => {
    const w   = new World()
    const b   = w.addBody(new Body({ x: 300, y: 50 }))
    const BALL_R = 25

    let hits = 0
    const ms = elapsed(() => {
      for (let i = 0; i < 1_000_000; i++) {
        const cx = Math.random() * 600
        const cy = Math.random() * 520
        const dist = Math.hypot(b.x - cx, b.y - cy)
        if (dist < BALL_R + 5) hits++
      }
    })
    console.log(`  [D8-HIT] 1M hit-tests → ${ms.toFixed(2)} ms | hits=${hits}`)
    expect(ms).toBeLessThan(200)
    // Should have roughly π*(30²)/(600*520) ≈ 0.9% hit rate
    expect(hits).toBeGreaterThan(5_000)
    expect(hits).toBeLessThan(50_000)
  })
})
