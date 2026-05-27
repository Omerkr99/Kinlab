/**
 * BottomPanels — bottom area split into DataMonitor (~55%) + GraphPanel (~45%)
 *
 * DataMonitor [KAN-83]: streams DataRecorder rows into a live table.
 *   - Polls recorder every 80 ms via usePoll
 *   - Caps display at MAX_ROWS (500) — shows last N rows + truncation chip
 *   - Sticky header, aria-live on tbody
 *
 * GraphPanel:  wraps the existing GraphCanvas + AxisSelector
 *
 * Accessibility:
 *  - DataMonitor: role="table" with scope headers, aria-live="polite" on tbody
 *  - GraphPanel: axis selectors have <label> linkage
 */
import React, { useCallback, useRef, useEffect } from 'react'
import { GraphCanvas } from '../canvas/GraphCanvas'
import { AxisSelector } from '../components/AxisSelector'
import { CsvExportButton } from '../components/CsvExportButton'
import type { DataRecorder, SeriesKey } from '../recorder'
import type { PhysicsScale } from '../units/PhysicsScale'
import type { World } from '../engine'
import { usePoll } from './hooks'

// ── Constants ─────────────────────────────────────────────────────────────────

export const BODY_COLORS = ['#2563EB', '#16A34A', '#DC2626', '#7C3AED', '#EAB308']

/** Maximum rows rendered in the table — older rows are dropped */
const MAX_ROWS = 500

// ── Row snapshot type ────────────────────────────────────────────────────────

interface RecorderRow {
  t: number; x: number; y: number
  vx: number; vy: number; ax: number; ay: number
}

// ── Shared table cell primitives ──────────────────────────────────────────────

const TH = ({ children, left }: { children: React.ReactNode; left?: boolean }) => (
  <th scope="col" style={{
    padding:      '6px 8px',
    fontSize:     11,
    fontWeight:   600,
    color:        '#6B7280',
    background:   '#F9FAFB',
    borderBottom: '1px solid #E5E7EB',
    textAlign:    left ? 'left' : 'right',
    whiteSpace:   'nowrap',
    position:     'sticky',
    top:          0,
    zIndex:       1,
  }}>
    {children}
  </th>
)

const TD = ({ children, mono = false, left = false }: {
  children: React.ReactNode; mono?: boolean; left?: boolean
}) => (
  <td style={{
    padding:      '4px 8px',
    fontSize:     11,
    color:        '#111827',
    textAlign:    left ? 'left' : 'right',
    fontFamily:   mono ? '"JetBrains Mono","Fira Code",monospace' : 'inherit',
    whiteSpace:   'nowrap',
    borderBottom: '1px solid #F3F4F6',
  }}>
    {children}
  </td>
)

// ── DataMonitor ───────────────────────────────────────────────────────────────

interface DataMonitorProps {
  world:    World
  recorder: DataRecorder
  scale:    PhysicsScale
}

