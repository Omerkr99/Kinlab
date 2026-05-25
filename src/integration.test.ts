import { World } from './engine/World'
import { Body } from './engine/Body'
import { DataRecorder } from './recorder/DataRecorder'
import { InteractionLayer } from './engine/InteractionLayer'
import { GraphEngine } from './graph/GraphEngine'

test('full pipeline: 30 steps captured with all 7 series', () => {
  const world = new World()
  const b = world.addBody(new Body({ x: 300, y: 50 }))
  const recorder = new DataRecorder()
  recorder.start()
  for (let i = 0; i < 30; i++) {
    world.step(0.016)
    recorder.record(world.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
  }
  expect(recorder.getLength()).toBe(30)
  const times = recorder.getSeries('time')
  expect(times[29]).toBeGreaterThan(times[0])
  expect(recorder.getSeries('y').length).toBe(30)
  expect(recorder.getSeries('vy').length).toBe(30)
})

test('pause stops data flow', () => {
  const world = new World()
  const b = world.addBody(new Body({ x: 300, y: 50 }))
  const recorder = new DataRecorder()
  const interaction = new InteractionLayer()
  recorder.start()
  world.step(0.016)
  recorder.record(world.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
  interaction.pause()
  expect(recorder.getLength()).toBe(1)
})

test('reset clears all recorder data', () => {
  const recorder = new DataRecorder()
  recorder.start()
  for (let i = 0; i < 10; i++) recorder.record(i * 0.016, i, i * 2, i * 0.5, i * -0.3, 9.8, 9.8)
  expect(recorder.getLength()).toBe(10)
  recorder.reset()
  expect(recorder.getLength()).toBe(0)
})

test('GraphEngine draws without throw', () => {
  const canvas = document.createElement('canvas')
  canvas.width = 500; canvas.height = 400
  const ge = new GraphEngine(canvas)
  const world = new World()
  const b = world.addBody(new Body({ x: 300, y: 50 }))
  const recorder = new DataRecorder()
  recorder.start()
  for (let i = 0; i < 5; i++) {
    world.step(0.016)
    recorder.record(world.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
  }
  expect(() => ge.draw(recorder, 'time', 'y')).not.toThrow()
  expect(() => ge.draw(recorder, 'y', 'vy')).not.toThrow()
  expect(() => ge.draw(recorder, 'time', 'ay')).not.toThrow()
})

test('UC-1: gravity moves body downward', () => {
  const world = new World()
  const b = world.addBody(new Body({ x: 300, y: 50 }))
  const startY = b.y
  for (let i = 0; i < 5; i++) world.step(0.016)
  expect(b.y).toBeGreaterThan(startY)
})

test('UC-2: isPaused blocks simulation', () => {
  const interaction = new InteractionLayer()
  interaction.pause()
  expect(interaction.isPaused()).toBe(true)
  interaction.resume()
  expect(interaction.isPaused()).toBe(false)
})

test('UC-3: drag repositions body and zeroes velocity', () => {
  const interaction = new InteractionLayer()
  const b = new Body({ x: 0, y: 0, vx: 50, vy: 30 })
  interaction.startDrag(b)
  interaction.updateDrag(400, 100)
  expect(b.x).toBe(400)
  expect(b.y).toBe(100)
  expect(b.vx).toBe(0)
  expect(b.vy).toBe(0)
})

test('UC-6: y-axis kinematics recorded correctly', () => {
  const world = new World()
  const b = world.addBody(new Body({ x: 300, y: 50 }))
  const recorder = new DataRecorder()
  recorder.start()
  for (let i = 0; i < 10; i++) {
    world.step(0.016)
    recorder.record(world.time, b.x, b.y, b.vx, b.vy, b.ax, b.ay)
  }
  const ys = recorder.getSeries('y')
  const vys = recorder.getSeries('vy')
  expect(ys[9]).toBeGreaterThan(ys[0])     // ball fell down
  expect(vys[0]).toBeGreaterThan(0)         // vy positive (downward)
})
