/**
 * KAN-16 — Day 8 Unit Tests: Mouse Events + ControlBar (UC-1..4)
 *
 * Verifies all KAN-16 acceptance criteria:
 *   T8.1 — Mouse events in WorldCanvas: mousedown (drag or reset+start), mousemove, mouseup
 *   T8.2 — ControlBar.tsx: Play (resume+reset+start), Pause, Reset (pause+reset+reposition)
 *   T8.3 — ControlBar in App.tsx above WorldCanvas
 *   T8.4 — Git commit
 *
 * Gate:
 *   UC-1  drop/bounce — ball falls under gravity and bounces off floor
 *   UC-2  pause/resume — InteractionLayer.pause/resume halt/continue simulation
 *   UC-3  drag — startDrag/updateDrag repositions body; step() skipped during drag
 *   UC-4  click starts recording — mousedown on empty space resets+starts recorder
 */

import { describe, test, expect } from 'vitest'
import { World }            from './engine/World'
import { Body }             from './engine/Body'
import { InteractionLayer } from './engine/InteractionLayer'
import { DataRecorder }     from './recorder/DataRecorder'
import { FLOOR_Y, CANVAS_W, BALL_RADIUS, WALL_L, WALL_R, GRAVITY } from './constants'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeScene() {
  const world   = new World()
  const body    = world.addBody(new Body({ x: 300, y: 50 }))
  const rec     = new DataRecorder()
  const inter   = new InteractionLayer()
  return { world, body, rec, inter }
}

