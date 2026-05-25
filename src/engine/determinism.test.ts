import { World } from './World'
import { Body } from './Body'

const runSim = () => {
  const w = new World()
  const b = w.addBody(new Body({ x: 100, y: 0 }))
  for (let i = 0; i < 200; i++) w.step(0.016)
  return { x: b.x, y: b.y, vx: b.vx, vy: b.vy, t: w.time }
}

test('simulation is fully deterministic', () => {
  const r1 = runSim()
  const r2 = runSim()
  expect(r1).toEqual(r2)
})
