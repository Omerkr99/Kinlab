import { DataRecorder, SeriesKey } from '../recorder'

export class GraphEngine {
  private ctx: CanvasRenderingContext2D | null
  private w: number
  private h: number

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')   // may be null in jsdom / headless
    this.w = canvas.width
    this.h = canvas.height
  }

  /** flipY negates every Y value before drawing — lets you switch between
   *  physical convention (↑+, default) and canvas convention (↓+). */
  draw(recorder: DataRecorder, xKey: SeriesKey, yKey: SeriesKey, flipY = false): void {
    const ctx = this.ctx
    if (!ctx) return                     // guard: null in test environments
    const xs = recorder.getSeries(xKey)
    const raw = recorder.getSeries(yKey)
    const ys = flipY ? raw.map(v => -v) : raw
    if (xs.length < 2) return

    ctx.clearRect(0, 0, this.w, this.h)
    this.drawGrid(ctx)
    this.drawAxes(ctx, xKey, yKey)
    this.drawData(ctx, xs, ys)
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

  private drawAxes(ctx: CanvasRenderingContext2D, xLabel: string, yLabel: string): void {
    const { w, h } = this
    const pad = 40
    ctx.strokeStyle = '#444'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(pad, 10); ctx.lineTo(pad, h - pad); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(pad, h - pad); ctx.lineTo(w - 10, h - pad); ctx.stroke()
    ctx.fillStyle = '#444'; ctx.font = '12px sans-serif'
    ctx.fillText(xLabel, w / 2, h - 6)
    ctx.save(); ctx.translate(12, h / 2); ctx.rotate(-Math.PI / 2)
    ctx.fillText(yLabel, 0, 0); ctx.restore()
  }

  private drawData(ctx: CanvasRenderingContext2D, xs: number[], ys: number[]): void {
    const { w, h } = this
    const pad = 40
    // KAN-34: reduce instead of spread — no stack overflow beyond 65k elements
    const xMin = xs.reduce((a, b) => Math.min(a, b), Infinity)
    const xMax = xs.reduce((a, b) => Math.max(a, b), -Infinity)
    const yMin = ys.reduce((a, b) => Math.min(a, b), Infinity)
    const yMax = ys.reduce((a, b) => Math.max(a, b), -Infinity)
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
