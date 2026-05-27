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

// ── Day 9 additions ───────────────────────────────────────────────────────────

/**
 * Speed: magnitude of velocity vector |v| = √(vx² + vy²)
 *
 * @param vx  x-velocity component
 * @param vy  y-velocity component
 */
export function speed(vx: number, vy: number): number {
  return Math.sqrt(vx * vx + vy * vy)
}

/**
 * Linear momentum magnitude: |p| = mass × |v|
 *
 * @param vx   x-velocity component
 * @param vy   y-velocity component
 * @param mass mass in kg (default 1)
 * @returns magnitude of momentum vector |p|
 */
export function momentum(vx: number, vy: number, mass = 1): number {
  return mass * speed(vx, vy)
}

/**
 * Impulse magnitude: |J| = |F| × dt
 *
 * Impulse–momentum theorem: J = Δp = F × Δt
 *
 * @param fx  force x-component
 * @param fy  force y-component
 * @param dt  time interval (seconds)
 * @returns magnitude of impulse vector |J|
 */
export function impulse(fx: number, fy: number, dt: number): number {
  return Math.sqrt(fx * fx + fy * fy) * dt
}

/**
 * Spring (elastic) potential energy: PE = ½ k x²
 *
 * @param k         spring constant (stiffness)
 * @param extension displacement from rest length (positive = stretched,
 *                  negative = compressed — squared so sign doesn't matter)
 */
export function springPotentialEnergy(k: number, extension: number): number {
  return 0.5 * k * extension * extension
}

// ── Day 10 additions ──────────────────────────────────────────────────────────

/**
 * Rotational kinetic energy: ½Iω²
 *
 * @param omega   angular velocity (rad/s)
 * @param inertia moment of inertia (kg·m²)
 */
export function angularKineticEnergy(omega: number, inertia: number): number {
  return 0.5 * inertia * omega * omega
}

/**
 * 2D torque (cross product magnitude): τ = r × F = rx·Fy − ry·Fx
 *
 * @param rx  x-component of moment arm (from pivot to force application point)
 * @param ry  y-component of moment arm
 * @param fx  force x-component
 * @param fy  force y-component
 * @returns signed torque (positive = counter-clockwise)
 */
export function torque(rx: number, ry: number, fx: number, fy: number): number {
  return rx * fy - ry * fx
}

/**
 * Angular momentum: L = I × ω
 *
 * @param omega   angular velocity (rad/s)
 * @param inertia moment of inertia
 */
export function angularMomentum(omega: number, inertia: number): number {
  return inertia * omega
}

/**
 * Change in angular velocity from an angular impulse: Δω = τ·dt / I
 *
 * @param tau     torque magnitude (N·m)
 * @param inertia moment of inertia
 * @param dt      time interval (s)
 */
export function angularImpulse(tau: number, inertia: number, dt: number): number {
  return (tau * dt) / inertia
}
