import { useState } from 'react'
import { World, Body, InteractionLayer } from './engine'
import { DataRecorder, SeriesKey } from './recorder'
import { WorldCanvas } from './canvas/WorldCanvas'
import { GraphCanvas } from './canvas/GraphCanvas'
import { ControlBar } from './components/ControlBar'
import { AxisSelector } from './components/AxisSelector'
import { DemoPanel } from './components/DemoPanel'

// ⚠️ OUTSIDE component — stable refs, never recreated on render
const world = new World()
world.addBody(new Body({ x: 300, y: 50 }))
const recorder = new DataRecorder()
const interaction = new InteractionLayer()
// KAN-35: recorder.start() removed from module level.
// Recording begins explicitly when the user clicks Play in ControlBar.

export default function App() {
  const [xKey, setXKey] = useState<SeriesKey>('time')
  const [yKey, setYKey] = useState<SeriesKey>('y')   // default: time vs y (most informative)
  const [flipY, setFlipY] = useState(false)           // false = physical ↑+ convention (default)

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#f5f6f8', minHeight: '100vh', padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>
          🔬 KinLab
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>
          Interactive Physics Simulation — drag the ball, record data, analyze graphs
        </p>
      </div>

      {/* Main layout */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Left: simulation */}
        <div>
          <div style={{ marginBottom: 6, fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
            Simulation
          </div>
          <ControlBar world={world} recorder={recorder} interaction={interaction} />
          <WorldCanvas world={world} recorder={recorder} interaction={interaction} />
          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            Press ▶ Play to start recording · Drag ball to reposition
          </div>
        </div>

        {/* Right: graph */}
        <div>
          <div style={{ marginBottom: 6, fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
            Data Graph
          </div>
          <AxisSelector xKey={xKey} yKey={yKey} onXChange={setXKey} onYChange={setYKey} />
          <GraphCanvas recorder={recorder} xKey={xKey} yKey={yKey} flipY={flipY} onFlipY={setFlipY} />
          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            Updates live · Change axes to explore: x, y, vx, vy, ax, ay
          </div>
        </div>
      </div>

      {/* Day 2 Demo Panel */}
      <DemoPanel />
    </div>
  )
}
