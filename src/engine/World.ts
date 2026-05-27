import { Body } from './Body'
import { FLOOR_Y, GRAVITY, WALL_L, WALL_R, WALL_DAMPING } from '../constants'
import type { IForce }          from './forces/IForce'
import type { IConstraint }     from './constraints/IConstraint'
import type { PhysicsEventBus } from './PhysicsEvents'
import { CircleCollision }      from './collisions/CircleCollision'
import { CollisionResolver }    from './collisions/CollisionResolver'

const MAX_DT         = 0.016
const DAMPING        = 0.7    // floor bounce energy retention
const FRICTION       = 0.85   // floor horizontal friction
const VELOCITY_CLAMP = 0.2    // must be > GRAVITY*MAX_DT (9.8*0.016=0.157)

export class World {
  bodies:  Body[]  = []
  time     = 0
  gravity  = GRAVITY   // KAN-45: mutable — gravity slider writes here at runtime

  // ── Day 9 additions ─────────────────────────────────────────────────────────
  /** Pluggable force strategies. Empty by default → legacy path runs unchanged. */
  forces: IForce[]             = []
  /** Optional event bus. null by default → no events emitted. */
  bus:    PhysicsEventBus | null = null

  // ── Day 10 additions ─────────────────────────────────────────────────────────
  /**
   * Enable circle-circle collision detection.
   * Default: false — opt-in to avoid affecting Day 9 multi-body tests.
   */
  collisionDetection = false
  /** Coefficient of restitution for body-body collisions (0–1). */
  restitution = 0.8
  /** Positional constraints (DistanceConstraint, PinJoint, …). */
  constraints: IConstraint[] = []
  /** Number of constraint solver iterations per step (higher = stiffer). */
  constraintIterations = 4

  // ── Body management ────────────────────────────────────────────────────────

  addBody(b: Body): Body {
    this.bodies.push(b)
    return b
  }

  // ── Force management (Day 9) ───────────────────────────────────────────────

  addForce(f: IForce): void {
    this.forces.push(f)
  }

  removeForce(f: IForce): void {
    const i = this.forces.indexOf(f)
    if (i !== -1) this.forces.splice(i, 1)
  }

  // ── Constraint management (Day 10) ────────────────────────────────────────

  addConstraint(c: IConstraint): void {
    this.constraints.push(c)
  }

  removeConstraint(c: IConstraint): void {
    this.constraints = this.constraints.filter(x => x !== c)
  }

  // ── Simulation step ────────────────────────────────────────────────────────

