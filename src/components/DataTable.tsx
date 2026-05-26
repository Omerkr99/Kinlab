import { useEffect, useRef, useState } from 'react'
import { DataRecorder } from '../recorder'
import {
  PhysicsScale, DEFAULT_SCALE, pxToUnit, fmtUnit,
  distUnit, velUnit, accelUnit,
} from '../units/PhysicsScale'

interface Props {
  recorder: DataRecorder
  scale?:   PhysicsScale
}

type Row = [number, number, number, number, number, number, number]

const MAX_ROWS = 150   // cap visible rows to keep DOM small

export function DataTable({ recorder, scale = DEFAULT_SCALE }: Props) {
  const [rows,    setRows]    = useState<Row[]>([])
  const [visible, setVisible] = useState(true)
  const tbodyRef = useRef<HTMLTableSectionElement>(null)

  const ppu = scale.pixelsPerUnit
  const d   = distUnit(scale)
  const v   = velUnit(scale)
  const a   = accelUnit(scale)
  const COLS = [`t (s)`, `x (${d})`, `y (${d})`, `vx (${v})`, `vy (${v})`, `ax (${a})`, `ay (${a})`] as const

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
        next.push([
          t[i],
          pxToUnit(x[i],  scale),
          pxToUnit(y[i],  scale),
          pxToUnit(vx[i], scale),
          pxToUnit(vy[i], scale),
          pxToUnit(ax[i], scale),
          pxToUnit(ay[i], scale),
        ])
      setRows(next)
    }, 250)   // 4 fps — enough to feel live without hammering React
    return () => clearInterval(id)
  }, [recorder, ppu])  // re-run when scale changes (ppu is a proxy for scale identity)

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
                      {row.map((val, j) => (
                        <td key={j} style={tdStyle}>{fmtUnit(val)}</td>
                      ))}
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
