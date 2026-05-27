/**
 * BodyFactory — preset body constructors for multi-body scenarios (KAN-97)
 *
 * Provides convenient factory methods that create Body instances with
 * sensible physics defaults and pre-set initial conditions.
 *
 * Bodies created here are pure physics objects; display properties
 * (color, label) are derived by index in the render layer.
 */
import { Body } from './Body'
import { BALL_RADIUS, FLOOR_Y } from '../constants'

// Default starting column spacing between sequentially-added bodies
const X_SPACING = 80

/**
 * Suggested drop height for new bodies — slightly above the canvas top
 * to give them room to fall.
 */
const DEFAULT_DROP_Y = 50

export interface BodySpec {
  /** Canvas x position (px). Default: 300 + bodyIndex * X_SPACING */
  x?:       number
  /** Canvas y position (px — y↓, 0 = top). Default: DEFAULT_DROP_Y */
  y?:       number
  /** Initial velocity x (px/s). Default: 0 */
  vx?:      number
  /** Initial velocity y (px/s). Default: 0 */
  vy?:      number
  /** Mass (kg). Default: 1 */
  mass?:    number
  /** Collision radius (px). Default: BALL_RADIUS */
  radius?:  number
  /** Moment of inertia. Default: mass * radius² / 2 (solid disk) */
  inertia?: number
}

export class BodyFactory {

  /**
   * Create a standard circle body at the given position.
   *
   * @param spec  Optional overrides. `x` defaults to 300 + index*spacing.
   * @param index Used to auto-stagger x when `spec.x` is omitted (0-based).
   */
  static circle(spec: BodySpec = {}, index = 0): Body {
    const x      = spec.x      ?? 300 + index * X_SPACING
    const y      = spec.y      ?? DEFAULT_DROP_Y
    const mass   = spec.mass   ?? 1
    const radius = spec.radius ?? BALL_RADIUS
    return new Body({
      x, y,
      vx: spec.vx ?? 0,
      vy: spec.vy ?? 0,
      mass,
      radius,
      inertia: spec.inertia ?? (mass * radius * radius) / 2,
    })
  }

  /**
   * Create a heavy body (mass = 5) — falls faster, more impulse on collision.
   */
  static heavy(spec: BodySpec = {}, index = 0): Body {
    return BodyFactory.circle({ mass: 5, ...spec }, index)
  }

  /**
   * Create a light body (mass = 0.2) — floats, small impulse.
   */
  static light(spec: BodySpec = {}, index = 0): Body {
    return BodyFactory.circle({ mass: 0.2, ...spec }, index)
  }

  /**
   * Create a body with an initial horizontal launch velocity.
   *
   * @param vx  Horizontal velocity in px/s (positive = right).
   */
  static launched(vx: number, spec: BodySpec = {}, index = 0): Body {
    return BodyFactory.circle({ vx, vy: 0, ...spec }, index)
  }

  /**
   * Returns the canonical starting position for body at index `n`
   * (used by SimControlBar reset logic).
   */
  static startPos(n: number): { x: number; y: number } {
    return {
      x: Math.min(300 + n * X_SPACING, 550),  // cap at right side
      y: DEFAULT_DROP_Y + n * 30,              // stagger vertically too
    }
  }

  /**
   * Reset a body to its canonical starting position for index `n`.
   * Zeroes velocities and accelerations — ready for a fresh simulation.
   */
  static reset(b: Body, n: number): void {
    const { x, y } = BodyFactory.startPos(n)
    b.x = x; b.y = y
    b.vx = 0; b.vy = 0
    b.ax = 0; b.ay = 0
    b.fx = 0; b.fy = 0
    b.omega = 0; b.alpha = 0; b.torque = 0; b.angle = 0
    // Do NOT reset b.mass, b.radius, b.inertia — preserve body properties
  }

  /**
   * True when a body is resting on the floor (y == FLOOR_Y, vy == 0, vx == 0).
   */
  static isAtRest(b: Body): boolean {
    return b.y >= FLOOR_Y && b.vy === 0 && b.vx === 0
  }
}
