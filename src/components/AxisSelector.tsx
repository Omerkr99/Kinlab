import { SeriesKey } from '../recorder'
import { PhysicsScale, DEFAULT_SCALE, dropdownLabel } from '../units/PhysicsScale'

const VARS: SeriesKey[] = ['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay']

interface Props {
  xKey:      SeriesKey
  yKey:      SeriesKey
  onXChange: (k: SeriesKey) => void
  onYChange: (k: SeriesKey) => void
  scale?:    PhysicsScale
}

const selectStyle: React.CSSProperties = {
  marginLeft: 6,
  padding: '4px 8px',
  borderRadius: 4,
  border: '1px solid #ccc',
  fontSize: 13,
}

export function AxisSelector({ xKey, yKey, onXChange, onYChange, scale = DEFAULT_SCALE }: Props) {
  return (
    <div style={{ display: 'flex', gap: 20, marginBottom: 8, fontSize: 13, alignItems: 'center' }}>
      <label>
        X:
        <select style={selectStyle} value={xKey} onChange={e => onXChange(e.target.value as SeriesKey)}>
          {VARS.map(v => <option key={v} value={v}>{dropdownLabel(v, scale)}</option>)}
        </select>
      </label>
      <label>
        Y:
        <select style={selectStyle} value={yKey} onChange={e => onYChange(e.target.value as SeriesKey)}>
          {VARS.map(v => <option key={v} value={v}>{dropdownLabel(v, scale)}</option>)}
        </select>
      </label>
    </div>
  )
}
