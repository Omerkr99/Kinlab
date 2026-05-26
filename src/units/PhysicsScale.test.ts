/**
 * PhysicsScale unit tests
 * Verifies conversions, labels, gravity helpers, and custom-scale factory.
 */
import { describe, test, expect } from 'vitest'
import {
  SCALE_PRESETS, DEFAULT_SCALE,
  pxToUnit, unitToPx,
  distUnit, velUnit, accelUnit,
  axisLabel, dropdownLabel,
  makeCustomScale,
  gravityMs2ToEngine, gravityEngineToDisplay,
  gravitySliderMax, gravitySliderStep,
  GRAVITY_PRESETS_MS2,
} from './PhysicsScale'

// ─── Presets ──────────────────────────────────────────────────────────────────

describe('PhysicsScale: presets', () => {
  test('px preset — 1:1 identity', () => {
    const s = SCALE_PRESETS.px
    expect(s.pixelsPerUnit).toBe(1)
    expect(s.metersPerUnit).toBeNull()
    expect(pxToUnit(300, s)).toBe(300)
    expect(unitToPx(300, s)).toBe(300)
  })

  test('cm preset — 10 px = 1 cm', () => {
    const s = SCALE_PRESETS.cm
    expect(s.pixelsPerUnit).toBe(10)
    expect(s.metersPerUnit).toBe(0.01)
    expect(pxToUnit(600, s)).toBe(60)    // canvas width 60 cm
    expect(pxToUnit(500, s)).toBe(50)    // floor height 50 cm
    expect(unitToPx(60, s)).toBe(600)
  })

  test('m preset — 100 px = 1 m', () => {
    const s = SCALE_PRESETS.m
    expect(s.pixelsPerUnit).toBe(100)
    expect(s.metersPerUnit).toBe(1)
    expect(pxToUnit(600, s)).toBe(6)     // canvas width 6 m
    expect(pxToUnit(500, s)).toBe(5)     // floor height 5 m
    expect(unitToPx(9.8, s)).toBeCloseTo(980, 6)  // Earth g in px/s²
  })

  test('default scale is px', () => {
    expect(DEFAULT_SCALE.id).toBe('px')
    expect(DEFAULT_SCALE.pixelsPerUnit).toBe(1)
  })
})

// ─── Conversions ──────────────────────────────────────────────────────────────

describe('PhysicsScale: conversion round-trips', () => {
  test('pxToUnit and unitToPx are exact inverses for all presets', () => {
    const vals = [0, 1, 50, 100, 300, 500, 600, -42, 0.5]
    for (const s of Object.values(SCALE_PRESETS)) {
      for (const v of vals) {
        expect(unitToPx(pxToUnit(v, s), s)).toBeCloseTo(v, 10)
        expect(pxToUnit(unitToPx(v, s), s)).toBeCloseTo(v, 10)
      }
    }
  })

  test('pxToUnit(0, any) = 0', () => {
    for (const s of Object.values(SCALE_PRESETS)) expect(pxToUnit(0, s)).toBe(0)
  })

  test('negative values are preserved', () => {
    expect(pxToUnit(-100, SCALE_PRESETS.m)).toBeCloseTo(-1, 10)
    expect(unitToPx(-5,   SCALE_PRESETS.m)).toBeCloseTo(-500, 10)
  })
})

// ─── Unit labels ─────────────────────────────────────────────────────────────

describe('PhysicsScale: unit labels', () => {
  test('px labels', () => {
    expect(distUnit(SCALE_PRESETS.px)).toBe('px')
    expect(velUnit(SCALE_PRESETS.px)).toBe('px/s')
    expect(accelUnit(SCALE_PRESETS.px)).toBe('px/s²')
  })

  test('cm labels', () => {
    expect(distUnit(SCALE_PRESETS.cm)).toBe('cm')
    expect(velUnit(SCALE_PRESETS.cm)).toBe('cm/s')
    expect(accelUnit(SCALE_PRESETS.cm)).toBe('cm/s²')
  })

  test('m labels', () => {
    expect(distUnit(SCALE_PRESETS.m)).toBe('m')
    expect(velUnit(SCALE_PRESETS.m)).toBe('m/s')
    expect(accelUnit(SCALE_PRESETS.m)).toBe('m/s²')
  })

  test('axisLabel produces correct strings for all keys', () => {
    const s = SCALE_PRESETS.m
    expect(axisLabel('time', s)).toBe('time (s)')
    expect(axisLabel('x',    s)).toBe('x (m)')
    expect(axisLabel('y',    s)).toBe('height (m)')
    expect(axisLabel('vx',   s)).toBe('vx (m/s)')
    expect(axisLabel('vy',   s)).toBe('vy (m/s)')
    expect(axisLabel('ax',   s)).toBe('ax (m/s²)')
    expect(axisLabel('ay',   s)).toBe('ay (m/s²)')
  })

  test('dropdownLabel includes (↑+) for velocity and accel', () => {
    const s = SCALE_PRESETS.m
    expect(dropdownLabel('vy', s)).toContain('↑+')
    expect(dropdownLabel('ay', s)).toContain('↑+')
    expect(dropdownLabel('time', s)).toBe('time (s)')
  })
})

// ─── Custom scale ─────────────────────────────────────────────────────────────

