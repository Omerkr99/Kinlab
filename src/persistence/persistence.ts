/**
 * persistence.ts — KAN-112: Save / Load / Export utilities
 *
 * Save / Load use localStorage under the key SAVE_KEY.
 * Export produces a CSV blob downloaded via an <a> element.
 */
import { Body } from '../engine/Body'
import type { World } from '../engine/World'
import type { DataRecorder } from '../recorder'

const SAVE_KEY = 'kinlab-save-v1'

// ── Save-state schema ─────────────────────────────────────────────────────────

interface BodySnapshot {
  x:       number
  y:       number
  vx:      number
  vy:      number
  ax:      number
  ay:      number
  mass:    number
  radius:  number
  type:    string
  color?:  string
}

export interface SaveState {
  version:          1
  bodies:           BodySnapshot[]
  gravity:          number
  floorEnabled:     boolean
  wallsEnabled:     boolean
  floorRestitution: number
  floorFriction:    number
}

// ── Save ──────────────────────────────────────────────────────────────────────

export function saveWorld(world: World): void {
  const state: SaveState = {
    version:          1,
    bodies:           world.bodies.map(b => ({
      x: b.x, y: b.y, vx: b.vx, vy: b.vy,
      ax: b.ax, ay: b.ay,
      mass: b.mass, radius: b.radius,
      type: b.type, color: b.color,
    })),
    gravity:          world.gravity,
    floorEnabled:     world.floorEnabled,
    wallsEnabled:     world.wallsEnabled,
    floorRestitution: world.floorRestitution,
    floorFriction:    world.floorFriction,
  }
  localStorage.setItem(SAVE_KEY, JSON.stringify(state))
}

// ── Load ──────────────────────────────────────────────────────────────────────

/**
 * Restore world state from localStorage.
 * Returns the loaded SaveState (so the caller can sync React state like gravity),
 * or null if nothing is saved yet.
 */
export function loadWorld(world: World): SaveState | null {
  const raw = localStorage.getItem(SAVE_KEY)
  if (!raw) return null

  let state: SaveState
  try {
    state = JSON.parse(raw) as SaveState
    if (state.version !== 1) return null
  } catch {
    return null
  }

  // Replace bodies array (in-place mutation so existing refs stay valid)
  world.bodies.length = 0
  for (const snap of state.bodies) {
    const b = new Body(snap)
    if (snap.type)  b.type  = snap.type
    if (snap.color) b.color = snap.color
    world.bodies.push(b)
  }

  world.gravity          = state.gravity
  world.floorEnabled     = state.floorEnabled
  world.wallsEnabled     = state.wallsEnabled
  world.floorRestitution = state.floorRestitution
  world.floorFriction    = state.floorFriction

  // Re-enable collision detection if multiple bodies were restored
  world.collisionDetection = world.bodies.length > 1

  return state
}

/** Returns true if there is a save in localStorage. */
export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null
}

// ── CSV Export ────────────────────────────────────────────────────────────────

/**
 * Export recorder data as a CSV file downloaded by the browser.
 * Returns false if there is no data to export.
 */
export function exportCSV(recorder: DataRecorder): boolean {
  const n = recorder.getLength()
  if (n === 0) return false

  const t  = recorder.getSeries('time')
  const x  = recorder.getSeries('x')
  const y  = recorder.getSeries('y')
  const vx = recorder.getSeries('vx')
  const vy = recorder.getSeries('vy')
  const ax = recorder.getSeries('ax')
  const ay = recorder.getSeries('ay')

  const header = 'time_s,x_px,y_px,vx_pxs,vy_pxs,ax_pxs2,ay_pxs2\n'
  const rows: string[] = []
  for (let i = 0; i < n; i++) {
    rows.push(
      `${t[i].toFixed(4)},${x[i].toFixed(3)},${y[i].toFixed(3)},` +
      `${vx[i].toFixed(3)},${vy[i].toFixed(3)},${ax[i].toFixed(3)},${ay[i].toFixed(3)}`
    )
  }

  const csv  = header + rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `kinlab-data-${Date.now()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}
