/**
 * KinLab — Collision manifold data class
 *
 * Produced by CircleCollision.detect() and consumed by CollisionResolver.resolve().
 * Carries the geometric data needed to resolve a single pairwise collision.
 */

import type { Body } from '../Body'

export interface CollisionManifold {
  /** First body in the collision pair */
  bodyA:   Body
  /** Second body in the collision pair */
  bodyB:   Body
  /** Unit normal pointing from bodyA → bodyB */
  normalX: number
  normalY: number
  /** Penetration depth (px); > 0 means the circles overlap */
  depth:   number
}
