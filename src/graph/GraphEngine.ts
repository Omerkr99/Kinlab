import { DataRecorder, SeriesKey } from '../recorder'
import { PhysicsScale, DEFAULT_SCALE, axisLabel } from '../units/PhysicsScale'

// Small helper to format axis tick values compactly
function fmtTick(v: number): string {
  if (v === 0) return '0'
  if (Math.abs(v) >= 1e4 || (Math.abs(v) < 0.01 && v !== 0)) return v.toExponential(1)
  return Number(v.toFixed(2)).toString()
}

/** One plotted series in a multi-series graph (KAN-86) */
export interface SeriesConfig {
  xKey:    SeriesKey
  yKey:    SeriesKey
  color:   string
  label:   string
  visible: boolean
  flipY?:  boolean
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
   * Draw the graph with multiple overlaid series (KAN-86 legend support).
   *
   * Each visible series is auto-scaled together on a shared axis range
   * with 5% / 8% padding (KAN-88).
   * A legend is drawn in the top-right corner of the canvas.
   */
  drawMulti(
    recorder: DataRecorder,
    series:   SeriesConfig[],
    scale:    PhysicsScale = DEFAULT_SCALE,
  ): void {
    const ctx = this.ctx
    if (!ctx) return

    const ppu = scale.pixelsPerUnit

    // Convert each visible series to physical unit arrays
    type SeriesData = { xs: number[]; ys: number[]; cfg: SeriesConfig }
    const seriesData: SeriesData[] = []
    for (const cfg of series) {
      if (!cfg.visible) continue
      const rawXs = recorder.getSeries(cfg.xKey)
      const rawYs = recorder.getSeries(cfg.yKey)
      if (rawXs.length < 2) continue

      const xs = cfg.xKey !== 'time' && ppu !== 1 ? rawXs.map(v => v / ppu) : (rawXs as number[])
      const flipped = cfg.flipY ? rawYs.map(v => -v) : (rawYs as number[])
      const ys = cfg.yKey !== 'time' && ppu !== 1 ? flipped.map(v => v / ppu) : flipped

      seriesData.push({ xs, ys, cfg })
    }

    ctx.clearRect(0, 0, this.w, this.h)
    this.drawGrid(ctx)

    if (seriesData.length === 0) return

    // Compute combined axis extents across all visible series (KAN-88)
    let xMinRaw = Infinity, xMaxRaw = -Infinity
    let yMinRaw = Infinity, yMaxRaw = -Infinity
    for (const { xs, ys } of seriesData) {
      xMinRaw = Math.min(xMinRaw, ...xs)
      xMaxRaw = Math.max(xMaxRaw, ...xs)
      yMinRaw = Math.min(yMinRaw, ...ys)
      yMaxRaw = Math.max(yMaxRaw, ...ys)
    }

    const xPad = (xMaxRaw - xMinRaw || 1) * 0.05
    const yPad = (yMaxRaw - yMinRaw || 1) * 0.08
    const xMin = xMinRaw - xPad, xMax = xMaxRaw + xPad
    const yMin = yMinRaw - yPad, yMax = yMaxRaw + yPad

    // Use first visible series keys for axis labels
    const first = seriesData[0].cfg
    this.drawAxes(
      ctx,
      axisLabel(first.xKey, scale),
      axisLabel(first.yKey, scale),
      xMinRaw, xMaxRaw, yMinRaw, yMaxRaw,
    )

    // Draw each series in its color
    for (const { xs, ys, cfg } of seriesData) {
      this.drawData(ctx, xs, ys, xMin, xMax, yMin, yMax, cfg.color)
    }

    // Draw legend overlay (KAN-86)
    this.drawLegend(ctx, seriesData.map(d => ({ label: d.cfg.label, color: d.cfg.color })))
  }

  /**
   * Convenience single-series draw (backwards compat).
   * flipY  — negate every Y value (physical ↑+ vs canvas ↓+)
   * scale  — unit calibration
   */
  draw(
    recorder: DataRecorder,
    xKey: SeriesKey,
    yKey: SeriesKey,
    flipY  = false,
    scale: PhysicsScale = DEFAULT_SCALE,
  ): void {
    this.drawMulti(recorder, [{
      xKey, yKey, flipY, color: '#4A90E2', label: axisLabel(yKey, scale), visible: true,
    }], scale)
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
    color = '#4A90E2',
  ): void {
    const { w, h } = this
    const pad = 40
    const xRange = xMax - xMin || 1
    const yRange = yMax - yMin || 1
    const cx = (v: number) => pad + ((v - xMin) / xRange) * (w - pad - 10)
    const cy = (v: number) => (h - pad) - ((v - yMin) / yRange) * (h - pad - 10)
    ctx.strokeStyle = color; ctx.lineWidth = 2
    ctx.beginPath()
    xs.forEach((x, i) => i === 0 ? ctx.moveTo(cx(x), cy(ys[i])) : ctx.lineTo(cx(x), cy(ys[i])))
    ctx.stroke()
  }

  /** Legend overlay in top-right — drawn over the graph area (KAN-86) */
  private drawLegend(
    ctx: CanvasRenderingContext2D,
    items: Array<{ label: string; color: string }>,
  ): void {
    if (items.length <= 1) return  // no legend for single series

    const { w } = this
    const pad   = 8
    const lineH = 18
    const swatchW = 14, swatchH = 3
    const boxH = items.length * lineH + pad * 2
    const boxW = 120

    const bx = w - boxW - 12
    const by = 14

    // Background
    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    ctx.strokeStyle = '#E5E7EB'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(bx, by, boxW, boxH, 4)
    ctx.fill(); ctx.stroke()

    // Items
    items.forEach(({ label, color }, i) => {
      const y = by + pad + i * lineH + lineH / 2
      ctx.fillStyle = color
      ctx.fillRect(bx + pad, y - swatchH / 2, swatchW, swatchH)
      ctx.fillStyle = '#374151'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'left'
      // Truncate label to fit
      const maxW = boxW - swatchW - pad * 3
      let text = label
      while (text.length > 3 && ctx.measureText(text).width > maxW) text = text.slice(0, -1)
      if (text !== label) text += '…'
      ctx.fillText(text, bx + pad + swatchW + 4, y + 4)
    })
  }
}
