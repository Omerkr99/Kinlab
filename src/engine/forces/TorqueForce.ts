/**
 * KinLab — TorqueForce (Day 10)
 *
 * Applies a constant torque to a body each step.
 * The engine's force pipeline accumulates torque in b.torque,
 * then computes b.alpha = b.torque / b.inertia during integration.
 *
 * Positive torque = counter-clockwise (standard math convention).
 */

import type { Body }  from '../Body'
import type { World } from '../World'
import type { IForce } from './IForce'

export class TorqueForce implements IForce {
  /**
   * @param tau  Torque magnitude (N·m in SI; px²/s² in engine units).
   *             Positive = counter-clockwise.
   */
  constructor(private readonly tau: number) {}

  apply(b: Body, _world: World, _dt: number): void {
    b.torque += this.tau
  }
}
