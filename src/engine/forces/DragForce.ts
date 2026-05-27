import type { IForce } from './IForce'
import type { Body }   from '../Body'
import type { World }  from '../World'

/**
 * DragForce — linear (viscous) air resistance (Day 9 Strategy pattern).
 *
 * Models Stokes drag at low Reynolds numbers: F = −c × v
 *
 * Applied per-body each step:
 *   b.fx -= coefficient × b.vx
 *   b.fy -= coefficient × b.vy
 *
 * The force always opposes the current velocity direction. A stationary body
 * receives zero drag force.
 */
export class DragForce implements IForce {
  /**
   * @param coefficient  Drag coefficient c (force = c × velocity).
   *                     Typical range for canvas px units: 0.1 – 5.0
   */
  constructor(private readonly coefficient: number) {}

  apply(b: Body, _world: World, _dt: number): void {
    b.fx -= this.coefficient * b.vx
    b.fy -= this.coefficient * b.vy
  }
}
