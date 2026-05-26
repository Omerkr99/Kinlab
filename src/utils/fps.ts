/**
 * KinLab — FPS meter
 *
 * Rolling-average frames-per-second counter.
 * Call `tick()` once per animation frame; read `.fps` for the smoothed average.
 *
 * Usage:
 *   const meter = new FpsMeter(60)
 *   // inside requestAnimationFrame:
 *   meter.tick(performance.now())
 *   console.log(`FPS: ${meter.fps.toFixed(1)}`)
 */
export class FpsMeter {
  private samples: number[] = []
  private lastTime: number | undefined = undefined
  private readonly maxSamples: number

  /**
   * @param maxSamples  Rolling window size (default 60 frames ≈ 1 second at 60fps)
   */
  constructor(maxSamples = 60) {
    this.maxSamples = maxSamples
  }

  /**
   * Record one frame tick.
   *
   * @param now  Current timestamp in ms (default: performance.now())
   */
  tick(now = performance.now()): void {
    if (this.lastTime !== undefined) {
      const dt = now - this.lastTime
      if (dt > 0) {
        this.samples.push(1000 / dt)
        if (this.samples.length > this.maxSamples) {
          this.samples.shift()
        }
      }
    }
    this.lastTime = now
  }

  /** Rolling average FPS over the last `maxSamples` frames. */
  get fps(): number {
    if (this.samples.length === 0) return 0
    const sum = this.samples.reduce((a, b) => a + b, 0)
    return sum / this.samples.length
  }

  /** Minimum instantaneous FPS in the current window. */
  get min(): number {
    return this.samples.length === 0 ? 0 : Math.min(...this.samples)
  }

  /** Maximum instantaneous FPS in the current window. */
  get max(): number {
    return this.samples.length === 0 ? 0 : Math.max(...this.samples)
  }

  /** Number of samples currently in the window (≤ maxSamples). */
  get sampleCount(): number {
    return this.samples.length
  }

  /** Clear all samples and reset the timer. */
  reset(): void {
    this.samples = []
    this.lastTime = undefined
  }

  /**
   * Formatted string for overlay display: "60.0 fps"
   */
  toString(): string {
    return `${this.fps.toFixed(1)} fps`
  }
}
