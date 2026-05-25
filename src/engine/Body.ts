export interface BodyState {
  x: number
  y: number
  vx: number
  vy: number
  ax: number
  ay: number
}

export class Body {
  x = 0
  y = 0
  vx = 0
  vy = 0
  ax = 0
  ay = 0

  constructor(init: Partial<BodyState> = {}) {
    Object.assign(this, init)
  }
}
