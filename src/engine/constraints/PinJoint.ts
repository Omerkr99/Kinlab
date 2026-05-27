/**
 * KinLab — PinJoint
 *
 * Constrains a body to a fixed world-space anchor point.
 * Equivalent to DistanceConstraint(body, 0, null, anchorX, anchorY).
 *
 * Use cases:
 *   - Pendulum pivot
 *   - Chain endpoint anchor
 *   - Fixed hinge for rotating structures
 */

import type { Body }              from '../Body'
import type { IConstraint }       from './IConstraint'
import { DistanceConstraint }     from './DistanceConstraint'

export class PinJoint implements IConstraint {
  private readonly inner: DistanceConstraint

  /**
   * @param body    The body to pin
   * @param anchorX World x-coordinate of the pin (px)
   * @param anchorY World y-coordinate of the pin (px)
   */
  constructor(
    readonly body:    Body,
    readonly anchorX: number,
    readonly anchorY: number,
  ) {
    this.inner = new DistanceConstraint(body, 0, null, anchorX, anchorY)
  }

  solve(dt: number): void {
    this.inner.solve(dt)
  }

  /** Distance of body from anchor (should approach 0 after solve). */
  get currentLength(): number {
    return this.inner.currentLength
  }

  /** Pin error: distance from anchor. Zero = perfectly pinned. */
  get error(): number {
    return this.inner.currentLength
  }
}
