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
import { Day3Panel } from './components/Day3Panel'
import { GraphPopup } from './components/GraphPopup'
import {
  PhysicsScale, DEFAULT_SCALE,
  gravityMs2ToEngine, gravityEngineToDisplay,
} from './units/PhysicsScale'

// ⚠️ OUTSIDE component — stable refs, never recreated on render
const world       = new World()
world.addBody(new Body({ x: 300, y: 50 }))
const recorder    = new DataRecorder()
const interaction = new InteractionLayer()

/** Convert engine gravity (px/s²) to SI (m/s²) given a calibrated scale. */
function engineToMs2(enginePxS2: number, s: PhysicsScale): number {
  if (s.metersPerUnit == null) return enginePxS2   // px mode: treat as m/s² directly
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
  const [gravity, setGravity] = useState(world.gravity)   // engine px/s²
  const [scale,   setScale]   = useState<PhysicsScale>(DEFAULT_SCALE)

  /** Update engine gravity and sync slider display. */
  const handleGravity = (enginePxS2: number) => {
    world.gravity = enginePxS2
    setGravity(enginePxS2)
  }

  /**
   * Change unit scale.
   *
   * Preserves the physical meaning of gravity across the switch:
   *   current engine value → SI m/s² → new engine value
   * So if user had Earth (9.8 m/s²) in any mode, it stays Earth after switching.
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

    // Respond immediately when popup requests data
    ch.onmessage = (e) => { if (e.data?.type === 'request') broadcast() }

    // Also push updates every 300 ms while app is running
    const id = setInterval(broadcast, 300)

    return () => { clearInterval(id); ch.close() }
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#f5f6f8', minHeight: '100vh', padding: 24 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>
          🔬 KinLab
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>
          Interactive Physics Simulation — drag the ball, record data, analyze graphs
        </p>
      </div>

      {/* ── Scale selector (global, affects all display components) ────── */}
      <div style={{ marginBottom: 16 }}>
        <ScaleControl scale={scale} onChange={handleScaleChange} />
      </div>

      {/* ── Main layout ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Left: simulation + gravity */}
        <div>
          <div style={{ marginBottom: 6, fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
            Simulation
          </div>
          <ControlBar world={world} recorder={recorder} interaction={interaction} />
          <WorldCanvas world={world} recorder={recorder} interaction={interaction} scale={scale} />

          {/* KAN-45: gravity slider — scale-aware */}
          <GravitySlider value={gravity} onChange={handleGravity} scale={scale} />

          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            Press ▶ Play to start · Drag ball to reposition · Adjust gravity live
          </div>
        </div>

        {/* Right: graph + table */}
        <div>
          <div style={{ marginBottom: 6, fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
            Data Graph
          </div>

          {/* Axis selectors + CSV export */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <AxisSelector xKey={xKey} yKey={yKey} onXChange={setXKey} onYChange={setYKey} scale={scale} />
            {/* KAN-44: CSV export */}
            <CsvExportButton recorder={recorder} scale={scale} />
          </div>

          {/* KAN-41 indicator lives inside ControlBar; graph has ↑↓ arrows + ⤢ pop-out */}
          <GraphCanvas recorder={recorder} xKey={xKey} yKey={yKey} flipY={flipY} onFlipY={setFlipY} scale={scale} />

          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            Updates live · ↑↓ flip Y direction · ⤢ pop-out for a dedicated graph window · ⬇ CSV
          </div>

          {/* KAN-43: data table (collapsible) */}
          <DataTable recorder={recorder} scale={scale} />
        </div>
      </div>

      {/* Day 3 Demo Panel */}
      <Day3Panel />
    </div>
  )
}
