import { GraphEngine } from './GraphEngine'
import { DataRecorder } from '../recorder'

test('draw does not throw with 2+ points', () => {
  const c = document.createElement('canvas')
  c.width = 400; c.height = 300
  const ge = new GraphEngine(c)
  const r = new DataRecorder()
  r.start()
  r.record(0.016, 10, 20, 2, -1, 9.8, 9.8)
  r.record(0.032, 20, 40, 4, -2, 9.8, 9.8)
  expect(() => ge.draw(r, 'time', 'y')).not.toThrow()
  expect(() => ge.draw(r, 'y', 'vy')).not.toThrow()
})

test('draw returns early with fewer than 2 points', () => {
  const c = document.createElement('canvas')
  c.width = 400; c.height = 300
  const ge = new GraphEngine(c)
  const r = new DataRecorder()
  r.start()
  r.record(0.016, 10, 20, 2, -1, 9.8, 9.8)
  expect(() => ge.draw(r, 'time', 'x')).not.toThrow()
})