  step(dt: number): void {
    // Clamp to [0, MAX_DT]: reject negative dt (time cannot go backward)
    const safeDt = Math.min(Math.max(dt, 0), MAX_DT)
    this.time += safeDt

    const hasForces = this.forces.length > 0

    for (const b of this.bodies) {

      if (!hasForces) {
        // ══════════════════════════════════════════════════════════════════════
        // LEGACY PATH — bit-identical to Days 1-8, zero behavior change.
        // Runs whenever world.forces is empty (the default).
        // ══════════════════════════════════════════════════════════════════════

        // Skip physics for resting bodies — avoids infinite micro-bounce loop.
        if (b.y === FLOOR_Y && b.vy === 0 && b.vx === 0 && b.ay === 0) continue

        // ── Euler integration ───────────────────────────────────────────────
        b.ay = this.gravity
        b.vx += b.ax * safeDt
        b.vy += b.ay * safeDt
        b.x  += b.vx * safeDt
        b.y  += b.vy * safeDt

        // ── Floor collision ─────────────────────────────────────────────────
        if (b.y >= FLOOR_Y) {
          b.y  = FLOOR_Y
          b.vy = -b.vy * DAMPING
          b.vx *= FRICTION
        }

        // ── Wall collisions (KAN-42) ────────────────────────────────────────
        if (b.x < WALL_L) {
          b.x  = WALL_L
          if (b.vx < 0) b.vx = -b.vx * WALL_DAMPING
        } else if (b.x > WALL_R) {
          b.x  = WALL_R
          if (b.vx > 0) b.vx = -b.vx * WALL_DAMPING
        }

        // ── Velocity clamping — prevents infinite micro-bouncing ─────────────
        if (Math.abs(b.vy) < VELOCITY_CLAMP && b.y >= FLOOR_Y) {
          b.vy = 0
          b.vx = 0
          b.ay = 0
        }

      } else {
        // ══════════════════════════════════════════════════════════════════════
        // FORCE PIPELINE PATH — Day 9 + Day 10
        // ══════════════════════════════════════════════════════════════════════

        // Phase 1: Clear force and torque accumulators
        b.fx     = 0
        b.fy     = 0
        b.torque = 0  // Day 10: cleared alongside fx/fy

        // Phase 2: Apply all registered forces (Strategy pattern)
        // Each IForce adds to b.fx / b.fy / b.torque — never touches velocities.
        for (const f of this.forces) {
          f.apply(b, this, safeDt)
        }

        // Resting-body skip (after force accumulation, so springs can wake bodies)
        // Body at rest with zero net force → skip integration entirely.
        if (b.y === FLOOR_Y && b.vy === 0 && b.vx === 0 && b.fx === 0 && b.fy === 0) continue

        // Phase 3: Convert accumulated forces to acceleration (F = ma → a = F/m)
        b.ax = b.fx / b.mass
        b.ay = b.fy / b.mass

        // Phase 4: Euler integration (translational)
        b.vx += b.ax * safeDt
        b.vy += b.ay * safeDt
        b.x  += b.vx * safeDt
        b.y  += b.vy * safeDt

        // Phase 4b: Angular integration (Day 10 — no-op when torque=0, omega=0)
        b.alpha  = b.torque / b.inertia
        b.omega += b.alpha * safeDt
        b.angle += b.omega * safeDt

        // Phase 5: Floor collision + emit
        if (b.y >= FLOOR_Y) {
          const bi      = this.bodies.indexOf(b)
          const vyBefore = b.vy   // velocity just before correction (post-integration)
          b.y  = FLOOR_Y
          b.vy = -b.vy * DAMPING
          b.vx *= FRICTION

          if (this.bus) {
            this.bus.emit({
              type:      'floor-bounce',
              bodyIndex: bi,
              time:      this.time,
              x:         b.x,
              y:         b.y,
              vx:        b.vx,
              vy:        b.vy,
              // Impulse = mass × |Δvy| (y-component — dominant at floor bounce)
              impulse:   Math.abs(b.vy - vyBefore) * b.mass,
            })
          }
        }

        // Phase 6: Wall collisions + emit
        if (b.x < WALL_L) {
          b.x = WALL_L
          if (b.vx < 0) {
            b.vx = -b.vx * WALL_DAMPING
            if (this.bus) {
              this.bus.emit({
                type: 'wall-bounce', bodyIndex: this.bodies.indexOf(b),
                time: this.time, x: b.x, y: b.y, vx: b.vx, vy: b.vy,
              })
            }
          }
        } else if (b.x > WALL_R) {
          b.x = WALL_R
          if (b.vx > 0) {
            b.vx = -b.vx * WALL_DAMPING
            if (this.bus) {
              this.bus.emit({
                type: 'wall-bounce', bodyIndex: this.bodies.indexOf(b),
                time: this.time, x: b.x, y: b.y, vx: b.vx, vy: b.vy,
              })
            }
          }
        }

        // Phase 7: Velocity clamping + emit rest
        if (Math.abs(b.vy) < VELOCITY_CLAMP && b.y >= FLOOR_Y) {
          b.vy = 0
          b.vx = 0
          b.ay = 0
          if (this.bus) {
            this.bus.emit({
              type: 'rest', bodyIndex: this.bodies.indexOf(b),
              time: this.time, x: b.x, y: b.y,
            })
          }
        }
      }
    }

    // ── Phase 8: Body-body collision detection + resolution (Day 10, opt-in) ─
    if (this.collisionDetection && this.bodies.length > 1) {
      const manifolds = CircleCollision.detect(this.bodies)
      for (const m of manifolds) {
        const j = CollisionResolver.resolve(m, this.restitution)
        if (this.bus && j > 0) {
          this.bus.emit({
            type:             'collision',
            bodyIndex:        this.bodies.indexOf(m.bodyA),
            bodyIndexB:       this.bodies.indexOf(m.bodyB),
            time:             this.time,
            impulse:          j,
            penetrationDepth: m.depth,
          })
        }
      }
    }

    // ── Phase 9: Constraint solving (Day 10, no-op when constraints = []) ────
    for (let iter = 0; iter < this.constraintIterations; iter++) {
      for (const c of this.constraints) {
        c.solve(safeDt)
      }
    }

    // ── Step event (always emitted when bus is attached) ─────────────────────
    if (this.bus) {
      this.bus.emit({ type: 'step', bodyIndex: -1, time: this.time })
    }
  }
}
