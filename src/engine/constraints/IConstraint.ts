/**
 * KinLab — IConstraint interface
 *
 * A constraint enforces a geometric relationship between one or two bodies
 * (e.g. fixed distance, fixed angle, fixed point). After the physics
 * integrator advances positions, World calls solve() on every registered
 * constraint for `constraintIterations` iterations to project bodies back
 * onto the constraint manifold.
 *
 * Rules (symmetric with IForce):
 *   DO: modify b.x, b.y, b.vx, b.vy (position-level correction)
 *   DON'T: modify b.fx, b.fy, b.ax, b.ay (those are force-pipeline fields)
 *   DON'T: read or write World state — only the bodies you own
 */

export interface IConstraint {
  /**
   * Project bodies onto the constraint manifold and correct velocities.
   * Called once per solver iteration inside World.step().
   *
   * @param dt  The time step used for this frame (seconds)
   */
  solve(dt: number): void
}
