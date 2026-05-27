import type { IForce } from './IForce'
import type { Body }   from '../Body'
import type { World }  from '../World'

/**
 * GravityForce — constant downward gravitational acceleration as IForce.
 *
 * Reads world.gravity each step so the live gravity slider is respected.
 * Contributes: b.fy += b.mass × world.gravity
 *
 * Note: When World has NO forces registered, World.step() applies gravity
 * via the legacy path (b.ay = world.gravity). GravityForce is only needed
 * when you want gravity in the force pipeline alongside SpringForce / DragForce.
 */
export class GravityForce implements IForce {
  apply(b: Body, world: World, _dt: number): void {
    b.fy += b.mass * world.gravity
  }
}
