import { vi } from 'vitest'

// jsdom does not implement HTMLCanvasElement.prototype.getContext.
// Provide a full mock so GraphEngine and canvas-dependent tests can run.
const mockCtx = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  arc: vi.fn(),
  ellipse: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  fillText: vi.fn(),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
}

HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx) as any
