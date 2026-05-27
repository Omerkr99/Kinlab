import { useEffect, useRef, useState, useCallback } from 'react'
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

const MAX_ROWS     = 150   // cap visible rows to keep DOM small
/** Pixels from the bottom — within this margin we consider the user "at bottom". */
const SNAP_MARGIN  = 40

export function DataTable({ recorder, scale = DEFAULT_SCALE }: Props) {
  const [rows,       setRows]       = useState<Row[]>([])
  const [visible,    setVisible]    = useState(true)
  /**
   * KAN-106: whether the user has scrolled up and paused auto-scroll.
   * true  → user is looking at older rows; don't auto-scroll, show "↓ Live" chip.
   * false → user is at (or near) the bottom; auto-scroll on every update.
   */
  const [liveChip,  setLiveChip]   = useState(false)
  const tbodyRef    = useRef<HTMLTableSectionElement>(null)
  /** Prevents the scroll event from re-triggering while we programmatically scroll. */
  const programScrollRef = useRef(false)

  const ppu = scale.pixelsPerUnit
  const d   = distUnit(scale)
  const v   = velUnit(scale)
  const a   = accelUnit(scale)
  const COLS = [`t (s)`, `x (${d})`, `y (${d})`, `vx (${v})`, `vy (${v})`, `ax (${a})`, `ay (${a})`] as const

  /** Scroll the table container to the very bottom. */
  const scrollToBottom = useCallback(() => {
    const el = tbodyRef.current?.parentElement?.parentElement
    if (!el) return
    programScrollRef.current = true
    el.scrollTop = el.scrollHeight
    // Reset flag after the browser has processed the scroll event
    requestAnimationFrame(() => { programScrollRef.current = false })
  }, [])

  /** User clicked the "↓ Live" chip — snap back to bottom and re-enable auto-scroll. */
  const handleLiveChipClick = useCallback(() => {
    setLiveChip(false)
    scrollToBottom()
  }, [scrollToBottom])

  /**
   * KAN-106: detect manual scroll.
   * If the user scrolls up (not near bottom) → pause auto-scroll and show chip.
   * If they scroll back to the bottom → re-enable auto-scroll and hide chip.
   */
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (programScrollRef.current) return   // ignore our own programmatic scrolls
    const el = e.currentTarget
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SNAP_MARGIN
    setLiveChip(!atBottom)
  }, [])

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

  // KAN-106: smart auto-scroll — only follows new rows when user hasn't scrolled away.
  useEffect(() => {
    if (!liveChip) scrollToBottom()
  }, [rows.length, liveChip, scrollToBottom])

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
        <div style={{ position: 'relative' }}>
          <div
            onScroll={handleScroll}
            style={{
              maxHeight: 220, overflowY: 'auto',
              border: '1px solid #e0e0e0', borderTop: 'none',
              borderRadius: '0 0 8px 8px', background: '#fff',
            }}
          >
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

          {/* KAN-106: "↓ Live" chip — appears when user has scrolled up */}
          {liveChip && rows.length > 0 && (
            <button
              onClick={handleLiveChipClick}
              aria-label="Scroll to latest data"
              style={{
                position:   'absolute',
                bottom:     10,
                right:      10,
                display:    'flex',
                alignItems: 'center',
                gap:        4,
                padding:    '3px 8px',
                fontSize:   11,
                fontWeight: 600,
                background: '#2563EB',
                color:      '#fff',
                border:     'none',
                borderRadius: 12,
                cursor:     'pointer',
                boxShadow:  '0 2px 6px rgba(0,0,0,0.18)',
                fontFamily: 'inherit',
                zIndex:     1,
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1D4ED8' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#2563EB' }}
            >
              ↓ Live
            </button>
          )}
        </div>
      )}
    </div>
  )
}
