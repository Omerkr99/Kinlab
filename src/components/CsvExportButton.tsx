import { DataRecorder } from '../recorder'
import {
  PhysicsScale, DEFAULT_SCALE, pxToUnit,
  distUnit, velUnit, accelUnit,
} from '../units/PhysicsScale'

interface Props {
  recorder: DataRecorder
  scale?:   PhysicsScale
}

function buildCsv(recorder: DataRecorder, scale: PhysicsScale = DEFAULT_SCALE): string {
  const keys = ['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay'] as const
  const series = keys.map(k => recorder.getSeries(k))
  const n = series[0].length

  // Dynamic header with unit labels
  const d = distUnit(scale)
  const v = velUnit(scale)
  const a = accelUnit(scale)
  const header = `time,x (${d}),y_height (${d}),vx (${v}),vy (${v}),ax (${a}),ay (${a})`

  const rows = Array.from({ length: n }, (_, i) =>
    series.map((s, j) => {
      // j=0 is time (seconds) — no unit conversion needed
      const val = j === 0 ? s[i] : pxToUnit(s[i], scale)
      return val.toFixed(6)
    }).join(',')
  )
  return [header, ...rows].join('\n')
}

export function downloadCsv(recorder: DataRecorder, scale: PhysicsScale = DEFAULT_SCALE): void {
  if (recorder.getLength() === 0) {
    alert('No data to export — press ▶ Play first.')
    return
  }
  const csv  = buildCsv(recorder, scale)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `kinlab-data-${Date.now()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function CsvExportButton({ recorder, scale }: Props) {
  return (
    <button
      onClick={() => downloadCsv(recorder, scale)}
      title="Download recorded data as CSV"
      style={{
        padding:      '5px 12px',
        fontSize:     12,
        fontWeight:   600,
        border:       '1px solid #ccc',
        borderRadius: 6,
        background:   '#fff',
        color:        '#444',
        cursor:       'pointer',
        display:      'flex',
        alignItems:   'center',
        gap:          5,
        transition:   'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f0f8ff')}
      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
    >
      ⬇ CSV
    </button>
  )
}

// Exported separately so it can be unit-tested without DOM
export { buildCsv }
