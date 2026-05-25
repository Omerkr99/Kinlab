import { Body } from './Body'
import { FLOOR_Y, GRAVITY, WALL_L, WALL_R, WALL_DAMPING } from '../constants'

const MAX_DT         = 0.016
const DAMPING        = 0.7    // floor bounce energy retention
const FRICTION       = 0.85   // floor horizontal friction
const VELOCITY_CLAMP = 0.2    // must be > GRAVITY*MAX_DT (9.8*0.016=0.157)

export class World {
  bodies: Body[] = []
  time   = 0
  gravity = GRAVITY   // KAN-45: mutable — gravity slider writes here at runtime

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
      // Uses === FLOOR_Y so bodies dragged/placed below floor are NOT trapped.
      if (b.y === FLOOR_Y && b.vy === 0 && b.vx === 0 && b.ay === 0) continue

      // ── Euler integration ──────────────────────────────────────────────
      b.ay = this.gravity          // KAN-45: use mutable gravity
      b.vx += b.ax * safeDt
      b.vy += b.ay * safeDt
      b.x  += b.vx * safeDt
      b.y  += b.vy * safeDt

      // ── Floor collision ────────────────────────────────────────────────
      if (b.y >= FLOOR_Y) {
        b.y  = FLOOR_Y
        b.vy = -b.vy * DAMPING
        b.vx *= FRICTION
      }

      // ── Wall collisions (KAN-42) ───────────────────────────────────────
      // Only bounce if ball is moving toward the wall (prevents double-flip).
      if (b.x < WALL_L) {
        b.x  = WALL_L
        if (b.vx < 0) b.vx = -b.vx * WALL_DAMPING
      } else if (b.x > WALL_R) {
        b.x  = WALL_R
        if (b.vx > 0) b.vx = -b.vx * WALL_DAMPING
      }

      // ── Velocity clamping — prevents infinite micro-bouncing ───────────
      // Also zeroes ay so recorded data shows net acceleration = 0 at rest.
      if (Math.abs(b.vy) < VELOCITY_CLAMP && b.y >= FLOOR_Y) {
        b.vy = 0
        b.vx = 0
        b.ay = 0
      }
    }
  }
}
