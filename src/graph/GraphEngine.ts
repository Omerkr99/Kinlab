import { DataRecorder, SeriesKey } from '../recorder'
import { PhysicsScale, DEFAULT_SCALE, axisLabel } from '../units/PhysicsScale'

// Small helper to format axis tick values compactly
function fmtTick(v: number): string {
  if (v === 0) return '0'
  if (Math.abs(v) >= 1e4 || (Math.abs(v) < 0.01 && v !== 0)) return v.toExponential(1)
  return Number(v.toFixed(2)).toString()
}

export class GraphEngine {
  private ctx: CanvasRenderingContext2D | null
  private w: number
  private h: number

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')   // may be null in jsdom / headless
    this.w = canvas.width
    this.h = canvas.height
  }

  /**
   * Draw the graph.
   *
   * flipY  — negate every Y value (physical ↑+ vs canvas ↓+)
   * scale  — unit calibration; converts px values to physical units before display.
   *          When scale is DEFAULT_SCALE (px, ppu=1) no allocation is performed.
   */
  draw(
    recorder: DataRecorder,
    xKey: SeriesKey,
    yKey: SeriesKey,
    flipY  = false,
    scale: PhysicsScale = DEFAULT_SCALE,
  ): void {
    const ctx = this.ctx
    if (!ctx) return                     // guard: null in test environments

    const rawXs = recorder.getSeries(xKey)
    const rawYs = recorder.getSeries(yKey)
    if (rawXs.length < 2) return

    // Convert to physical units.
    // Avoid allocating new arrays for the common px/no-flip case.
    const ppu        = scale.pixelsPerUnit
    const needsXConv = xKey !== 'time' && ppu !== 1
    const needsYConv = yKey !== 'time' && ppu !== 1

    const xs: number[] = needsXConv
      ? rawXs.map(v => v / ppu)
      : rawXs as unknown as number[]

    const rawYsFlipped: number[] = flipY
      ? rawYs.map(v => -v)
      : rawYs as unknown as number[]

    const ys: number[] = needsYConv
      ? rawYsFlipped.map(v => v / ppu)
      : rawYsFlipped

    // Compute min/max once — shared between drawAxes tick labels and drawData scaling
    const xMin = xs.reduce((a, b) => Math.min(a, b), Infinity)
    const xMax = xs.reduce((a, b) => Math.max(a, b), -Infinity)
    const yMin = ys.reduce((a, b) => Math.min(a, b), Infinity)
    const yMax = ys.reduce((a, b) => Math.max(a, b), -Infinity)

    ctx.clearRect(0, 0, this.w, this.h)
    this.drawGrid(ctx)
    this.drawAxes(ctx, axisLabel(xKey, scale), axisLabel(yKey, scale), xMin, xMax, yMin, yMax)
    this.drawData(ctx, xs, ys, xMin, xMax, yMin, yMax)
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    const { w, h } = this
    ctx.strokeStyle = '#e8e8e8'
    ctx.lineWidth = 0.5
    for (let x = 0; x <= w; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
    }
    for (let y = 0; y <= h; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }
  }

  private drawAxes(
    ctx: CanvasRenderingContext2D,
    xLabel: string,
    yLabel: string,
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number,
  ): void {
    const { w, h } = this
    const pad = 40
    ctx.strokeStyle = '#444'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(pad, 10); ctx.lineTo(pad, h - pad); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(pad, h - pad); ctx.lineTo(w - 10, h - pad); ctx.stroke()

    // Axis labels
    ctx.fillStyle = '#444'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(xLabel, w / 2, h - 6)
    ctx.save(); ctx.translate(12, h / 2); ctx.rotate(-Math.PI / 2)
    ctx.fillText(yLabel, 0, 0); ctx.restore()

    // Min / max tick annotations
    ctx.font = '9px sans-serif'; ctx.fillStyle = '#aaa'
    ctx.textAlign = 'left';  ctx.fillText(fmtTick(xMin), pad + 2, h - pad + 12)
    ctx.textAlign = 'right'; ctx.fillText(fmtTick(xMax), w - 10,  h - pad + 12)
    ctx.textAlign = 'right'
    ctx.fillText(fmtTick(yMin), pad - 4, h - pad - 4)
    ctx.fillText(fmtTick(yMax), pad - 4, 18)
    ctx.textAlign = 'left'  // reset
  }

  private drawData(
    ctx: CanvasRenderingContext2D,
    xs: number[],
    ys: number[],
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number,
  ): void {
    const { w, h } = this
    const pad = 40
    const xRange = xMax - xMin || 1
    const yRange = yMax - yMin || 1
    const cx = (v: number) => pad + ((v - xMin) / xRange) * (w - pad - 10)
    const cy = (v: number) => (h - pad) - ((v - yMin) / yRange) * (h - pad - 10)
    ctx.strokeStyle = '#4A90E2'; ctx.lineWidth = 2
    ctx.beginPath()
    xs.forEach((x, i) => i === 0 ? ctx.moveTo(cx(x), cy(ys[i])) : ctx.lineTo(cx(x), cy(ys[i])))
    ctx.stroke()
  }
}
