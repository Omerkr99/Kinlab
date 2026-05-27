/**
 * PhysicsScale — unit-calibration layer for KinLab
 *
 * The engine always works in PIXELS.  PhysicsScale is a pure display/export
 * adapter: it tells every UI component how to label and convert pixel values
 * into a chosen physical unit (px, cm, m, or a custom unit).
 *
 * Key invariant (future-proof)
 * ────────────────────────────
 * pixelsPerUnit is the single source of truth linking canvas-pixels to
 * real-world distance.  When a viewport-zoom feature arrives, setting
 *   effectivePixelsPerUnit = basePixelsPerUnit × viewportZoom
 * keeps all measurement displays stable across magnification levels.
 */

import type { SeriesKey } from '../recorder'

// ── Types ─────────────────────────────────────────────────────────────────────

export type UnitId = 'px' | 'cm' | 'm' | 'custom'

export interface PhysicsScale {
  readonly id:             UnitId
  readonly pixelsPerUnit:  number          // canvas-px per physical unit
  readonly unitSymbol:     string          // 'px', 'cm', 'm', or user symbol
  readonly name:           string          // human-readable name
  readonly metersPerUnit:  number | null   // null = no real-world tie (px mode)
}

// ── Calibration presets ───────────────────────────────────────────────────────
//
//  px   →  1:1 identity, no real-world meaning  (cartoon-physics default)
//  cm   → 10 px = 1 cm → canvas 60 cm × 50 cm; 1 cm = 0.01 m
//  m    → 100 px = 1 m → canvas 6 m × 5 m; Earth gravity = 9.8 m/s² = 980 px/s²
//  custom → user-configurable

export const SCALE_PRESETS: Record<UnitId, PhysicsScale> = {
  px:     { id: 'px',     pixelsPerUnit: 1,   unitSymbol: 'px', metersPerUnit: null, name: 'Pixels (1 px = 1 px)'         },
  cm:     { id: 'cm',     pixelsPerUnit: 10,  unitSymbol: 'cm', metersPerUnit: 0.01, name: 'Centimeters (10 px = 1 cm)'   },
  m:      { id: 'm',      pixelsPerUnit: 100, unitSymbol: 'm',  metersPerUnit: 1,    name: 'Meters (100 px = 1 m)'        },
  custom: { id: 'custom', pixelsPerUnit: 50,  unitSymbol: 'u',  metersPerUnit: null, name: 'Custom'                       },
}

export const DEFAULT_SCALE: PhysicsScale = SCALE_PRESETS.px

// ── Core conversions ──────────────────────────────────────────────────────────

/** Pixel value → physical units */
export const pxToUnit = (px: number, s: PhysicsScale): number =>
  px / s.pixelsPerUnit

/** Physical unit value → pixels */
export const unitToPx = (u: number, s: PhysicsScale): number =>
  u * s.pixelsPerUnit

// ── Unit-label helpers ────────────────────────────────────────────────────────

export const distUnit  = (s: PhysicsScale): string => s.unitSymbol
export const velUnit   = (s: PhysicsScale): string => `${s.unitSymbol}/s`
export const accelUnit = (s: PhysicsScale): string => `${s.unitSymbol}/s²`

// ── Axis-label helpers ────────────────────────────────────────────────────────

/** Short label for graph axes: "x (m)", "vy (m/s)", "time (s)", etc. */
export function axisLabel(key: SeriesKey, s: PhysicsScale): string {
  const u = s.unitSymbol
  switch (key) {
    case 'time': return 'time (s)'
    case 'x':    return `x (${u})`
    case 'y':    return `height (${u})`
    case 'vx':   return `vx (${u}/s)`
    case 'vy':   return `vy (${u}/s)`
    case 'ax':   return `ax (${u}/s²)`
    case 'ay':   return `ay (${u}/s²)`
  }
}

/** Verbose label for AxisSelector drop-downs */
export function dropdownLabel(key: SeriesKey, s: PhysicsScale): string {
  const u = s.unitSymbol
  switch (key) {
    case 'time': return 'time (s)'
    case 'x':    return `position x (${u})`
    case 'y':    return `height y (${u},  0=floor, ↑+)`
    case 'vx':   return `velocity vx (${u}/s)`
    case 'vy':   return `velocity vy (${u}/s,  ↑+)`
    case 'ax':   return `accel ax (${u}/s²)`
    case 'ay':   return `accel ay (${u}/s²,  ↑+)`
  }
}

