import type { Body }  from '../Body'
import type { World } from '../World'

/**
 * IForce — pluggable force strategy (Day 9 Strategy pattern).
 *
 * apply() is called once per body per World.step(), AFTER force accumulators
 * are cleared and BEFORE Euler integration. Implementations add to b.fx / b.fy.
 *
 * Rules:
 * - DO add to b.fx and/or b.fy
 * - DO NOT directly set b.vx, b.vy, b.ax, b.ay — those are written by World.step()
 * - DO NOT read world.time or mutate world state (pure force computation only)
 */
export interface IForce {
  apply(b: Body, world: World, dt: number): void
}
