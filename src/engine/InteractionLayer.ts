import { Body } from './Body'

export class InteractionLayer {
  private dragging: Body | null = null
  private paused = false

  startDrag(b: Body): void {
    this.dragging = b
  }

  updateDrag(x: number, y: number): void {
    if (!this.dragging) return
    this.dragging.x = x
    this.dragging.y = y
    this.dragging.vx = 0
    this.dragging.vy = 0
  }

  endDrag(): void {
    this.dragging = null
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    this.paused = false
  }

  isPaused(): boolean {
    return this.paused
  }

  isDragging(): boolean {
    return this.dragging !== null
  }
}
