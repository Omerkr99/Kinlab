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
import { Day3Panel } from './components/Day3Panel'
import { GraphPopup } from './components/GraphPopup'

// ⚠️ OUTSIDE component — stable refs, never recreated on render
const world       = new World()
world.addBody(new Body({ x: 300, y: 50 }))
const recorder    = new DataRecorder()
const interaction = new InteractionLayer()

export default function App() {
  // ── Popup mode: render standalone graph window ────────────────────────────
  const isPopup = new URLSearchParams(window.location.search).get('popup') === 'true'
  if (isPopup) return <GraphPopup />

  // ── Normal app state ──────────────────────────────────────────────────────
  const [xKey,    setXKey]    = useState<SeriesKey>('time')
  const [yKey,    setYKey]    = useState<SeriesKey>('y')
  const [flipY,   setFlipY]   = useState(false)
  const [gravity, setGravity] = useState(world.gravity)   // KAN-45

  const handleGravity = (g: number) => {
    world.gravity = g   // direct mutation — World reads this every step()
    setGravity(g)       // update slider display
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

          {/* KAN-41 indicator lives inside ControlBar; graph has ↑↓ arrows + ⤢ pop-out */}
          <GraphCanvas recorder={recorder} xKey={xKey} yKey={yKey} flipY={flipY} onFlipY={setFlipY} />

          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            Updates live · ↑↓ flip Y direction · ⤢ pop-out for a dedicated graph window · ⬇ CSV
          </div>

          {/* KAN-43: data table (collapsible) */}
          <DataTable recorder={recorder} />
        </div>
      </div>

      {/* Day 3 Demo Panel */}
      <Day3Panel />
    </div>
  )
}
