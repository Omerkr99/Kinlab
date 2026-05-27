/**
 * KinLab — Shared type definitions
 * Central type registry for the simulation, UI, and data layers.
 */

// ── Simulation lifecycle ──────────────────────────────────────────────────────

/** Control-bar state machine */
export type PlayState = 'idle' | 'playing' | 'paused' | 'stopped'

// ── Physics configuration ─────────────────────────────────────────────────────

/** Immutable snapshot of the physics world configuration */
export interface SimulationConfig {
  /** Gravity in engine units (px/s²) */
  gravity: number
  /** Canvas y-coordinate of the floor (collision boundary) */
  floorY: number
  /** Left wall x-coordinate (ball centre ≥ this) */
  wallL: number
  /** Right wall x-coordinate (ball centre ≤ this) */
  wallR: number
  /** Ball radius in pixels */
  ballRadius: number
}

// ── Body state ────────────────────────────────────────────────────────────────

/** Point-in-time snapshot of a single Body + world time */
export interface BodySnapshot {
  x: number
  y: number
  vx: number
  vy: number
  ax: number
  ay: number
  /** World time at snapshot (seconds) */
  t: number
}

// ── DataRecorder ──────────────────────────────────────────────────────────────

/** The seven time-series keys the DataRecorder tracks */
export type SeriesKey = 'time' | 'x' | 'y' | 'vx' | 'vy' | 'ax' | 'ay'

/** Full snapshot of recorder contents (copies of all series) */
export interface RecorderSnapshot {
  length: number
  time: number[]
  x: number[]
  y: number[]
  vx: number[]
  vy: number[]
  ax: number[]
  ay: number[]
}

// ── Graph ─────────────────────────────────────────────────────────────────────

/** Axis descriptor used by GraphEngine and AxisSelector */
export interface AxisDescriptor {
  key: SeriesKey
  label: string
  unit: string
}

// ── Day 9 types ───────────────────────────────────────────────────────────────

/** Point-in-time snapshot of a Spring's physics state */
export interface SpringSnapshot {
  /** Current distance between endpoints (px) */
  currentLength: number
  /** currentLength − restLength (px); negative = compressed */
  extension: number
  /** Spring potential energy: ½ k x² */
  potentialEnergy: number
  /** Spring constant k */
  stiffness: number
  /** Natural (rest) length (px) */
  restLength: number
  /** Velocity damping coefficient */
  damping: number
}

/** Record of a discrete impulse event at a collision */
export interface ImpulseRecord {
  /** World.time when impulse occurred */
  time: number
  /** Index of body that received impulse in World.bodies */
  bodyIndex: number
  /** Impulse magnitude: mass × |Δv| */
  magnitude: number
  vxBefore: number
  vyBefore: number
  vxAfter: number
  vyAfter: number
}

/** Snapshot of a registered force's current state (for UI display) */
export interface ForceSnapshot {
  type: 'gravity' | 'spring' | 'drag' | 'custom'
  /** Current force magnitude on the target body */
  magnitude: number
  /** Direction in radians: atan2(fy, fx) */
  direction: number
}

// ── Day 10 types ──────────────────────────────────────────────────────────────

/** Record of a circle-circle collision resolved in the physics pipeline */
export interface CollisionRecord {
  /** World.time when collision was resolved */
  time:        number
  /** Index of body A in World.bodies */
  bodyIndexA:  number
  /** Index of body B in World.bodies */
  bodyIndexB:  number
  /** Impulse scalar |j| applied to separate the bodies */
  impulse:     number
  /** Collision normal x-component (unit vector, points A → B) */
  normalX:     number
  /** Collision normal y-component */
  normalY:     number
  /** Coefficient of restitution used for this collision */
  restitution: number
}

/** Point-in-time snapshot of a constraint's physics state */
export interface ConstraintSnapshot {
  type:        'distance' | 'pin'
  /** Current distance between constraint endpoints (px) */
  currentDist: number
  /** Target (rest) distance (px) */
  targetDist:  number
  /** Error = currentDist − targetDist (px); 0 = perfectly satisfied */
  error:       number
  /** Compliance value (0 = rigid rod) */
  compliance:  number
}

/** Point-in-time snapshot of a body's rotation state */
export interface RotationSnapshot {
  /** Current orientation in radians */
  angle:      number
  /** Angular velocity (rad/s) */
  omega:      number
  /** Angular acceleration (rad/s²) */
  alpha:      number
  /** Moment of inertia */
  inertia:    number
  /** Rotational kinetic energy: ½Iω² */
  angularKE:  number
}
