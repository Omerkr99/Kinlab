export type SeriesKey = 'time' | 'x' | 'vx' | 'ax'

export class DataRecorder {
  private recording = false
  private data: Record<SeriesKey, number[]> = {
    time: [],
    x: [],
    vx: [],
    ax: [],
  }

  start(): void {
    this.recording = true
  }

  stop(): void {
    this.recording = false
  }

  reset(): void {
    this.recording = false
    this.data = { time: [], x: [], vx: [], ax: [] }
  }

  record(time: number, x: number, vx: number, ax: number): void {
    if (!this.recording) return
    this.data.time.push(time)
    this.data.x.push(x)
    this.data.vx.push(vx)
    this.data.ax.push(ax)
  }

  getSeries(key: SeriesKey): number[] {
    return [...this.data[key]]
  }

  getLength(): number {
    return this.data.time.length
  }
}
