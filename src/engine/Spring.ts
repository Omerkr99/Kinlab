import type { SpringSnapshot } from '../types/index'
import { SpringForce }         from './forces/SpringForce'
import type { Body }            from './Body'

/**
 * Spring — domain entity for a Hooke's-law spring (Day 9).
 *
 * Modes:
 *   Anchored     — bodyA is connected to a fixed world-space point (anchorX, anchorY)
 *   Body-to-body — bodyA is connected to bodyB
 *
 * Usage:
 *   const spring = new Spring({ bodyA, stiffness: 5, restLength: 120, anchorX: 300, anchorY: 60 })
 *   world.addForce(spring.makeForce())   // register once; do not call makeForce() every frame
 *
 * Getters (currentLength, extension, potentialEnergy) read live body positions,
 * so they reflect the current simulation state on every read.
 *
 * snapshot() returns an immutable SpringSnapshot for UI readouts and tests.
 */
export class Spring {
  readonly stiffness:  number
  readonly restLength: number
  readonly damping:    number
  readonly bodyA:      Body
  readonly bodyB:      Body | null
  readonly anchorX:    number
  readonly anchorY:    number

  constructor(config: {
    bodyA:       Body
    stiffness:   number
    restLength:  number
    damping?:    number
    bodyB?:      Body | null
    anchorX?:    number
    anchorY?:    number
  }) {
    this.bodyA      = config.bodyA
    this.stiffness  = config.stiffness
    this.restLength = config.restLength
    this.damping    = config.damping  ?? 0
    this.bodyB      = config.bodyB    ?? null
    this.anchorX    = config.anchorX  ?? 0
    this.anchorY    = config.anchorY  ?? 0
  }

  // ── Live physics reads ──────────────────────────────────────────────────────

  /**
   * Current spring length: distance between bodyA and target (px).
   */
  get currentLength(): number {
    const tx = this.bodyB !== null ? this.bodyB.x : this.anchorX
    const ty = this.bodyB !== null ? this.bodyB.y : this.anchorY
    const dx = tx - this.bodyA.x
    const dy = ty - this.bodyA.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * Extension beyond rest length (px).
   * Positive  → spring is stretched.
   * Negative  → spring is compressed.
   */
  get extension(): number {
    return this.currentLength - this.restLength
  }

  /**
   * Spring potential energy: ½ k x²
   */
  get potentialEnergy(): number {
    const ext = this.extension
    return 0.5 * this.stiffness * ext * ext
  }

  // ── Factory & snapshot ──────────────────────────────────────────────────────

  /**
   * Create the IForce strategy for this spring.
   *
   * Call ONCE and register the result with world.addForce().
   * Do NOT call on every frame — create fresh only when rebuilding the scene.
   */
  makeForce(): SpringForce {
    return new SpringForce(
      this.stiffness,
      this.restLength,
      this.damping,
      this.bodyB,
      this.anchorX,
      this.anchorY,
    )
  }

  /**
   * Immutable point-in-time snapshot of spring state.
   * Safe to pass to React state, record in tests, or display in UI.
   */
  snapshot(): SpringSnapshot {
    return {
      currentLength:   this.currentLength,
      extension:       this.extension,
      potentialEnergy: this.potentialEnergy,
      stiffness:       this.stiffness,
      restLength:      this.restLength,
      damping:         this.damping,
    }
  }
}