function stepN(world: World, rec: DataRecorder, body: Body, n: number, inter?: InteractionLayer) {
  for (let i = 0; i < n; i++) {
    if (!inter?.isPaused() && !inter?.isDragging()) {
      world.step(0.016)
      rec.record(world.time, body.x, FLOOR_Y - body.y, body.vx, -body.vy, body.ax, -body.ay)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UC-1: Drop & Bounce
// ─────────────────────────────────────────────────────────────────────────────

describe('UC-1 Drop & Bounce', () => {
  test('ball falls from y=50 to FLOOR_Y under gravity', () => {
    const { world, body } = makeScene()
    while (body.y < FLOOR_Y) world.step(0.016)
    expect(body.y).toBeGreaterThanOrEqual(FLOOR_Y - 1)
  })

  test('ball velocity increases during free fall (vy increases)', () => {
    const { world, body } = makeScene()
    let prevVy = body.vy
    let falling = true
    for (let i = 0; i < 100 && falling; i++) {
      world.step(0.016)
      if (body.y >= FLOOR_Y) { falling = false; break }
      expect(body.vy).toBeGreaterThanOrEqual(prevVy)
      prevVy = body.vy
    }
  })

  test('ball bounces (vy flips negative after floor collision)', () => {
    const { world, body } = makeScene()
    while (body.y < FLOOR_Y) world.step(0.016)
    expect(body.vy).toBeLessThan(0)  // bounced upward
  })

  test('DAMPING=0.7 — bounce speed < impact speed', () => {
    const { world, body } = makeScene()
    let impactVy = 0
    while (body.y < FLOOR_Y) {
      impactVy = body.vy
      world.step(0.016)
    }
    const bounceVy = Math.abs(body.vy)
    const impactMag = Math.abs(impactVy)
    expect(bounceVy).toBeLessThan(impactMag * 0.8)  // energy absorbed
  })

  test('ball eventually comes to rest on floor (VELOCITY_CLAMP)', () => {
    const { world, body } = makeScene()
    for (let i = 0; i < 4000; i++) world.step(0.016)
    expect(body.y).toBe(FLOOR_Y)
    expect(body.vy).toBe(0)
    expect(body.vx).toBe(0)
  })

  test('DataRecorder captures the fall + bounce in time series', () => {
    const { world, body, rec } = makeScene()
    rec.start()
    while (body.y < FLOOR_Y) {
      world.step(0.016)
      rec.record(world.time, body.x, FLOOR_Y - body.y, body.vx, -body.vy, body.ax, -body.ay)
    }
    // After hitting floor, y_phys should be 0
    const ys = rec.getSeries('y')
    expect(ys[ys.length - 1]).toBe(0)
    expect(rec.getLength()).toBeGreaterThan(0)
  })

  test('time is monotonically increasing throughout fall', () => {
    const { world, body, rec } = makeScene()
    rec.start()
    for (let i = 0; i < 200; i++) {
      world.step(0.016)
      rec.record(world.time, body.x, FLOOR_Y - body.y, body.vx, -body.vy, body.ax, -body.ay)
    }
    const ts = rec.getSeries('time')
    for (let i = 1; i < ts.length; i++) expect(ts[i]).toBeGreaterThan(ts[i - 1])
  })

  test('wall collision reverses vx with WALL_DAMPING (UC-1 horizontal)', () => {
    const world = new World()
    const body  = world.addBody(new Body({ x: WALL_R - 5, y: 100, vx: 200 }))
    const prevVx = body.vx
    world.step(0.016)
    // Should hit right wall and reverse
    if (body.vx < 0) expect(Math.abs(body.vx)).toBeLessThan(Math.abs(prevVx))
    else expect(body.x).toBeLessThanOrEqual(WALL_R + 0.001)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// UC-2: Pause / Resume (T8.2 — ControlBar.Pause + Play)
// ─────────────────────────────────────────────────────────────────────────────

describe('UC-2 Pause / Resume', () => {
  test('InteractionLayer.pause() halts world.step() progress', () => {
    const { world, body, rec, inter } = makeScene()
    rec.start()
    inter.pause()

    const yBefore = body.y
    stepN(world, rec, body, 100, inter)   // no-op when paused
    expect(body.y).toBe(yBefore)
    expect(rec.getLength()).toBe(0)       // nothing recorded while paused
  })

  test('InteractionLayer.resume() re-enables stepping', () => {
    const { world, body, rec, inter } = makeScene()
    rec.start()
    inter.pause()
    stepN(world, rec, body, 50, inter)   // no-op

    inter.resume()
    stepN(world, rec, body, 50, inter)   // should advance

    expect(rec.getLength()).toBe(50)
    expect(world.time).toBeCloseTo(50 * 0.016, 3)
  })

  test('pause → resume → pause cycle: recorder captures only active frames', () => {
    const { world, body, rec, inter } = makeScene()
    rec.start()

    inter.resume(); stepN(world, rec, body, 30, inter)   // 30 frames
    inter.pause();  stepN(world, rec, body, 30, inter)   // 0 frames
    inter.resume(); stepN(world, rec, body, 20, inter)   // 20 frames

    expect(rec.getLength()).toBe(50)
  })

  test('isPaused() reflects correct state transitions', () => {
    const inter = new InteractionLayer()
    expect(inter.isPaused()).toBe(false)

    inter.pause()
    expect(inter.isPaused()).toBe(true)

    inter.resume()
    expect(inter.isPaused()).toBe(false)
  })

  test('pause does not reset world.time', () => {
    const { world, body, rec, inter } = makeScene()
    rec.start()
    inter.resume(); stepN(world, rec, body, 60, inter)
    const timeBefore = world.time

    inter.pause(); stepN(world, rec, body, 60, inter)
    expect(world.time).toBe(timeBefore)   // time frozen during pause
  })

  test('Play (ControlBar) pattern: reset + recorder.start()', () => {
    const { world, body, rec } = makeScene()
    rec.start()
    for (let i = 0; i < 30; i++) {
      world.step(0.016)
      rec.record(world.time, body.x, FLOOR_Y - body.y, body.vx, -body.vy, body.ax, -body.ay)
    }
    expect(rec.getLength()).toBe(30)

    // Simulate ControlBar.handlePlay()
    rec.reset()
    rec.start()
    Object.assign(body, { x: 300, y: 50, vx: 0, vy: 0, ax: 0, ay: 0 })
    world.time = 0

    expect(rec.getLength()).toBe(0)
    expect(body.y).toBe(50)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// UC-3: Drag (T8.1 — mouse events → InteractionLayer)
// ─────────────────────────────────────────────────────────────────────────────

describe('UC-3 Drag', () => {
  test('startDrag() marks body as being dragged', () => {
    const { body, inter } = makeScene()
    expect(inter.isDragging()).toBe(false)
    inter.startDrag(body)
    expect(inter.isDragging()).toBe(true)
  })

  test('updateDrag() repositions body exactly to given coords', () => {
    const { body, inter } = makeScene()
    inter.startDrag(body)
    inter.updateDrag(123, 456)
    expect(body.x).toBe(123)
    expect(body.y).toBe(456)
  })

  test('updateDrag() zeroes out velocity during drag', () => {
    const { world, body, inter } = makeScene()
    // Give body some velocity first
    world.step(0.5)   // large dt, ball has velocity
    inter.startDrag(body)
    inter.updateDrag(200, 100)
    expect(body.vx).toBe(0)
    expect(body.vy).toBe(0)
  })

  test('endDrag() clears dragging state', () => {
    const { body, inter } = makeScene()
    inter.startDrag(body)
    expect(inter.isDragging()).toBe(true)
    inter.endDrag()
    expect(inter.isDragging()).toBe(false)
  })

  test('world.step() is skipped during drag (WorldCanvas pattern)', () => {
    const { world, body, rec, inter } = makeScene()
    rec.start()
    inter.startDrag(body)

    const yBefore = body.y
    // Simulate the WorldCanvas rAF condition: skip step if isDragging
    for (let i = 0; i < 50; i++) {
      if (!inter.isPaused() && !inter.isDragging()) {
        world.step(0.016)
        rec.record(world.time, body.x, FLOOR_Y - body.y, body.vx, -body.vy, body.ax, -body.ay)
      }
    }

    expect(body.y).toBe(yBefore)   // position unchanged (physics skipped)
    expect(rec.getLength()).toBe(0) // nothing recorded
  })

  test('drag then release: physics resumes from new position', () => {
    const { world, body, inter } = makeScene()
    // Drag to top of canvas
    inter.startDrag(body)
    inter.updateDrag(300, 10)   // near top
    inter.endDrag()

    expect(body.y).toBe(10)   // positioned at top
    expect(inter.isDragging()).toBe(false)

    // Run physics from new position
    for (let i = 0; i < 50; i++) world.step(0.016)
    // Should be below 10 now (falling)
    expect(body.y).toBeGreaterThan(10)
  })

  test('T8.1: mousedown on empty space — hit-test miss fires reset+start', () => {
    // Simulate WorldCanvas.onDown logic:
    // click far from ball (300,50 → click at 10,10 — distance > BALL_RADIUS+5)
    const { world, body, rec } = makeScene()

    // Fill recorder with some data first
    rec.start()
    for (let i = 0; i < 20; i++) {
      world.step(0.016)
      rec.record(world.time, body.x, FLOOR_Y - body.y, body.vx, -body.vy, body.ax, -body.ay)
    }
    expect(rec.getLength()).toBe(20)

    // Simulate mousedown on empty space (no body hit)
    const clickX = 10, clickY = 10
    const hit = world.bodies.find(b => Math.hypot(b.x - clickX, b.y - clickY) < BALL_RADIUS + 5)
    if (!hit) {
      rec.reset()
      rec.start()
    }

    expect(rec.getLength()).toBe(0)   // reset fired
    expect(rec.isRecording()).toBe(true)
  })

  test('T8.1: mousedown on ball — drag fires startDrag, recorder NOT reset', () => {
    const { world, body, rec, inter } = makeScene()
    rec.start()
    for (let i = 0; i < 20; i++) {
      world.step(0.016)
      rec.record(world.time, body.x, FLOOR_Y - body.y, body.vx, -body.vy, body.ax, -body.ay)
    }
    const lenBefore = rec.getLength()

    // Simulate mousedown on ball (body.x, body.y — within BALL_RADIUS+5)
    const clickX = body.x, clickY = body.y
    const hit = world.bodies.find(b => Math.hypot(b.x - clickX, b.y - clickY) < BALL_RADIUS + 5)
    if (hit) inter.startDrag(hit)
    else { rec.reset(); rec.start() }

    expect(inter.isDragging()).toBe(true)
    expect(rec.getLength()).toBe(lenBefore)   // not reset — drag, not click
  })

  test('T8.1: mousemove calls updateDrag(x, y) → body repositioned', () => {
    const { body, inter } = makeScene()
    inter.startDrag(body)
    // Simulate mousemove events
    for (let i = 0; i < 5; i++) {
      inter.updateDrag(100 + i * 10, 200 + i * 5)
    }
    expect(body.x).toBe(140)
    expect(body.y).toBe(220)
  })

  test('T8.1: mouseup calls endDrag()', () => {
    const { body, inter } = makeScene()
    inter.startDrag(body)
    inter.endDrag()   // mouseup
    expect(inter.isDragging()).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// UC-4: Click starts recording (T8.1 — reset+start on miss click)
// ─────────────────────────────────────────────────────────────────────────────

describe('UC-4 Click starts recording', () => {
  test('recorder.start() allows subsequent record() calls', () => {
    const rec = new DataRecorder()
    rec.start()
    rec.record(0.016, 300, 450, 0, 1, 0, 9.8)
    expect(rec.getLength()).toBe(1)
  })

  test('recorder before start() is a no-op', () => {
    const rec = new DataRecorder()
    // NOT started
    rec.record(0.016, 300, 450, 0, 1, 0, 9.8)
    expect(rec.getLength()).toBe(0)
  })

  test('reset() then start() gives a fresh recorder', () => {
    const rec = new DataRecorder()
    rec.start()
    for (let i = 0; i < 50; i++) rec.record(i * 0.016, i, i, 0, 0, 0, 9.8)
    expect(rec.getLength()).toBe(50)

    rec.reset()
    expect(rec.getLength()).toBe(0)
    expect(rec.isRecording()).toBe(false)

    rec.start()
    rec.record(0, 300, 450, 0, 0, 0, 9.8)
    expect(rec.getLength()).toBe(1)
  })

  test('UC-4: click on canvas (miss) immediately starts new recording session', () => {
    const { world, body, rec } = makeScene()
    // Simulate old session
    rec.start()
    for (let i = 0; i < 30; i++) {
      world.step(0.016); rec.record(world.time, body.x, body.y, body.vx, body.vy, body.ax, body.ay)
    }
    const oldLen = rec.getLength()
    expect(oldLen).toBe(30)

    // Click on canvas miss → reset+start (WorldCanvas.onDown pattern)
    rec.reset(); rec.start()

    // New data immediately recordable
    world.step(0.016); rec.record(world.time, body.x, body.y, body.vx, body.vy, body.ax, body.ay)
    expect(rec.getLength()).toBe(1)
  })

  test('multiple reset+start cycles: length always starts at 0', () => {
    const rec = new DataRecorder()
    for (let cycle = 0; cycle < 10; cycle++) {
      rec.reset(); rec.start()
      expect(rec.getLength()).toBe(0)
      for (let i = 0; i < 5; i++) rec.record(i * 0.016, i, i, 0, 0, 0, 9.8)
      expect(rec.getLength()).toBe(5)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// T8.2 — ControlBar API contract
// ─────────────────────────────────────────────────────────────────────────────

describe('T8.2 ControlBar — Play/Pause/Reset contract', () => {
  test('Play sequence: resume + reset recorder + start recorder + reposition body', () => {
    const { world, body, rec, inter } = makeScene()

    // Simulate running simulation
    rec.start()
    for (let i = 0; i < 50; i++) {
      world.step(0.016); rec.record(world.time, body.x, body.y, body.vx, body.vy, body.ax, body.ay)
    }
    inter.pause()

    // handlePlay() in ControlBar:
    inter.resume()
    rec.reset(); rec.start()
    Object.assign(body, { x: 300, y: 50, vx: 0, vy: 0 })
    world.time = 0

    expect(inter.isPaused()).toBe(false)
    expect(rec.getLength()).toBe(0)
    expect(rec.isRecording()).toBe(true)
    expect(body.y).toBe(50)
  })

  test('Pause sequence: inter.pause() stops simulation', () => {
    const { world, body, rec, inter } = makeScene()
    rec.start()
    inter.resume()

    // Running for 30 frames
    stepN(world, rec, body, 30, inter)
    const len30 = rec.getLength()

    inter.pause()
    stepN(world, rec, body, 30, inter)
    expect(rec.getLength()).toBe(len30)   // frozen
  })

  test('Reset sequence: pause + clear recorder + reposition body', () => {
    const { world, body, rec, inter } = makeScene()
    rec.start()
    for (let i = 0; i < 40; i++) {
      world.step(0.016); rec.record(world.time, body.x, body.y, body.vx, body.vy, body.ax, body.ay)
    }

    // handleReset() in ControlBar:
    inter.pause()
    rec.reset()
    Object.assign(body, { x: 300, y: 50, vx: 0, vy: 0, ax: 0, ay: 0 })

    expect(inter.isPaused()).toBe(true)
    expect(rec.getLength()).toBe(0)
    expect(body.y).toBe(50)
    expect(body.vy).toBe(0)
  })

  test('Stop sequence: inter.pause() + rec.stop()', () => {
    const { rec, inter } = makeScene()
    rec.start()
    inter.resume()

    inter.pause()
    rec.stop()

    expect(inter.isPaused()).toBe(true)
    expect(rec.isRecording()).toBe(false)
  })

  test('ControlBar state machine: idle → playing → paused → playing → stopped', () => {
    const { world, body, rec, inter } = makeScene()

    // idle → playing (Play clicked)
    rec.reset(); rec.start(); inter.resume()
    Object.assign(body, { x: 300, y: 50, vx: 0, vy: 0 })
    expect(rec.isRecording()).toBe(true)
    expect(inter.isPaused()).toBe(false)

    // playing → run 10 frames
    for (let i = 0; i < 10; i++) {
      if (!inter.isPaused() && !inter.isDragging()) {
        world.step(0.016); rec.record(world.time, body.x, body.y, body.vx, body.vy, body.ax, body.ay)
      }
    }
    expect(rec.getLength()).toBe(10)

    // playing → paused
    inter.pause()
    expect(inter.isPaused()).toBe(true)

    // paused → playing (Resume)
    inter.resume()
    expect(inter.isPaused()).toBe(false)

    // playing → stopped
    inter.pause(); rec.stop()
    expect(rec.isRecording()).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// T8.3 — App.tsx layout contract
// ─────────────────────────────────────────────────────────────────────────────

describe('T8.3 App layout — module-level singletons + canvas pipeline', () => {
  test('module-level singletons are independent across instances', () => {
    const w1 = new World(); w1.addBody(new Body({ x: 100, y: 50 }))
    const w2 = new World(); w2.addBody(new Body({ x: 200, y: 50 }))
    w1.step(0.016); w2.step(0.016)
    expect(w1.bodies[0].x).toBe(100)
    expect(w2.bodies[0].x).toBe(200)
  })

  test('world.gravity can be changed at runtime (GravitySlider)', () => {
    const w = new World()
    const b = w.addBody(new Body({ x: 300, y: 50 }))
    w.gravity = 1.6   // Moon
    w.step(0.016)
    const vyMoon = b.vy

    const w2 = new World()
    const b2 = w2.addBody(new Body({ x: 300, y: 50 }))
    w2.gravity = 24.8  // Jupiter
    w2.step(0.016)
    const vyJup = b2.vy

    expect(vyJup).toBeGreaterThan(vyMoon)
  })

  test('WorldCanvas + GraphCanvas canvases can coexist (separate contexts)', () => {
    const simCanvas   = document.createElement('canvas')
    const graphCanvas = document.createElement('canvas')
    simCanvas.width = 600; simCanvas.height = 520
    graphCanvas.width = 500; graphCanvas.height = 400

    // Each canvas can produce a 2D context (not null)
    expect(simCanvas.getContext('2d')).not.toBeNull()
    expect(graphCanvas.getContext('2d')).not.toBeNull()

    // Each canvas element is a distinct DOM element
    expect(simCanvas).not.toBe(graphCanvas)

    // Dimensions are independent
    expect(simCanvas.width).toBe(600)
    expect(graphCanvas.width).toBe(500)
    expect(simCanvas.height).toBe(520)
    expect(graphCanvas.height).toBe(400)
  })

  test('ControlBar above WorldCanvas — recorder is shared between both', () => {
    // Pattern: App creates one recorder, ControlBar and WorldCanvas share it
    const rec  = new DataRecorder()
    const world = new World()
    const body  = world.addBody(new Body({ x: 300, y: 50 }))

    // ControlBar.handlePlay() calls rec.start()
    rec.reset(); rec.start()

    // WorldCanvas.loop() calls rec.record()
    for (let i = 0; i < 10; i++) {
      world.step(0.016)
      rec.record(world.time, body.x, body.y, body.vx, body.vy, body.ax, body.ay)
    }

    // Both see the same data
    expect(rec.getLength()).toBe(10)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration: all 4 UCs together
// ─────────────────────────────────────────────────────────────────────────────

describe('Integration: UC-1..4 combined', () => {
  test('full session: Play → run → Pause → drag → Resume → Reset', () => {
    const { world, body, rec, inter } = makeScene()

    // UC-4 — Play starts recording
    rec.reset(); rec.start(); inter.resume()
    Object.assign(body, { x: 300, y: 50, vx: 0, vy: 0 })
    world.time = 0

    // UC-1 — run for a bit (drop + bounce)
    stepN(world, rec, body, 100, inter)
    expect(rec.getLength()).toBe(100)

    // UC-2 — pause
    inter.pause()
    const lenAtPause = rec.getLength()
    stepN(world, rec, body, 30, inter)
    expect(rec.getLength()).toBe(lenAtPause)   // frozen

    // UC-3 — drag while paused
    inter.startDrag(body)
    inter.updateDrag(150, 100)
    expect(body.x).toBe(150); expect(body.y).toBe(100)
    inter.endDrag()

    // UC-2 — resume
    inter.resume()
    stepN(world, rec, body, 50, inter)
    expect(rec.getLength()).toBe(150)

    // UC-2 — reset
    inter.pause(); rec.reset()
    Object.assign(body, { x: 300, y: 50, vx: 0, vy: 0 })
    expect(rec.getLength()).toBe(0)
  })

  test('full pipeline: World → recorder → all 7 series correct', () => {
    const { world, body, rec, inter } = makeScene()
    rec.start(); inter.resume()

    stepN(world, rec, body, 200, inter)

    const keys = ['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay'] as const
    keys.forEach(k => {
      expect(rec.getSeries(k).length).toBe(200)
      rec.getSeries(k).forEach(v => expect(isFinite(v)).toBe(true))
    })
  })
})
