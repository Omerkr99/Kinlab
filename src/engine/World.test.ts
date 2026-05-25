import { World } from './World'
import { Body } from './Body'

test('body falls under gravity', () => {
  const w = new World()
  const b = w.addBody(new Body({ x: 0, y: 0 }))
  w.step(0.016)
  expect(b.vy).toBeGreaterThan(0)
  expect(b.y).toBeGreaterThan(0)
})

test('world time advances by dt', () => {
  const w = new World()
  w.step(0.016)
  expect(w.time).toBeCloseTo(0.016)
})

test('dt is capped at MAX_DT', () => {
  const w = new World()
  const b = w.addBody(new Body())
  w.step(1.0)
  expect(b.vy).toBeCloseTo(9.8 * 0.016, 3)
})

test('body bounces off floor', () => {
  const w = new World()
  // start AT the floor with downward velocity so collision triggers in step 1
  // after step: vy = 5+0.157=5.157, y = 500+0.083=500.08 → bounce → vy = -3.61 < 0
  const b = w.addBody(new Body({ y: 500, vy: 5 }))
  w.step(0.016)
  expect(b.y).toBeLessThanOrEqual(500)
  expect(b.vy).toBeLessThan(0)
})

test('tiny velocity clamped to zero at floor', () => {
  const w = new World()
  const b = w.addBody(new Body({ y: 500, vy: 0.05 }))
  w.step(0.016)
  expect(b.vy).toBe(0)
})
