/**
 * App.tsx — root entry point
 *
 * Responsibilities:
 *  1. Create stable engine objects (World, Body, DataRecorder, InteractionLayer)
 *  2. Manage the PhysicsScale + gravity (UI display state)
 *  3. Handle popup mode (standalone GraphPopup window)
 *  4. Render KinLabShell — the full UI shell that hosts everything
 *
 * Physics logic, simulation state, and layout all live in KinLabShell.
 */
import { useState, useEffect } from 'react'
import { World, BodyFactory, InteractionLayer } from './engine'
import { PhysicsEventBus } from './engine/PhysicsEvents'
import { DataRecorder } from './recorder'
import { GraphPopup } from './components/GraphPopup'
import { KinLabShell } from './shell/KinLabShell'
import {
  PhysicsScale, DEFAULT_SCALE,
  gravityMs2ToEngine,
} from './units/PhysicsScale'

// ── Stable engine objects (created once, never recreated on re-render) ────────
const eventBus    = new PhysicsEventBus()
const world       = new World()
world.bus         = eventBus
world.addBody(BodyFactory.circle({}, 0))  // KAN-97: use BodyFactory for initial body
const recorder    = new DataRecorder()
const interaction = new InteractionLayer()

/**
 * Convert engine gravity (px/s²) across a scale change.
 *
 * Strategy:
 *  1. Convert currentEngine gravity to SI (m/s²):
 *     - Calibrated scale (cm, m, custom): ms2 = enginePx * metersPerUnit / pixelsPerUnit
 *     - px scale (no real-world tie): value was stored as m/s² by convention
 *       (gravityMs2ToEngine for px just returns ms2 unchanged), so ms2 = currentEngine
 *  2. Convert ms2 → engine units for the new scale via gravityMs2ToEngine.
 *
 * Example: px Earth (9.8) → m scale = 9.8 m/s² × (100 px/m) = 980 px/s² ✓
 *          m Earth (980) → px scale = 980 × (1 / 100) = 9.8 → gravityMs2ToEngine(9.8, px) = 9.8 ✓
 *
 * KAN-103: Previously returned `currentEngine` unchanged when oldScale.metersPerUnit == null,
 *          which left gravity at 9.8 px/s² after switching to m mode (≈ zero-gravity effect).
 */
function preserveGravity(
  currentEngine: number,
  oldScale: PhysicsScale,
  newScale: PhysicsScale,
): number {
  // Derive SI value regardless of which scale we're coming from
  const ms2 = oldScale.metersPerUnit == null
    ? currentEngine                                                    // px mode: stored as m/s²
    : currentEngine * oldScale.metersPerUnit / oldScale.pixelsPerUnit // calibrated: convert back to m/s²
  return gravityMs2ToEngine(ms2, newScale)
}

// ── SimApp — owns scale + gravity state; rendered only in non-popup mode ─────
//
// Extracted to its own component so that React hooks (useState, useEffect)
// are always called unconditionally, satisfying the Rules of Hooks.
// Previously the hooks lived in App() but were preceded by an early return
// for popup mode — a violation that React's linter and future strict-mode
// would break on.

function SimApp() {
  // ── Scale + gravity state (lifted here so they survive tab switches) ───────
  const [scale,   setScale]   = useState<PhysicsScale>(DEFAULT_SCALE)
  const [gravity, setGravity] = useState(world.gravity)

  const handleGravityChange = (enginePxS2: number) => {
    world.gravity = enginePxS2
    setGravity(enginePxS2)
  }

  const handleScaleChange = (newScale: PhysicsScale) => {
    const newEngine = preserveGravity(gravity, scale, newScale)
    world.gravity   = newEngine
    setGravity(newEngine)
    setScale(newScale)
  }

  // ── BroadcastChannel: push recorder data to popup graph window ─────────────
  useEffect(() => {
    const ch = new BroadcastChannel('kinlab-graph')

    const broadcast = () => {
      if (recorder.getLength() === 0) return
      ch.postMessage({
        type:   'data',
        series: {
          time: recorder.getSeries('time'),
          x:    recorder.getSeries('x'),
          y:    recorder.getSeries('y'),
          vx:   recorder.getSeries('vx'),
          vy:   recorder.getSeries('vy'),
          ax:   recorder.getSeries('ax'),
          ay:   recorder.getSeries('ay'),
        },
      })
    }

    ch.onmessage = (e) => { if (e.data?.type === 'request') broadcast() }
    const id = setInterval(broadcast, 300)
    return () => { clearInterval(id); ch.close() }
  }, [])

  return (
    <KinLabShell
      world={world}
      recorder={recorder}
      interaction={interaction}
      eventBus={eventBus}
      scale={scale}
      onScaleChange={handleScaleChange}
      gravity={gravity}
      onGravityChange={handleGravityChange}
    />
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
//
// Top-level router: popup mode renders a bare GraphPopup window;
// normal mode renders SimApp (which owns all simulation state).

export default function App() {
  const isPopup = new URLSearchParams(window.location.search).get('popup') === 'true'
  if (isPopup) return <GraphPopup />
  return <SimApp />
}
