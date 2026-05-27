/**
 * KinLab — DistanceConstraint
 *
 * Maintains an exact distance `length` between bodyA and a second point
 * (either bodyB or a fixed world-space anchor).
 *
 * Uses XPBD-style position projection + velocity correction:
 *   - compliance = 0  →  rigid rod (inextensible)
 *   - compliance > 0  →  soft spring-like rope
 *
 * Reference: "XPBD: Position-Based Simulation of Compliant Constrained Dynamics"
 *            Macklin, Müller, Chentanez — 2016
 */

import type { Body }        from '../Body'
import type { IConstraint } from './IConstraint'

export class DistanceConstraint implements IConstraint {
  /**
   * @param bodyA      The primary body to constrain
   * @param length     Target distance (px); 0 = pin joint
   * @param bodyB      Second body; null → use (anchorX, anchorY) as fixed point
   * @param anchorX    World x of fixed anchor (ignored if bodyB is provided)
   * @param anchorY    World y of fixed anchor
   * @param compliance Softness (0 = rigid; higher = springier rope).
   *                   Units: 1/(N/m) scaled to the pixel coordinate system.
   */
  constructor(
    readonly bodyA:      Body,
    readonly length:     number,
    readonly bodyB:      Body | null = null,
    readonly anchorX:    number = 0,
    readonly anchorY:    number = 0,
    readonly compliance: number = 0,
  ) {}

  solve(_dt: number): void {
    const tx = this.bodyB !== null ? this.bodyB.x : this.anchorX
    const ty = this.bodyB !== null ? this.bodyB.y : this.anchorY

    const dx = tx - this.bodyA.x
    const dy = ty - this.bodyA.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    // Degenerate: bodies at same position — can't compute a direction
    if (dist < 1e-10) return

    const nx = dx / dist
    const ny = dy / dist
    const error = dist - this.length

    const wA = 1 / this.bodyA.mass
    const wB = this.bodyB !== null ? 1 / this.bodyB.mass : 0
    const totalW = wA + wB + this.compliance

    // ── Position correction ────────────────────────────────────────────────
    // Move bodies so their distance equals `length`
    const corr = error / totalW
    this.bodyA.x += wA * corr * nx
    this.bodyA.y += wA * corr * ny
    if (this.bodyB !== null) {
      this.bodyB.x -= wB * corr * nx
      this.bodyB.y -= wB * corr * ny
    }

    // ── Velocity correction ────────────────────────────────────────────────
    // Remove relative velocity component along the constraint axis
    const rvx = (this.bodyB !== null ? this.bodyB.vx : 0) - this.bodyA.vx
    const rvy = (this.bodyB !== null ? this.bodyB.vy : 0) - this.bodyA.vy
    const rvN = rvx * nx + rvy * ny
    const dvN = -rvN / totalW
    this.bodyA.vx -= wA * dvN * nx
    this.bodyA.vy -= wA * dvN * ny
    if (this.bodyB !== null) {
      this.bodyB.vx += wB * dvN * nx
      this.bodyB.vy += wB * dvN * ny
    }
  }

  /** Current distance between the constraint endpoints (px). */
  get currentLength(): number {
    const tx = this.bodyB !== null ? this.bodyB.x : this.anchorX
    const ty = this.bodyB !== null ? this.bodyB.y : this.anchorY
    const dx = tx - this.bodyA.x
    const dy = ty - this.bodyA.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  /** Constraint error: currentLength − length. Zero = perfectly satisfied. */
  get error(): number {
    return this.currentLength - this.length
  }
}