// ── Number formatter ──────────────────────────────────────────────────────────

export function fmtUnit(physVal: number, decimals = 3): string {
  if (physVal === 0) return '0'
  if (Math.abs(physVal) >= 1e4 || (Math.abs(physVal) < 0.001 && physVal !== 0))
    return physVal.toExponential(2)
  return physVal.toFixed(decimals)
}

// ── Custom scale factory ──────────────────────────────────────────────────────

export function makeCustomScale(
  pixelsPerUnit: number,
  unitSymbol = 'u',
  metersPerUnit: number | null = null,
): PhysicsScale {
  const ppu = Math.max(0.001, pixelsPerUnit)
  return {
    id: 'custom', pixelsPerUnit: ppu, unitSymbol,
    metersPerUnit,
    name: `Custom (${ppu} px = 1 ${unitSymbol})`,
  }
}

// ── Gravity helpers ───────────────────────────────────────────────────────────
//
// Gravity presets are defined in SI (m/s²).  For a calibrated scale (cm, m)
// the engine value is derived from metersPerUnit so the physics is real.
// For the px scale (no real-world tie) presets are used directly as px/s².

/** Real-world gravity presets: [displayLabel, SI value in m/s²] */
export const GRAVITY_PRESETS_MS2: Array<{ label: string; icon: string; ms2: number; title: string }> = [
  { label: '0',       icon: '🚀', ms2: 0,    title: 'Zero gravity'         },
  { label: 'Moon',    icon: '🌙', ms2: 1.6,  title: 'Moon  (1.6  m/s²)'   },
  { label: 'Mars',    icon: '🔴', ms2: 3.7,  title: 'Mars  (3.7  m/s²)'   },
  { label: 'Earth',   icon: '🌍', ms2: 9.8,  title: 'Earth (9.8  m/s²)'   },
  { label: 'Jupiter', icon: '🪐', ms2: 24.8, title: 'Jupiter (24.8 m/s²)' },
]

/**
 * Convert a gravity value given in m/s² to the engine's px/s².
 *
 *   m  scale (100 px/m, 1 m/unit):   9.8 m/s² × (100 px/m)/(1 m/unit) = 980  px/s²
 *   cm scale (10  px/cm, 0.01 m/unit): 9.8 × (10/0.01) = 9 800 px/s²
 *   px scale (no real-world tie):      9.8 px/s²  (used as-is)
 */
export function gravityMs2ToEngine(ms2: number, s: PhysicsScale): number {
  if (s.metersPerUnit == null) return ms2   // px mode: direct
  return ms2 * s.pixelsPerUnit / s.metersPerUnit
}

/**
 * Convert the engine's px/s² to display units/s² for the slider.
 *
 *   m  scale: 980 px/s² ÷ 100 px/m = 9.8 m/s²
 *   cm scale: 9800 px/s² ÷ 10 px/cm = 980 cm/s²  (correct: 9.8 m/s² = 980 cm/s²)
 *   px scale: 9.8 px/s² (unchanged)
 */
export function gravityEngineToDisplay(enginePxS2: number, s: PhysicsScale): number {
  if (s.metersPerUnit == null) return enginePxS2  // px mode
  return enginePxS2 / s.pixelsPerUnit
}

/**
 * Max value for the gravity slider, in display units.
 * Always corresponds to 30 m/s² in real-world terms.
 *   m  → 30 m/s²
 *   cm → 3 000 cm/s²
 *   px → 30 px/s²  (uncalibrated)
 */
export function gravitySliderMax(s: PhysicsScale): number {
  if (s.metersPerUnit == null) return 30
  return 30 / s.metersPerUnit   // 30 m/s² expressed in the current unit
}

/** Slider step size (smaller step for large ranges) */
export function gravitySliderStep(s: PhysicsScale): number {
  const max = gravitySliderMax(s)
  if (max <= 30)   return 0.1
  if (max <= 300)  return 1
  return 10
}
