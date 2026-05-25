import { World } from './engine/World'
import { Body } from './engine/Body'
import { DataRecorder } from './recorder/DataRecorder'
import { InteractionLayer } from './engine/InteractionLayer'
import { GraphEngine } from './graph/GraphEngine'

test('full pipeline: 30 steps captured', () => {
  const world = new World()
  const b = world.addBody(new Body({ x: 300, y: 50 }))
  const recorder = new DataRecorder()
  recorder.start()
  for (let i = 0; i < 30; i++) {
    world.step(0.016)
    recorder.record(world.time, b.x, b.vx, b.ax)
  }
  expect(recorder.getLength()).toBe(30)
  const times = recorder.getSeries('time')
  expect(times[29]).toBeGreaterThan(times[0])
})

test('pause stops data flow', () => {
  const world = new World()
  const b = world.addBody(new Body({ x: 300, y: 50 }))
  const recorder = new DataRecorder()
  const interaction = new InteractionLayer()
  recorder.start()
  world.step(0.016)
  recorder.record(world.time, b.x, b.vx, b.ax)
  interaction.pause()
  expect(recorder.getLength()).toBe(1)
})

test('reset clears all recorder data', () => {
  const recorder = new DataRecorder()
  recorder.start()
  for (let i = 0; i < 10; i++) recorder.record(i * 0.016, i, i * 0.5, 9.8)
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
    recorder.record(world.time, b.x, b.vx, b.ax)
  }
  expect(() => ge.draw(recorder, 'time', 'x')).not.toThrow()
  expect(() => ge.draw(recorder, 'x', 'vx')).not.toThrow()
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
