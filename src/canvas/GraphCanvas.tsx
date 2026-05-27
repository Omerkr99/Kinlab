/**
 * GraphCanvas — wraps GraphEngine canvas + Y-flip arrows + pop-out + multi-series legend
 *
 * KAN-86: Legend overlay with per-series toggle
 *   - A "+ Series" button in the header lets users add a second Y series to overlay
 *   - Each series has a colored swatch, label, visibility toggle, and remove button
 *   - Legend is rendered inside the canvas by GraphEngine.drawLegend()
 *
 * KAN-88: Axis auto-scale with 5%/8% padding (in GraphEngine)
 */
import { useRef, useEffect, useState } from 'react'
import { DataRecorder, SeriesKey } from '../recorder'
import { GraphEngine, SeriesConfig } from '../graph/GraphEngine'
import { PhysicsScale, DEFAULT_SCALE, axisLabel } from '../units/PhysicsScale'

const SERIES_COLORS = ['#4A90E2', '#E24A4A', '#16A34A', '#9333EA', '#EA8B08']
const ALL_KEYS: SeriesKey[] = ['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay']

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

  // Extra overlay series (KAN-86) — primary series is always index 0 (from xKey/yKey props)
  const [extraSeries, setExtraSeries] = useState<SeriesConfig[]>([])

  useEffect(() => {
    if (!canvasRef.current) return
    engineRef.current = new GraphEngine(canvasRef.current)
    lastLenRef.current = -1
  }, [])

  // Reset cache on key/flip/scale/extra change
  useEffect(() => { lastLenRef.current = -1 }, [xKey, yKey, flipY, scale, extraSeries])

  useEffect(() => {
    const id = setInterval(() => {
      const currentLen = recorder.getLength()
      if (currentLen === lastLenRef.current) return
      lastLenRef.current = currentLen

      const primary: SeriesConfig = {
        xKey, yKey, flipY,
        color:   SERIES_COLORS[0],
        label:   axisLabel(yKey, scale),
        visible: true,
      }
      engineRef.current?.drawMulti(recorder, [primary, ...extraSeries], scale)
    }, 32)
    return () => clearInterval(id)
  }, [recorder, xKey, yKey, flipY, scale, extraSeries])

  // Add a new overlay series
  const handleAddSeries = () => {
    const usedColors = extraSeries.map(s => s.color)
    const color = SERIES_COLORS.find(c => !usedColors.includes(c)) ?? SERIES_COLORS[1]
    const nextKey: SeriesKey = yKey === 'y' ? 'vy' : 'y'
    setExtraSeries(prev => [...prev, {
      xKey, yKey: nextKey, color, flipY,
      label:   axisLabel(nextKey, scale),
      visible: true,
    }])
  }

  const handleToggleSeries = (idx: number) => {
    setExtraSeries(prev => prev.map((s, i) => i === idx ? { ...s, visible: !s.visible } : s))
  }

  const handleRemoveSeries = (idx: number) => {
    setExtraSeries(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSeriesKey = (idx: number, key: SeriesKey) => {
    setExtraSeries(prev => prev.map((s, i) =>
      i === idx ? { ...s, yKey: key, label: axisLabel(key, scale) } : s,
    ))
  }

  const handlePopout = () => {
    window.open(
      `${window.location.pathname}?popup=true`,
      'kinlab-graph-popup',
      'width=960,height=720,resizable=yes,scrollbars=no',
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      {/* Legend bar — shown when extra series exist (KAN-86) */}
      {extraSeries.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          flexWrap: 'wrap', paddingLeft: 32, paddingBottom: 2,
        }}>
          {/* Primary series chip */}
          <LegendChip
            color={SERIES_COLORS[0]}
            label={axisLabel(yKey, scale)}
            visible
            onToggle={() => {}}   // primary always visible
            removable={false}
          />
          {/* Overlay series chips */}
          {extraSeries.map((s, i) => (
            <LegendChip
              key={i}
              color={s.color}
              visible={s.visible}
              label={axisLabel(s.yKey, scale)}
              onToggle={() => handleToggleSeries(i)}
              removable
              onRemove={() => handleRemoveSeries(i)}
              onKeyChange={k => handleSeriesKey(i, k)}
              currentKey={s.yKey}
            />
          ))}
        </div>
      )}

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

        {/* + Series button — bottom-left inside canvas */}
        {extraSeries.length < 4 && (
          <button
            onClick={handleAddSeries}
            title="Add overlay series"
            style={{
              position: 'absolute', bottom: 8, left: 8,
              padding: '2px 8px', fontSize: 11, fontWeight: 600,
              border: '1px solid #d0d0d0', borderRadius: 4,
              background: 'rgba(255,255,255,0.88)', color: '#555',
              cursor: 'pointer', lineHeight: 1.4,
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#e8f0fb')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.88)')}
          >
            + Series
          </button>
        )}
      </div>
    </div>
  )
}

// ── Legend chip ───────────────────────────────────────────────────────────────

interface LegendChipProps {
  color:      string
  label:      string
  visible:    boolean
  onToggle:   () => void
  removable:  boolean
  onRemove?:  () => void
  onKeyChange?: (k: SeriesKey) => void
  currentKey?:  SeriesKey
}

function LegendChip({ color, label, visible, onToggle, removable, onRemove, onKeyChange, currentKey }: LegendChipProps) {
  return (
    <div style={{
      display:    'flex', alignItems: 'center', gap: 4,
      padding:    '2px 6px 2px 4px',
      borderRadius: 4,
      border:     `1px solid ${visible ? color : '#D1D5DB'}`,
      background: visible ? `${color}18` : '#F9FAFB',
      fontSize:   11,
      cursor:     'pointer',
      opacity:    visible ? 1 : 0.5,
      transition: 'all 0.12s',
    }}>
      {/* Color swatch / visibility toggle */}
      <button
        onClick={onToggle}
        title={visible ? 'Hide series' : 'Show series'}
        aria-pressed={visible}
        style={{
          width: 12, height: 12, borderRadius: 2,
          background: visible ? color : '#ccc',
          border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
        }}
      />

      {/* Series label or key selector */}
      {onKeyChange && currentKey ? (
        <select
          value={currentKey}
          onChange={e => onKeyChange(e.target.value as SeriesKey)}
          style={{
            fontSize: 10, border: 'none', background: 'transparent',
            color: visible ? '#374151' : '#9CA3AF', cursor: 'pointer',
            outline: 'none', padding: 0,
          }}
        >
          {ALL_KEYS.map(k => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      ) : (
        <span style={{ color: visible ? '#374151' : '#9CA3AF', userSelect: 'none' }}>
          {label}
        </span>
      )}

      {/* Remove button */}
      {removable && onRemove && (
        <button
          onClick={onRemove}
          title="Remove series"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 12, height: 12, borderRadius: 2,
            background: 'transparent', border: 'none',
            color: '#9CA3AF', cursor: 'pointer', fontSize: 12, padding: 0,
            lineHeight: 1,
          }}
        >×</button>
      )}
    </div>
  )
}
