import type { IForce } from './IForce'
import type { Body }   from '../Body'
import type { World }  from '../World'

/**
 * SpringForce — Hooke's law force (Day 9 Strategy pattern).
 *
 * Supports two modes:
 *   Anchored mode  — bodyA ↔ fixed point (anchorX, anchorY)
 *   Body-to-body   — bodyA ↔ bodyB  (pass bodyB to constructor)
 *
 * Force on bodyA toward target:
 *   extension    = |r| - restLength
 *   F_spring     = stiffness × extension  (along unit vector toward target)
 *   F_damping    = damping × (relative velocity projected onto spring axis)
 *   F_total      = F_spring + F_damping
 *
 * Newton 3rd law: for body-to-body mode, bodyB receives the equal-and-opposite
 * force in the same apply() call (applied only once — when b === bodyA, skip
 * when b === bodyB so the World loop's per-body iteration doesn't double-apply).
 *
 * Registration: add ONE instance to world.forces.
 * The World loop calls apply(b, ...) for every body. For anchored springs
 * apply does nothing unless b has the correct reference — callers must ensure
 * the force is meaningfully scoped (or it will run for all bodies). Prefer
 * using Spring.makeForce() which wraps this class correctly.
 */
export class SpringForce implements IForce {
  /**
   * @param stiffness   Spring constant k (force per unit extension, engine px units)
   * @param restLength  Natural length in pixels
   * @param damping     Velocity damping coefficient (default 0 = no damping)
   * @param bodyB       Second body for body-to-body mode; null = anchored
   * @param anchorX     Anchor x coordinate (anchored mode only)
   * @param anchorY     Anchor y coordinate (anchored mode only)
   */
  constructor(
    private readonly stiffness:  number,
    private readonly restLength: number,
    private readonly damping:    number = 0,
    private readonly bodyB:      Body | null = null,
    private readonly anchorX:    number = 0,
    private readonly anchorY:    number = 0,
  ) {}

  apply(bodyA: Body, _world: World, _dt: number): void {
    // Body-to-body: only apply when World calls us for bodyA.
    // When the loop reaches bodyB, skip — reaction was already applied inline.
    if (this.bodyB !== null && bodyA === this.bodyB) return

    // Target position (anchor or bodyB)
    const tx = this.bodyB !== null ? this.bodyB.x : this.anchorX
    const ty = this.bodyB !== null ? this.bodyB.y : this.anchorY

    const dx   = tx - bodyA.x
    const dy   = ty - bodyA.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    // Avoid division by zero when bodies are exactly coincident
    if (dist < 1e-10) return

    const ux = dx / dist   // unit vector from bodyA toward target
    const uy = dy / dist

    // Hooke's law component
    const extension = dist - this.restLength
    const springMag = this.stiffness * extension

    // Damping component: project relative velocity onto spring axis
    const dvx        = this.bodyB !== null ? this.bodyB.vx - bodyA.vx : -bodyA.vx
    const dvy        = this.bodyB !== null ? this.bodyB.vy - bodyA.vy : -bodyA.vy
    const relVelProj = dvx * ux + dvy * uy
    const dampingMag = this.damping * relVelProj

    const totalMag = springMag + dampingMag

    // Apply force to bodyA (toward target when stretched)
    bodyA.fx += totalMag * ux
    bodyA.fy += totalMag * uy

    // Apply equal-and-opposite reaction to bodyB (Newton 3rd law)
    if (this.bodyB !== null) {
      this.bodyB.fx -= totalMag * ux
      this.bodyB.fy -= totalMag * uy
    }
  }
}
