export type SeriesKey = 'time' | 'x' | 'y' | 'vx' | 'vy' | 'ax' | 'ay'

export class DataRecorder {
  private recording = false
  private data: Record<SeriesKey, number[]> = {
    time: [], x: [], y: [], vx: [], vy: [], ax: [], ay: [],
  }

  start(): void  { this.recording = true }
  stop(): void   { this.recording = false }

  reset(): void {
    this.recording = false
    this.data = { time: [], x: [], y: [], vx: [], vy: [], ax: [], ay: [] }
  }

  record(time: number, x: number, y: number, vx: number, vy: number, ax: number, ay: number): void {
    if (!this.recording) return
    this.data.time.push(time)
    this.data.x.push(x)
    this.data.y.push(y)
    this.data.vx.push(vx)
    this.data.vy.push(vy)
    this.data.ax.push(ax)
    this.data.ay.push(ay)
  }

  getSeries(key: SeriesKey): number[] { return [...this.data[key]] }
  getLength(): number                  { return this.data.time.length }
}
