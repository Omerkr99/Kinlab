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
import { World, Body, InteractionLayer } from './engine'
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
world.addBody(new Body({ x: 300, y: 50 }))
const recorder    = new DataRecorder()
const interaction = new InteractionLayer()

/** Convert engine gravity (px/s²) → SI (m/s²) given a scale, then back */
function preserveGravity(
  currentEngine: number,
  oldScale: PhysicsScale,
  newScale: PhysicsScale,
): number {
  // px mode: treat gravity as m/s² directly
  if (oldScale.metersPerUnit == null) return currentEngine
  const ms2 = currentEngine * oldScale.metersPerUnit / oldScale.pixelsPerUnit
  return gravityMs2ToEngine(ms2, newScale)
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Popup mode: standalone graph window (opened via ⤢ button) ─────────────
  const isPopup = new URLSearchParams(window.location.search).get('popup') === 'true'
  if (isPopup) return <GraphPopup />

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

  // ── Render ─────────────────────────────────────────────────────────────────
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