describe('PhysicsScale: custom scale factory', () => {
  test('basic custom scale converts correctly', () => {
    const s = makeCustomScale(50, 'ft')
    expect(s.pixelsPerUnit).toBe(50)
    expect(s.unitSymbol).toBe('ft')
    expect(pxToUnit(150, s)).toBe(3)
    expect(unitToPx(2, s)).toBe(100)
  })

  test('pixelsPerUnit = 0 is clamped to 0.001 (no divide-by-zero)', () => {
    const s = makeCustomScale(0)
    expect(s.pixelsPerUnit).toBe(0.001)
    expect(isFinite(pxToUnit(100, s))).toBe(true)
  })

  test('negative pixelsPerUnit is clamped positive', () => {
    const s = makeCustomScale(-50)
    expect(s.pixelsPerUnit).toBeGreaterThan(0)
  })
})

// ─── Gravity helpers ──────────────────────────────────────────────────────────

describe('PhysicsScale: gravity helpers', () => {
  test('px mode: gravity passes through unchanged', () => {
    const s = SCALE_PRESETS.px
    expect(gravityMs2ToEngine(9.8, s)).toBe(9.8)
    expect(gravityEngineToDisplay(9.8, s)).toBe(9.8)
  })

  test('m scale: 9.8 m/s² → 980 px/s² (real Earth gravity!)', () => {
    const s = SCALE_PRESETS.m
    expect(gravityMs2ToEngine(9.8, s)).toBeCloseTo(980, 6)
    expect(gravityEngineToDisplay(980, s)).toBeCloseTo(9.8, 6)
  })

  test('m scale: 1.6 m/s² (Moon) → 160 px/s²', () => {
    const s = SCALE_PRESETS.m
    expect(gravityMs2ToEngine(1.6, s)).toBeCloseTo(160, 6)
  })

  test('cm scale: 9.8 m/s² → 9 800 px/s²', () => {
    const s = SCALE_PRESETS.cm
    // 9.8 m/s² = 980 cm/s², 1cm = 10px → 9800 px/s²
    expect(gravityMs2ToEngine(9.8, s)).toBeCloseTo(9_800, 4)
  })

  test('cm scale display: 9800 px/s² → 980 cm/s²', () => {
    const s = SCALE_PRESETS.cm
    expect(gravityEngineToDisplay(9_800, s)).toBeCloseTo(980, 4)
  })

  test('gravityMs2ToEngine and gravityEngineToDisplay are inverses (m scale)', () => {
    const s = SCALE_PRESETS.m
    for (const v of [0, 1.6, 9.8, 24.8]) {
      const engine = gravityMs2ToEngine(v, s)
      expect(gravityEngineToDisplay(engine, s)).toBeCloseTo(v, 8)
    }
  })

  test('gravitySliderMax: px → 30, m → 30, cm → 3000', () => {
    expect(gravitySliderMax(SCALE_PRESETS.px)).toBe(30)
    expect(gravitySliderMax(SCALE_PRESETS.m)).toBe(30)
    expect(gravitySliderMax(SCALE_PRESETS.cm)).toBe(3000)
  })

  test('gravitySliderStep is smaller for large ranges', () => {
    expect(gravitySliderStep(SCALE_PRESETS.px)).toBe(0.1)
    expect(gravitySliderStep(SCALE_PRESETS.m)).toBe(0.1)
    const stepCm = gravitySliderStep(SCALE_PRESETS.cm)
    expect(stepCm).toBeGreaterThanOrEqual(1)
  })

  test('all GRAVITY_PRESETS_MS2 values are non-negative', () => {
    for (const p of GRAVITY_PRESETS_MS2) {
      expect(p.ms2).toBeGreaterThanOrEqual(0)
    }
  })

  test('Earth preset ms2 = 9.8', () => {
    const earth = GRAVITY_PRESETS_MS2.find(p => p.label === 'Earth')
    expect(earth?.ms2).toBe(9.8)
  })
})

// ─── Physics calibration sanity checks ───────────────────────────────────────

describe('PhysicsScale: physics calibration', () => {
  test('m scale: canvas 600px = 6m wide', () => {
    expect(pxToUnit(600, SCALE_PRESETS.m)).toBe(6)
  })

  test('m scale: FLOOR_Y 500px = 5m tall', () => {
    expect(pxToUnit(500, SCALE_PRESETS.m)).toBe(5)
  })

  test('cm scale: canvas 600px = 60cm wide', () => {
    expect(pxToUnit(600, SCALE_PRESETS.cm)).toBe(60)
  })

  test('m and cm scales each round-trip correctly back to pixels', () => {
    // m  scale: 100px → 1 m   → ×100 px/m  → 100 px ✓
    // cm scale: 100px → 10 cm → ×10  px/cm → 100 px ✓
    // The two presets represent different physical calibrations (m-canvas ≠ cm-canvas);
    // the invariant is that unitToPx(pxToUnit(px, s), s) === px, not cross-scale equality.
    const inM  = pxToUnit(100, SCALE_PRESETS.m)   // 1 m
    const inCm = pxToUnit(100, SCALE_PRESETS.cm)  // 10 cm
    expect(inM * SCALE_PRESETS.m.pixelsPerUnit).toBeCloseTo(100, 10)
    expect(inCm * SCALE_PRESETS.cm.pixelsPerUnit).toBeCloseTo(100, 10)
  })
})
