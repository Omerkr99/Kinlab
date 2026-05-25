import { Body } from '../engine/Body'

test('body initializes with defaults', () => {
  const b = new Body()
  expect(b.x).toBe(0)
  expect(b.ay).toBe(0)
})

test('body accepts partial init', () => {
  const b = new Body({ x: 10, vy: 5 })
  expect(b.x).toBe(10)
  expect(b.vy).toBe(5)
  expect(b.ax).toBe(0)
})
