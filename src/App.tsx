import { useState, useEffect } from 'react'
import { World, Body, InteractionLayer } from './engine'
import { DataRecorder, SeriesKey } from './recorder'
import { WorldCanvas } from './canvas/WorldCanvas'
import { GraphCanvas } from './canvas/GraphCanvas'
import { ControlBar } from './components/ControlBar'
import { AxisSelector } from './components/AxisSelector'
import { GravitySlider } from './components/GravitySlider'
import { DataTable } from './components/DataTable'
import { CsvExportButton } from './components/CsvExportButton'
import { ScaleControl } from './components/ScaleControl'
import { Day9Panel }        from './components/Day9Panel'
import { ForcesDemoPanel } from './components/ForcesDemoPanel'
import { Day10Panel }       from './components/Day10Panel'
import { GraphPopup } from './components/GraphPopup'
import { AppShell }  from './components/AppShell'
import {
  PhysicsScale, DEFAULT_SCALE,
  gravityMs2ToEngine,
} from './units/PhysicsScale'
import { color, space, font } from './styles/tokens'

// ⚠️ OUTSIDE component — stable refs, never recreated on render
const world       = new World()
world.addBody(new Body({ x: 300, y: 50 }))
const recorder    = new DataRecorder()
const interaction = new InteractionLayer()

/** Convert engine gravity (px/s²) to SI (m/s²) given a calibrated scale. */
function engineToMs2(enginePxS2: number, s: PhysicsScale): number {
  if (s.metersPerUnit == null) return enginePxS2
  return enginePxS2 * s.metersPerUnit / s.pixelsPerUnit
}

export default function App() {
  // ── Popup mode: render standalone graph window ────────────────────────────
  const isPopup = new URLSearchParams(window.location.search).get('popup') === 'true'
  if (isPopup) return <GraphPopup />

  // ── Normal app state ──────────────────────────────────────────────────────
  const [xKey,    setXKey]    = useState<SeriesKey>('time')
  const [yKey,    setYKey]    = useState<SeriesKey>('y')
  const [flipY,   setFlipY]   = useState(false)
  const [gravity, setGravity] = useState(world.gravity)
  const [scale,   setScale]   = useState<PhysicsScale>(DEFAULT_SCALE)

  const handleGravity = (enginePxS2: number) => {
    world.gravity = enginePxS2
    setGravity(enginePxS2)
  }

  /**
   * Change unit scale, preserving physical meaning of gravity across switch.
   * current engine value → SI m/s² → new engine value
   */
  const handleScaleChange = (newScale: PhysicsScale) => {
    const ms2       = engineToMs2(gravity, scale)
    const newEngine = gravityMs2ToEngine(ms2, newScale)
    world.gravity   = newEngine
    setGravity(newEngine)
    setScale(newScale)
  }

  // ── BroadcastChannel: stream recorder data to popup graph window ──────────
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

  // ── Shared section heading style (used in slots below) ───────────────────
  const sectionLabel = {
    fontSize:      font.size.xs,
    fontWeight:    font.weight.semibold,
    color:         color.text.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom:  space[2],
  }

  // ── Slot: Simulation ──────────────────────────────────────────────────────
  const simulationSlot = (
    <div style={{ display: 'flex', gap: space[6], alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* Left: canvas + controls */}
      <div>
        <div style={sectionLabel}>Simulation</div>
        <ControlBar world={world} recorder={recorder} interaction={interaction} />
        <WorldCanvas world={world} recorder={recorder} interaction={interaction} scale={scale} />
        <GravitySlider value={gravity} onChange={handleGravity} scale={scale} />
        <p style={{ marginTop: space[2], fontSize: font.size.xs, color: color.text.muted }}>
          Press ▶ Play to start · Drag ball to reposition · Adjust gravity live
        </p>
      </div>

      {/* Right: graph + table moved to Analysis tab; keep a mini-preview here */}
      <div>
        <div style={sectionLabel}>Live Preview</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] }}>
          <AxisSelector xKey={xKey} yKey={yKey} onXChange={setXKey} onYChange={setYKey} scale={scale} />
          <CsvExportButton recorder={recorder} scale={scale} />
        </div>
        <GraphCanvas recorder={recorder} xKey={xKey} yKey={yKey} flipY={flipY} onFlipY={setFlipY} scale={scale} />
        <p style={{ marginTop: space[2], fontSize: font.size.xs, color: color.text.muted }}>
          Updates live · ↑↓ flip Y · ⤢ pop-out · ⬇ CSV
        </p>
      </div>
    </div>
  )

  // ── Slot: Spring Lab ─────────────────────────────────────────────────────
  const springSlot = (
    <div>
      <Day9Panel />
      <div style={{ marginTop: space[6] }}>
        <ForcesDemoPanel />
      </div>
    </div>
  )

  // ── Slot: Physics Lab ────────────────────────────────────────────────────
  const physicsSlot = <Day10Panel />

  // ── Slot: Analysis ───────────────────────────────────────────────────────
  const analysisSlot = (
    <div>
      <div style={sectionLabel}>Data Analysis</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[3] }}>
        <AxisSelector xKey={xKey} yKey={yKey} onXChange={setXKey} onYChange={setYKey} scale={scale} />
        <CsvExportButton recorder={recorder} scale={scale} />
      </div>
      <GraphCanvas recorder={recorder} xKey={xKey} yKey={yKey} flipY={flipY} onFlipY={setFlipY} scale={scale} />
      <p style={{ marginTop: space[2], fontSize: font.size.xs, color: color.text.muted }}>
        Updates live · ↑↓ flip Y direction · ⤢ pop-out for a dedicated graph window · ⬇ CSV
      </p>
      <div style={{ marginTop: space[4] }}>
        <DataTable recorder={recorder} scale={scale} />
      </div>
    </div>
  )

  // ── AppShell wires everything together ────────────────────────────────────
  return (
    <AppShell
      simulationSlot={simulationSlot}
      springSlot={springSlot}
      physicsSlot={physicsSlot}
      analysisSlot={analysisSlot}
      headerControls={
        <ScaleControl scale={scale} onChange={handleScaleChange} />
      }
    />
  )
}
