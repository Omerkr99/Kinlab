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
    // Clamp to [0, MAX_DT]: reject negative dt (time cannot go backward)
    const safeDt = Math.min(Math.max(dt, 0), MAX_DT)
    this.time += safeDt

    for (const b of this.bodies) {
      // Skip physics for resting bodies — avoids infinite micro-bounce loop.
      // Condition uses === FLOOR_Y (not >=) so bodies that start or are dragged
      // *below* the floor are NOT trapped: they bounce up to FLOOR_Y on the
      // next step and then get clamped normally.
      if (b.y === FLOOR_Y && b.vy === 0 && b.vx === 0 && b.ay === 0) continue

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
