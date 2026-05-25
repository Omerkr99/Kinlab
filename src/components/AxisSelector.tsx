import { SeriesKey } from '../recorder'

const VARS: SeriesKey[] = ['time', 'x', 'vx', 'ax']

const LABELS: Record<SeriesKey, string> = {
  time: 'time (s)',
  x: 'position x (px)',
  vx: 'velocity vx (px/s)',
  ax: 'acceleration ax (px/s²)',
}

interface Props {
  xKey: SeriesKey
  yKey: SeriesKey
  onXChange: (k: SeriesKey) => void
  onYChange: (k: SeriesKey) => void
}

const selectStyle: React.CSSProperties = {
  marginLeft: 6,
  padding: '4px 8px',
  borderRadius: 4,
  border: '1px solid #ccc',
  fontSize: 13,
}

export function AxisSelector({ xKey, yKey, onXChange, onYChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 20, marginBottom: 8, fontSize: 13, alignItems: 'center' }}>
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
    </div>
  )
}
