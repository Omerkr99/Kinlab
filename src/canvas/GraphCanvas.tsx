import { useRef, useEffect } from 'react'
import { DataRecorder, SeriesKey } from '../recorder'
import { GraphEngine } from '../graph/GraphEngine'
import { PhysicsScale, DEFAULT_SCALE } from '../units/PhysicsScale'

interface Props {
  recorder: DataRecorder
  xKey:     SeriesKey
  yKey:     SeriesKey
  flipY:    boolean
  onFlipY:  (v: boolean) => void
  scale?:   PhysicsScale
}

const arrowBtn = (active: boolean): React.CSSProperties => ({
  width: 26, height: 26,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 15, lineHeight: 1,
  border: `1.5px solid ${active ? '#4A90E2' : '#ccc'}`,
  borderRadius: 5,
  background: active ? '#e8f0fb' : '#f9f9f9',
  color: active ? '#2060c0' : '#aaa',
  cursor: 'pointer',
  fontWeight: active ? 700 : 400,
  transition: 'all 0.12s',
  userSelect: 'none' as const,
  padding: 0,
})

export function GraphCanvas({ recorder, xKey, yKey, flipY, onFlipY, scale = DEFAULT_SCALE }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const engineRef   = useRef<GraphEngine | null>(null)
  const lastLenRef  = useRef<number>(-1)

  useEffect(() => {
    if (!canvasRef.current) return
    engineRef.current = new GraphEngine(canvasRef.current)
    lastLenRef.current = -1
  }, [])

  // Reset cached length so the graph redraws immediately on any key/flip/scale change
  useEffect(() => { lastLenRef.current = -1 }, [xKey, yKey, flipY, scale])

  useEffect(() => {
    const id = setInterval(() => {
      const currentLen = recorder.getLength()
      if (currentLen === lastLenRef.current) return
      lastLenRef.current = currentLen
      engineRef.current?.draw(recorder, xKey, yKey, flipY, scale)
    }, 32)
    return () => clearInterval(id)
  }, [recorder, xKey, yKey, flipY, scale])

  const handlePopout = () => {
    window.open(
      `${window.location.pathname}?popup=true`,
      'kinlab-graph-popup',
      'width=960,height=720,resizable=yes,scrollbars=no',
    )
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={500}
        height={400}
        style={{ border: '1px solid #ddd', borderRadius: 8, background: '#fff', display: 'block' }}
      />

      {/* Y-direction arrows — overlaid on the graph, left of the Y-axis */}
      <div style={{
        position: 'absolute',
        left: 6,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        <button
          style={arrowBtn(!flipY)}
          title="↑ positive — physical convention (floor = 0, up = +)"
          onClick={() => onFlipY(false)}
        >↑</button>
        <button
          style={arrowBtn(flipY)}
          title="↓ positive — canvas convention (top = 0, down = +)"
          onClick={() => onFlipY(true)}
        >↓</button>
      </div>

      {/* Pop-out button — top-right corner */}
      <button
        onClick={handlePopout}
        title="Open graph in a separate window"
        style={{
          position: 'absolute', top: 6, right: 6,
          padding: '3px 9px', fontSize: 13, fontWeight: 600,
          border: '1px solid #d0d0d0', borderRadius: 5,
          background: 'rgba(255,255,255,0.92)', color: '#555',
          cursor: 'pointer', lineHeight: 1,
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#e8f0fb')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.92)')}
      >
        ⤢ Pop out
      </button>
    </div>
  )
}
