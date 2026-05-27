import { BALL_RADIUS } from '../constants'

export interface BodyState {
  x: number
  y: number
  vx: number
  vy: number
  ax: number
  ay: number
  // Day 9 — optional so all existing callers need zero changes
  mass?: number  // kg (default 1 = unit mass)
  fx?:  number   // accumulated force x-component — cleared each step
  fy?:  number   // accumulated force y-component — cleared each step
  // Day 10 — optional so all existing callers need zero changes
  angle?:   number  // orientation (radians)
  omega?:   number  // angular velocity (rad/s)
  alpha?:   number  // angular acceleration (rad/s²)
  torque?:  number  // torque accumulator (N·m) — cleared each step
  inertia?: number  // moment of inertia (default 1)
  radius?:  number  // collision radius (px) — default BALL_RADIUS
  // KAN-111: display type label — 'Circle' by default
  type?:    string
  // KAN-107: user-chosen hex color for canvas rendering; undefined → use palette
  color?:   string
}

export class Body {
  x  = 0
  y  = 0
  vx = 0
  vy = 0
  ax = 0
  ay = 0
  // Day 9 additions
  mass = 1  // default unit mass — existing tests never set mass → unaffected
  fx   = 0  // force accumulator x
  fy   = 0  // force accumulator y
  // Day 10 additions
  angle   = 0           // orientation in radians
  omega   = 0           // angular velocity (rad/s)
  alpha   = 0           // angular acceleration (rad/s²)
  torque  = 0           // torque accumulator — cleared each step
  inertia = 1           // moment of inertia
  radius  = BALL_RADIUS // collision radius
  type    = 'Circle'   // KAN-111: display type — 'Circle' by default
  color?: string       // KAN-107: user-chosen hex color; undefined → use canvas palette

  constructor(init: Partial<BodyState> = {}) {
    Object.assign(this, init)
  }
}
