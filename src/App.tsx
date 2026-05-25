import { useState } from 'react'
import { World, Body, InteractionLayer } from './engine'
import { DataRecorder, SeriesKey } from './recorder'
import { WorldCanvas } from './canvas/WorldCanvas'
import { GraphCanvas } from './canvas/GraphCanvas'
import { ControlBar } from './components/ControlBar'
import { AxisSelector } from './components/AxisSelector'
import { GravitySlider } from './components/GravitySlider'
import { DataTable } from './components/DataTable'
import { CsvExportButton } from './components/CsvExportButton'
import { DemoPanel } from './components/DemoPanel'

// ⚠️ OUTSIDE component — stable refs, never recreated on render
const world       = new World()
world.addBody(new Body({ x: 300, y: 50 }))
const recorder    = new DataRecorder()
const interaction = new InteractionLayer()

export default function App() {
  const [xKey,    setXKey]    = useState<SeriesKey>('time')
  const [yKey,    setYKey]    = useState<SeriesKey>('y')
  const [flipY,   setFlipY]   = useState(false)
  const [gravity, setGravity] = useState(world.gravity)   // KAN-45

  const handleGravity = (g: number) => {
    world.gravity = g   // direct mutation — World reads this every step()
    setGravity(g)       // update slider display
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#f5f6f8', minHeight: '100vh', padding: 24 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>
          🔬 KinLab
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>
          Interactive Physics Simulation — drag the ball, record data, analyze graphs
        </p>
      </div>

      {/* ── Main layout ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Left: simulation + gravity */}
        <div>
          <div style={{ marginBottom: 6, fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
            Simulation
          </div>
          <ControlBar world={world} recorder={recorder} interaction={interaction} />
          <WorldCanvas world={world} recorder={recorder} interaction={interaction} />

          {/* KAN-45: gravity slider */}
          <GravitySlider value={gravity} onChange={handleGravity} />

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
            <AxisSelector xKey={xKey} yKey={yKey} onXChange={setXKey} onYChange={setYKey} />
            {/* KAN-44: CSV export */}
            <CsvExportButton recorder={recorder} />
          </div>

          {/* KAN-41 indicator lives inside ControlBar; graph has ↑↓ arrows */}
          <GraphCanvas recorder={recorder} xKey={xKey} yKey={yKey} flipY={flipY} onFlipY={setFlipY} />

          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            Updates live · ↑↓ arrows flip Y direction · ⬇ CSV to download
          </div>

          {/* KAN-43: data table (collapsible) */}
          <DataTable recorder={recorder} />
        </div>
      </div>

      {/* Day 2 Demo Panel */}
      <DemoPanel />
    </div>
  )
}
