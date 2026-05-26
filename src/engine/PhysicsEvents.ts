/**
 * KinLab — Physics event bus
 *
 * Lightweight pub/sub for collision and state-change events emitted by the
 * physics engine. Components can subscribe without coupling to World internals.
 *
 * Usage:
 *   const bus = new PhysicsEventBus()
 *   bus.on('floor-bounce', e => console.log('bounce at t=', e.time))
 *   // inside World.step() or a wrapper:
 *   bus.emit({ type: 'floor-bounce', bodyIndex: 0, time: world.time, vy: body.vy })
 */

// ── Event types ───────────────────────────────────────────────────────────────

export type PhysicsEventType =
  | 'floor-bounce'   // ball hit the floor and reversed vy
  | 'wall-bounce'    // ball hit a left/right wall and reversed vx
  | 'rest'           // ball velocity clamped to zero (came to rest)
  | 'step'           // one World.step() completed (every frame)

// ── Event payload ─────────────────────────────────────────────────────────────

export interface PhysicsEvent {
  type: PhysicsEventType
  /** Index of the body in World.bodies that triggered the event */
  bodyIndex: number
  /** World.time at the moment of the event (seconds) */
  time: number
  /** Body position at event (px) */
  x?: number
  y?: number
  /** Body velocity at event (px/s), after bounce correction */
  vx?: number
  vy?: number
}

// ── Handler type ──────────────────────────────────────────────────────────────

export type PhysicsHandler = (event: PhysicsEvent) => void

// ── Bus implementation ────────────────────────────────────────────────────────

export class PhysicsEventBus {
  private handlers = new Map<PhysicsEventType, Set<PhysicsHandler>>()

  /**
   * Subscribe to an event type.
   * Registering the same handler twice for the same type is a no-op.
   */
  on(type: PhysicsEventType, handler: PhysicsHandler): void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(handler)
  }

  /**
   * Unsubscribe a handler. Safe to call even if handler was never registered.
   */
  off(type: PhysicsEventType, handler: PhysicsHandler): void {
    this.handlers.get(type)?.delete(handler)
  }

  /**
   * Emit an event to all subscribed handlers for its type.
   * Handlers are called synchronously in insertion order.
   */
  emit(event: PhysicsEvent): void {
    this.handlers.get(event.type)?.forEach(h => h(event))
  }

  /**
   * Remove all handlers for a specific type, or all handlers if no type given.
   */
  clear(type?: PhysicsEventType): void {
    if (type !== undefined) {
      this.handlers.delete(type)
    } else {
      this.handlers.clear()
    }
  }

  /**
   * Number of listeners registered for a given event type.
   */
  listenerCount(type: PhysicsEventType): number {
    return this.handlers.get(type)?.size ?? 0
  }

  /**
   * True if at least one handler is registered for the given type.
   */
  hasListeners(type: PhysicsEventType): boolean {
    return this.listenerCount(type) > 0
  }
}
