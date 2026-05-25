// Shared physics + canvas constants
// Single source of truth — import everywhere instead of hardcoding

export const FLOOR_Y      = 500   // px — must match canvas height layout
export const CANVAS_W     = 600   // simulation canvas width
export const CANVAS_H     = 520   // simulation canvas height (20px below floor)
export const BALL_RADIUS  = 20    // px
export const GRAVITY      = 9.8   // px/s² (visual scale)

// Wall collision bounds (KAN-42)
export const WALL_L       = BALL_RADIUS              // left wall: ball centre ≥ this
export const WALL_R       = CANVAS_W - BALL_RADIUS   // right wall: ball centre ≤ this
export const WALL_DAMPING = 0.8                      // energy retained per wall bounce
