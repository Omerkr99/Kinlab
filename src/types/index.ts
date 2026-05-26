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
