/**
 * KinLab — Impulse-based collision resolver
 *
 * Implements the Separating Velocity method:
 *   1. Position correction — moves overlapping bodies apart (weighted by 1/mass)
 *   2. Impulse resolution — applies equal-and-opposite impulses along collision normal
 *
 * Reference: "Game Physics Engine Development" — Ian Millington, Ch. 7
 */

import type { CollisionManifold } from './CollisionManifold'

export class CollisionResolver {
  /**
   * Resolve a single collision in-place.
   *
   * @param m           Collision manifold from CircleCollision.detect()
   * @param restitution Coefficient of restitution (0 = perfectly inelastic,
   *                    1 = perfectly elastic). Default 0.8.
   * @returns           The scalar impulse magnitude |j| applied (useful for events)
   */
  static resolve(m: CollisionManifold, restitution = 0.8): number {
    const { bodyA: a, bodyB: b, normalX: nx, normalY: ny, depth } = m

    const wA = 1 / a.mass
    const wB = 1 / b.mass
    const totalW = wA + wB

    // ── Phase 1: Position correction ────────────────────────────────────────
    // Push bodies apart along the collision normal, proportional to inverse mass
    // (lighter body moves more).
    const corrX = (depth / totalW) * nx
    const corrY = (depth / totalW) * ny
    a.x -= wA * corrX
    a.y -= wA * corrY
    b.x += wB * corrX
    b.y += wB * corrY

    // ── Phase 2: Impulse resolution ──────────────────────────────────────────
    // Relative velocity along the collision normal (positive = approaching)
    const relVelN = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny

    // Bodies already separating — no impulse needed
    if (relVelN >= 0) return 0

    // Impulse scalar: j = -(1+e) * v_rel·n / (1/mA + 1/mB)
    const j = -(1 + restitution) * relVelN / totalW

    a.vx -= j * wA * nx
    a.vy -= j * wA * ny
    b.vx += j * wB * nx
    b.vy += j * wB * ny

    return Math.abs(j)
  }
}
