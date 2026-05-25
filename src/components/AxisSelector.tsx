import { SeriesKey } from '../recorder'

const VARS: SeriesKey[] = ['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay']

const LABELS: Record<SeriesKey, string> = {
  time: 'time (s)',
  x:    'position x (px)',
  y:    'height y (px, 0=floor)',
  vx:   'velocity vx (px/s)',
  vy:   'velocity vy (↑+)',
  ax:   'accel ax (px/s²)',
  ay:   'accel ay (↑+, gravity=−9.8)',
}

interface Props {
  xKey:     SeriesKey
  yKey:     SeriesKey
  flipY:    boolean
  onXChange:  (k: SeriesKey) => void
  onYChange:  (k: SeriesKey) => void
  onFlipY:    (v: boolean)   => void
}

const selectStyle: React.CSSProperties = {
  marginLeft: 6,
  padding: '4px 8px',
  borderRadius: 4,
  border: '1px solid #ccc',
  fontSize: 13,
}

const flipBtnStyle = (active: boolean): React.CSSProperties => ({
  marginLeft: 10,
  padding: '4px 10px',
  fontSize: 12,
  fontWeight: 700,
  border: `1px solid ${active ? '#E24A4A' : '#ccc'}`,
  borderRadius: 4,
  background: active ? '#fff0f0' : '#f5f5f5',
  color: active ? '#E24A4A' : '#666',
  cursor: 'pointer',
  letterSpacing: 0.5,
  transition: 'all 0.15s',
})

export function AxisSelector({ xKey, yKey, flipY, onXChange, onYChange, onFlipY }: Props) {
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 13, alignItems: 'center', flexWrap: 'wrap' }}>
      <label>
        X:
        <select style={selectStyle} value={xKey} onChange={e => onXChange(e.target.value as SeriesKey)}>
          {VARS.map(v => <option key={v} value={v}>{LABELS[v]}</option>)}
        </select>
      </label>

      <label>
        Y:
        <select style={selectStyle} value={yKey} onChange={e => onYChange(e.target.value as SeriesKey)}>
          {VARS.map(v => <option key={v} value={v}>{LABELS[v]}</option>)}
        </select>
      </label>

      {/* Y-axis direction toggle */}
      <button
        style={flipBtnStyle(flipY)}
        title={flipY ? 'Currently: ↓ positive (canvas coords). Click to restore ↑ positive.' : 'Currently: ↑ positive (physical). Click to flip to ↓ positive.'}
        onClick={() => onFlipY(!flipY)}
      >
        {flipY ? 'Y: ↓+' : 'Y: ↑+'}
      </button>
    </div>
  )
}
