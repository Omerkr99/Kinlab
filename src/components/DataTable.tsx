import { useEffect, useRef, useState } from 'react'
import { DataRecorder } from '../recorder'

interface Props { recorder: DataRecorder }

type Row = [number, number, number, number, number, number, number]

const COLS = ['t (s)', 'x', 'y', 'vx', 'vy', 'ax', 'ay'] as const
const MAX_ROWS = 150   // cap visible rows to keep DOM small

const fmt = (n: number) => {
  if (n === 0) return '0'
  if (Math.abs(n) >= 1000 || (Math.abs(n) < 0.001 && n !== 0)) return n.toExponential(2)
  return n.toFixed(3)
}

export function DataTable({ recorder }: Props) {
  const [rows,    setRows]    = useState<Row[]>([])
  const [visible, setVisible] = useState(true)
  const tbodyRef = useRef<HTMLTableSectionElement>(null)

  useEffect(() => {
    const id = setInterval(() => {
      const n = recorder.getLength()
      if (n === 0) { setRows([]); return }
      const t  = recorder.getSeries('time')
      const x  = recorder.getSeries('x')
      const y  = recorder.getSeries('y')
      const vx = recorder.getSeries('vx')
      const vy = recorder.getSeries('vy')
      const ax = recorder.getSeries('ax')
      const ay = recorder.getSeries('ay')
      const start = Math.max(0, n - MAX_ROWS)
      const next: Row[] = []
      for (let i = start; i < n; i++)
        next.push([t[i], x[i], y[i], vx[i], vy[i], ax[i], ay[i]])
      setRows(next)
    }, 250)   // 4 fps — enough to feel live without hammering React
    return () => clearInterval(id)
  }, [recorder])

  // Auto-scroll to bottom
  useEffect(() => {
    if (tbodyRef.current) {
      const el = tbodyRef.current.parentElement?.parentElement
      if (el) el.scrollTop = el.scrollHeight
    }
  }, [rows.length])

  const thStyle: React.CSSProperties = {
    padding: '4px 8px', background: '#1a1a2e', color: '#fff',
    fontSize: 11, fontWeight: 700, textAlign: 'right',
    position: 'sticky', top: 0, whiteSpace: 'nowrap',
  }
  const tdStyle: React.CSSProperties = {
    padding: '3px 8px', fontSize: 11, textAlign: 'right',
    color: '#333', fontVariantNumeric: 'tabular-nums',
  }

  return (
    <div style={{ marginTop: 10, width: 500 }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 10px',
        background: '#1a1a2e', borderRadius: visible ? '8px 8px 0 0' : 8,
        cursor: 'pointer', userSelect: 'none',
      }} onClick={() => setVisible(v => !v)}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: 0.8 }}>
          📋 DATA TABLE {rows.length > 0 && `— ${rows.length} rows (last ${MAX_ROWS})`}
        </span>
        <span style={{ color: '#aaa', fontSize: 14 }}>{visible ? '▲' : '▼'}</span>
      </div>

      {visible && (
        <div style={{
          maxHeight: 220, overflowY: 'auto',
          border: '1px solid #e0e0e0', borderTop: 'none',
          borderRadius: '0 0 8px 8px', background: '#fff',
        }}>
          {rows.length === 0
            ? <div style={{ padding: '16px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
                No data — press ▶ Play to start recording
              </div>
            : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{COLS.map(c => <th key={c} style={thStyle}>{c}</th>)}</tr>
                </thead>
                <tbody ref={tbodyRef}>
                  {rows.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#f9f9fb' : '#fff' }}>
                      {row.map((v, j) => <td key={j} style={tdStyle}>{fmt(v)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      )}
    </div>
  )
}
