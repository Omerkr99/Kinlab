import { DataRecorder } from '../recorder'

interface Props { recorder: DataRecorder }

function buildCsv(recorder: DataRecorder): string {
  const keys = ['time', 'x', 'y', 'vx', 'vy', 'ax', 'ay'] as const
  const series = keys.map(k => recorder.getSeries(k))
  const n = series[0].length
  const header = 'time,x,y_height,vx,vy,ax,ay'   // y_height = FLOOR_Y - canvas_y
  const rows = Array.from({ length: n }, (_, i) =>
    series.map(s => s[i].toFixed(6)).join(',')
  )
  return [header, ...rows].join('\n')
}

export function downloadCsv(recorder: DataRecorder): void {
  if (recorder.getLength() === 0) {
    alert('No data to export — press ▶ Play first.')
    return
  }
  const csv  = buildCsv(recorder)
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

export function CsvExportButton({ recorder }: Props) {
  return (
    <button
      onClick={() => downloadCsv(recorder)}
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
