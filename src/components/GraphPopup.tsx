/**
 * GraphPopup — Full-screen graph in a detached browser window.
 *
 * Receives simulation data from the main KinLab window via
 * BroadcastChannel('kinlab-graph') and renders it with GraphEngine.
 *
 * To open: main window calls  window.open('?popup=true', 'kinlab-graph-popup', …)
 * The main App detects the ?popup=true param and renders this component instead.
 */
import { useRef, useEffect, useState } from 'react'
import { GraphEngine } from '../graph/GraphEngine'
import { DataRecorder, SeriesKey } from '../recorder'
import { AxisSelector } from './AxisSelector'

/** Lightweight stand-in for DataRecorder — wraps plain arrays received over BroadcastChannel */
function makeProxy(series: Record<string, number[]>): DataRecorder {
  return {
    getSeries: (key: SeriesKey) => series[key] ?? [],
    getLength: () => series['time']?.length ?? 0,
  } as unknown as DataRecorder
}

const arrowBtn = (active: boolean): React.CSSProperties => ({
  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 15, border: `1.5px solid ${active ? '#4A90E2' : '#ccc'}`, borderRadius: 5,
  background: active ? '#e8f0fb' : '#f9f9f9', color: active ? '#2060c0' : '#aaa',
  cursor: 'pointer', fontWeight: active ? 700 : 400, transition: 'all 0.12s',
  userSelect: 'none', padding: 0,
})

export function GraphPopup() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GraphEngine | null>(null)
  const proxyRef  = useRef<DataRecorder | null>(null)
  const chanRef   = useRef<BroadcastChannel | null>(null)

  const [xKey,        setXKey]       = useState<SeriesKey>('time')
  const [yKey,        setYKey]       = useState<SeriesKey>('y')
  const [flipY,       setFlipY]      = useState(false)
  const [connected,   setConnected]  = useState(false)
  const [sampleCount, setSampleCount] = useState(0)

  // ── Set up BroadcastChannel listener ──────────────────────────────────────
  useEffect(() => {
    const ch = new BroadcastChannel('kinlab-graph')
    chanRef.current = ch

    ch.onmessage = (evt) => {
      if (evt.data?.type !== 'data') return
      const series = evt.data.series as Record<string, number[]>
      proxyRef.current = makeProxy(series)
      setSampleCount(series['time']?.length ?? 0)
      setConnected(true)
    }

    // Ask main window for data immediately on open
    ch.postMessage({ type: 'request' })

    return () => { ch.close(); chanRef.current = null }
  }, [])

  // ── Init GraphEngine ───────────────────────────────────────────────────────
  useEffect(() => {
    if (canvasRef.current) engineRef.current = new GraphEngine(canvasRef.current)
  }, [])

  // ── Redraw loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (proxyRef.current && engineRef.current) {
        engineRef.current.draw(proxyRef.current, xKey, yKey, flipY)
      }
    }, 50)
    return () => clearInterval(id)
  }, [xKey, yKey, flipY])

  // ── Title update ──────────────────────────────────────────────────────────
  useEffect(() => {
    document.title = `KinLab Graph — ${xKey} vs ${yKey}`
  }, [xKey, yKey])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: '#f5f6f8', minHeight: '100vh', padding: 16,
      fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', gap: 12,
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>
          🔬 KinLab — Graph Window
        </h2>

        {/* Connection status badge */}
        <div style={{
          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
          background: connected ? '#dcfce7' : '#fef9c3',
          color:      connected ? '#166534' : '#854d0e',
          border:    `1px solid ${connected ? '#bbf7d0' : '#fde68a'}`,
        }}>
          {connected
            ? `● Live — ${sampleCount.toLocaleString()} samples`
            : '○ Waiting for data…'}
        </div>

        <div style={{ fontSize: 11, color: '#888' }}>
          Keep the main KinLab window open · press ▶ Play to stream data here
        </div>
      </div>

      {/* ── Controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <AxisSelector xKey={xKey} yKey={yKey} onXChange={setXKey} onYChange={setYKey} />

        {/* Y-direction flip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Y+:</span>
          <button style={arrowBtn(!flipY)} title="↑ physical (floor=0, up=+)"  onClick={() => setFlipY(false)}>↑</button>
          <button style={arrowBtn(flipY)}  title="↓ canvas  (top=0, down=+)"   onClick={() => setFlipY(true)}>↓</button>
        </div>
      </div>

      {/* ── Graph canvas (fills remaining height) ── */}
      <div style={{ flex: 1, position: 'relative', minHeight: 400 }}>
        <canvas
          ref={canvasRef}
          width={900}
          height={620}
          style={{
            border: '1px solid #ddd', borderRadius: 8, background: '#fff',
            display: 'block', width: '100%', maxWidth: 1400,
          }}
        />

        {/* Waiting overlay */}
        {!connected && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', borderRadius: 8,
            background: 'rgba(255,255,255,0.88)',
          }}>
            <div style={{ textAlign: 'center', color: '#888' }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>📡</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: '#555' }}>Waiting for KinLab data…</div>
              <div style={{ fontSize: 13, marginTop: 8, color: '#888' }}>
                Open the main KinLab window and press <strong>▶ Play</strong> to start.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ fontSize: 11, color: '#999' }}>
        Data streams live from the main KinLab window via BroadcastChannel.
        Resize this window freely — the graph scales with it.
      </div>
    </div>
  )
}
