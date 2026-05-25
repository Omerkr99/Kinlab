import { InteractionLayer } from './InteractionLayer'
import { Body } from './Body'

test('drag sets position and zeroes velocity', () => {
  const il = new InteractionLayer()
  const b = new Body({ vx: 10, vy: 5 })
  il.startDrag(b)
  il.updateDrag(200, 300)
  expect(b.x).toBe(200)
  expect(b.y).toBe(300)
  expect(b.vx).toBe(0)
  expect(b.vy).toBe(0)
})

test('pause/resume toggles flag', () => {
  const il = new InteractionLayer()
  il.pause()
  expect(il.isPaused()).toBe(true)
  il.resume()
  expect(il.isPaused()).toBe(false)
})

test('updateDrag no-ops without startDrag', () => {
  const il = new InteractionLayer()
  const b = new Body({ x: 0 })
  il.updateDrag(999, 999)
  expect(b.x).toBe(0)
})
