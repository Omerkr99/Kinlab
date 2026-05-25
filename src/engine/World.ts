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
      // Skip physics entirely for resting bodies — avoids infinite micro-bounce loop.
      // A body is at rest when it is on the floor, has been clamped (vy===0, vx===0),
      // and carries zero net acceleration.  Dragging the ball above the floor will
      // naturally break this condition (b.y < FLOOR_Y) and wake it back up.
      if (b.y >= FLOOR_Y && b.vy === 0 && b.vx === 0 && b.ay === 0) continue

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

      // Velocity clamping — prevents infinite micro-bouncing.
      // Also zeroes ay so recorded data shows net acceleration = 0 at rest.
      if (Math.abs(b.vy) < VELOCITY_CLAMP && b.y >= FLOOR_Y) {
        b.vy = 0
        b.vx = 0
        b.ay = 0   // net acceleration = 0 at rest (normal force cancels gravity)
      }
    }
  }
}
