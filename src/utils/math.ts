/**
 * KinLab — Physics math utilities
 *
 * Pure functions — no state, no side effects. Safe to use inside the engine
 * hot path and in tests.
 */

// ── Numeric helpers ───────────────────────────────────────────────────────────

/**
 * Clamp `value` to the closed interval [min, max].
 *
 * @example clamp(105, 0, 100) → 100
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Linear interpolation between `a` and `b` by factor `t` ∈ [0, 1].
 *
 * @example lerp(0, 10, 0.25) → 2.5
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Round `value` to `decimals` decimal places.
 *
 * @example roundTo(3.14159, 2) → 3.14
 */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

// ── Physics helpers ───────────────────────────────────────────────────────────

/**
 * Translational kinetic energy: ½mv²
 *
 * @param vx  x-velocity (px/s or m/s — consistent with mass units)
 * @param vy  y-velocity
 * @param mass  mass in kg (default 1)
 * @returns energy in J (when SI units) or arbitrary engine units
 */
export function kineticEnergy(vx: number, vy: number, mass = 1): number {
  return 0.5 * mass * (vx * vx + vy * vy)
}

/**
 * Gravitational potential energy: mgh
 *
 * @param height  height above reference (physical y, floor = 0)
 * @param mass    mass in kg (default 1)
 * @param g       gravitational acceleration (default 9.8 m/s²)
 */
export function potentialEnergy(height: number, mass = 1, g = 9.8): number {
  return mass * g * height
}

/**
 * Total mechanical energy: KE + PE
 */
export function mechanicalEnergy(
  vx: number,
  vy: number,
  height: number,
  mass = 1,
  g = 9.8,
): number {
  return kineticEnergy(vx, vy, mass) + potentialEnergy(height, mass, g)
}

/**
 * Map a value from one range to another (linear).
 *
 * @example mapRange(5, 0, 10, 0, 100) → 50
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  if (inMax === inMin) return outMin
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin)
}