function DataMonitor({ world, recorder, scale }: DataMonitorProps) {
  const u = scale.unitSymbol
  const ppu = scale.pixelsPerUnit

  // Snapshot recorder series into rows on every poll tick
  const getSnapshot = useCallback((): { rows: RecorderRow[]; total: number } => {
    const n = recorder.getLength()
    if (n === 0) return { rows: [], total: 0 }

    const t  = recorder.getSeries('time')
    const x  = recorder.getSeries('x')
    const y  = recorder.getSeries('y')
    const vx = recorder.getSeries('vx')
    const vy = recorder.getSeries('vy')
    const ax = recorder.getSeries('ax')
    const ay = recorder.getSeries('ay')

    // Take the last MAX_ROWS entries
    const start = Math.max(0, n - MAX_ROWS)
    const rows: RecorderRow[] = []
    for (let i = start; i < n; i++) {
      rows.push({
        t:  t[i],
        // Recorder stores physical coords (y upward from floor) already
        // but x/y are in pixels — divide by ppu for display
        x:  x[i] / ppu,
        y:  y[i] / ppu,
        vx: vx[i] / ppu,
        vy: vy[i] / ppu,
        ax: ax[i] / ppu,
        ay: ay[i] / ppu,
      })
    }
    return { rows, total: n }
  }, [recorder, ppu])

  const { rows, total } = usePoll(getSnapshot, 80)
  const time    = usePoll(() => world.time, 80)
  const tbodyRef = useRef<HTMLTableSectionElement>(null)

  // Auto-scroll to bottom when new rows arrive
  useEffect(() => {
    if (tbodyRef.current) {
      const container = tbodyRef.current.closest('div[data-scroll]') as HTMLDivElement | null
      if (container) container.scrollTop = container.scrollHeight
    }
  }, [rows.length])

  const isTruncated = total > MAX_ROWS

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      flex:          '0 0 55%',
      borderRight:   '1px solid #E5E7EB',
      overflow:      'hidden',
    }}>
      {/* Header */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '6px 10px',
        borderBottom:   '1px solid #E5E7EB',
        flexShrink:     0,
        gap:            8,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
          Data Monitor
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isTruncated && (
            <span style={{
              fontSize: 10, color: '#6B7280', background: '#F3F4F6',
              border: '1px solid #E5E7EB', borderRadius: 3, padding: '1px 5px',
            }}>
              last {MAX_ROWS} of {total}
            </span>
          )}
          {rows.length > 0 && (
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#9CA3AF' }}>
              {rows.length} rows
            </span>
          )}
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#2563EB', fontWeight: 600 }}>
            t = {time.toFixed(3)} s
          </span>
        </div>
      </div>

      {/* Scrollable table */}
      <div data-scroll="" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        <table
          role="table"
          aria-label="Recorded physics data"
          style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}
        >
          <colgroup>
            <col style={{ width: 52 }} />
            <col style={{ width: 52 }} />
            <col style={{ width: 52 }} />
            <col style={{ width: 56 }} />
            <col style={{ width: 56 }} />
            <col style={{ width: 56 }} />
            <col style={{ width: 56 }} />
          </colgroup>
          <thead>
            <tr>
              <TH>t (s)</TH>
              <TH>x ({u})</TH>
              <TH>y ({u})</TH>
              <TH>vx ({u}/s)</TH>
              <TH>vy ({u}/s)</TH>
              <TH>ax</TH>
              <TH>ay</TH>
            </tr>
          </thead>
          <tbody ref={tbodyRef} aria-live="polite" aria-atomic="false">
            {rows.map((r, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                <TD mono>{r.t.toFixed(3)}</TD>
                <TD mono>{r.x.toFixed(2)}</TD>
                <TD mono>{r.y.toFixed(2)}</TD>
                <TD mono>{r.vx.toFixed(2)}</TD>
                <TD mono>{r.vy.toFixed(2)}</TD>
                <TD mono>{r.ax.toFixed(2)}</TD>
                <TD mono>{r.ay.toFixed(2)}</TD>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{
                  padding: '24px', textAlign: 'center',
                  color: '#9CA3AF', fontSize: 12,
                }}>
                  Press ▶ Start to record data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── GraphPanel ────────────────────────────────────────────────────────────────

interface GraphPanelProps {
  recorder: DataRecorder
  scale:    PhysicsScale
  xKey:     SeriesKey
  yKey:     SeriesKey
  flipY:    boolean
  onXKeyChange: (k: SeriesKey) => void
  onYKeyChange: (k: SeriesKey) => void
  onFlipY:      (v: boolean) => void
}

function GraphPanel({
  recorder, scale, xKey, yKey, flipY, onXKeyChange, onYKeyChange, onFlipY,
}: GraphPanelProps) {
  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      flex:          '0 0 45%',
      overflow:      'hidden',
    }}>
      {/* Header */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '8px 12px',
        borderBottom:   '1px solid #E5E7EB',
        flexShrink:     0,
        flexWrap:       'wrap',
        gap:            6,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
          Graph
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AxisSelector
            xKey={xKey} yKey={yKey}
            onXChange={onXKeyChange} onYChange={onYKeyChange}
            scale={scale}
          />
          <CsvExportButton recorder={recorder} scale={scale} />
        </div>
      </div>

      {/* Graph canvas */}
      <div style={{
        flex:           1,
        overflow:       'hidden',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        4,
        background:     '#FAFAFA',
      }}>
        <GraphCanvas
          recorder={recorder}
          xKey={xKey} yKey={yKey}
          flipY={flipY}
          onFlipY={onFlipY}
          scale={scale}
        />
      </div>
    </div>
  )
}

// ── BottomPanels — combined export ───────────────────────────────────────────

interface BottomPanelsProps extends DataMonitorProps, GraphPanelProps {}

export function BottomPanels({
  world, recorder, scale,
  xKey, yKey, flipY,
  onXKeyChange, onYKeyChange, onFlipY,
}: BottomPanelsProps) {
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'row',
      height:         220,
      minHeight:      220,
      flexShrink:     0,
      borderTop:      '1px solid #E5E7EB',
      background:     '#FFFFFF',
      overflow:       'hidden',
    }}>
      <DataMonitor world={world} recorder={recorder} scale={scale} />
      <GraphPanel
        recorder={recorder} scale={scale}
        xKey={xKey} yKey={yKey} flipY={flipY}
        onXKeyChange={onXKeyChange} onYKeyChange={onYKeyChange} onFlipY={onFlipY}
      />
    </div>
  )
}
