/**
 * KinLab — Circle-circle collision detector
 *
 * O(n²) broad-and-narrow phase combined — sufficient for small body counts.
 * Uses each body's `radius` field (default BALL_RADIUS) to compute the
 * minimum separation distance.
 */

import type { Body }               from '../Body'
import type { CollisionManifold }  from './CollisionManifold'

export class CircleCollision {
  /**
   * Detect all overlapping circle pairs in `bodies`.
   *
   * @returns  Array of manifolds for every overlapping pair, in (i, j) order
   *           with i < j. Empty array if no overlaps.
   */
  static detect(bodies: Body[]): CollisionManifold[] {
    const result: CollisionManifold[] = []

    for (let i = 0; i < bodies.length - 1; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i]
        const b = bodies[j]

        const dx      = b.x - a.x
        const dy      = b.y - a.y
        const distSq  = dx * dx + dy * dy
        const minDist = a.radius + b.radius

        // Fast reject: squared distance test avoids sqrt for non-colliding pairs
        if (distSq >= minDist * minDist) continue

        const dist = Math.sqrt(distSq)
        // Guard against degenerate case (bodies at the exact same position)
        if (dist < 1e-10) continue

        result.push({
          bodyA:   a,
          bodyB:   b,
          normalX: dx / dist,
          normalY: dy / dist,
          depth:   minDist - dist,
        })
      }
    }

    return result
  }
}
