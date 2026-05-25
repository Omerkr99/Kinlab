import { Body } from './Body'
import { FLOOR_Y, GRAVITY } from '../constants'

const MAX_DT = 0.016
const DAMPING = 0.7
const FRICTION = 0.85
const VELOCITY_CLAMP = 0.2   // must be > GRAVITY*MAX_DT (9.8*0.016=0.157) so resting ball clamps

export class World {
  bodies: Body[] = []
  time = 0

  addBody(b: Body): Body {
    this.bodies.push(b)
    return b
  }

  step(dt: number): void {
    const safeDt = Math.min(dt, MAX_DT)
    this.time += safeDt

    for (const b of this.bodies) {
      // Euler integration
      b.ay = GRAVITY
      b.vx += b.ax * safeDt
      b.vy += b.ay * safeDt
      b.x += b.vx * safeDt
      b.y += b.vy * safeDt

      // Floor collision
      if (b.y >= FLOOR_Y) {
        b.y = FLOOR_Y
        b.vy = -b.vy * DAMPING
        b.vx *= FRICTION
      }

      // Velocity clamping — prevents infinite micro-bouncing
      if (Math.abs(b.vy) < VELOCITY_CLAMP && b.y >= FLOOR_Y) {
        b.vy = 0
        b.vx = 0
      }
    }
  }
}
