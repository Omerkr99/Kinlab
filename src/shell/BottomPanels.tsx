/**
 * BottomPanels — bottom area split into DataMonitor (~55%) + GraphPanel (~45%)
 *
 * DataMonitor [KAN-83]: streams DataRecorder rows into a live table.
 *   - Polls recorder every 80 ms via usePoll
 *   - Caps display at MAX_ROWS (500) — shows last N rows + truncation chip [KAN-85]
 *   - Virtual scroll: only renders a 30-row window for performance [KAN-85]
 *   - CSV export button in DataMonitor header [KAN-87]
 *   - Column visibility filter — toggle which columns are shown [KAN-89]
 *   - Extra columns slot — pass custom metric columns via extraColumns prop [KAN-91]
 *   - Sticky header, aria-live on tbody
 *
 * GraphPanel:  wraps the existing GraphCanvas + AxisSelector
 *
 * Accessibility:
 *  - DataMonitor: role="table" with scope headers, aria-live="polite" on tbody
 *  - GraphPanel: axis selectors have <label> linkage
 */
import React, { useCallback, useRef, useEffect, useState } from 'react'
import { GraphCanvas } from '../canvas/GraphCanvas'
import { AxisSelector } from '../components/AxisSelector'
import { CsvExportButton } from '../components/CsvExportButton'
import type { DataRecorder, SeriesKey } from '../recorder'
import type { PhysicsScale } from '../units/PhysicsScale'
import type { World } from '../engine'
import { usePoll } from './hooks'

// ── Constants ─────────────────────────────────────────────────────────────────

export const BODY_COLORS = ['#2563EB', '#16A34A', '#DC2626', '#7C3AED', '#EAB308']

/** Maximum rows retained in the display buffer — older rows are dropped */
const MAX_ROWS = 500

/** Row height in pixels for virtual scroll calculations */
const ROW_H = 21

/** Number of rows to render in the virtual window */
const VIRTUAL_WINDOW = 30

// ── Column definitions ────────────────────────────────────────────────────────

type ColKey = 't' | 'x' | 'y' | 'vx' | 'vy' | 'ax' | 'ay'

const BASE_COLS: ColKey[] = ['t', 'x', 'y', 'vx', 'vy', 'ax', 'ay']

/** Extra column definition for KAN-91 plugin metrics slot */
export interface ExtraColumn {
  key:      string
  header:   string
  getValue: (row: RecorderRow, index: number) => number | string
}

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

// ── Column filter popover (KAN-89) ────────────────────────────────────────────

interface ColFilterProps {
  visible: Set<ColKey>
  onChange: (col: ColKey, on: boolean) => void
  extraColumns?: ExtraColumn[]
}

function ColFilterPopover({ visible, onChange, extraColumns = [] }: ColFilterProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const cols: { key: ColKey | string; label: string }[] = [
    { key: 't',  label: 't (s)' },
    { key: 'x',  label: 'x' },
    { key: 'y',  label: 'y' },
    { key: 'vx', label: 'vx' },
    { key: 'vy', label: 'vy' },
    { key: 'ax', label: 'ax' },
    { key: 'ay', label: 'ay' },
    ...extraColumns.map(ec => ({ key: ec.key, label: ec.header })),
  ]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        aria-label="Column visibility filter"
        title="Toggle column visibility"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, border: '1px solid #E5E7EB',
          borderRadius: 4, background: open ? '#EFF6FF' : '#FFFFFF',
          color: open ? '#2563EB' : '#6B7280', cursor: 'pointer',
          fontSize: 13, transition: 'all 0.12s',
        }}
      >
        ⊞
      </button>

      {open && (
        <div style={{
          position:   'absolute', top: '100%', right: 0, marginTop: 4,
          zIndex:     100,
          background: '#FFFFFF',
          border:     '1px solid #E5E7EB',
          borderRadius: 6,
          boxShadow:  '0 4px 16px rgba(0,0,0,0.10)',
          padding:    '8px 0',
          minWidth:   120,
        }}>
          <div style={{ padding: '2px 10px 6px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: 0.5 }}>
            COLUMNS
          </div>
          {cols.map(({ key, label }) => {
            const isBase = BASE_COLS.includes(key as ColKey)
            const isOn = isBase ? visible.has(key as ColKey) : true
            return (
              <label
                key={key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', cursor: 'pointer',
                  fontSize: 12, color: '#374151',
                  background: 'transparent',
                  userSelect: 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  disabled={!isBase}  // extra columns always shown
                  onChange={e => isBase && onChange(key as ColKey, e.target.checked)}
                  style={{ accentColor: '#2563EB' }}
                />
                {label}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── DataMonitor ───────────────────────────────────────────────────────────────

interface DataMonitorProps {
  world:        World
  recorder:     DataRecorder
  scale:        PhysicsScale
  /** Extra metric columns for plugin integrations (KAN-91) */
  extraColumns?: ExtraColumn[]
}

function DataMonitor({ world, recorder, scale, extraColumns = [] }: DataMonitorProps) {
  const u = scale.unitSymbol
  const ppu = scale.pixelsPerUnit

  // Column visibility state (KAN-89)
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(
    new Set(BASE_COLS),
  )

  const handleColChange = (col: ColKey, on: boolean) => {
    setVisibleCols(prev => {
      const next = new Set(prev)
      on ? next.add(col) : next.delete(col)
      return next
    })
  }

  // Virtual scroll state (KAN-85)
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

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
  const time = usePoll(() => world.time, 80)

  // Auto-scroll to bottom on new rows
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [rows.length])

  const isTruncated = total > MAX_ROWS
  const totalH = rows.length * ROW_H

  // Virtual window: which rows to render based on scrollTop (KAN-85)
  const startRow = Math.max(0, Math.floor(scrollTop / ROW_H) - 5)
  const endRow   = Math.min(rows.length, startRow + VIRTUAL_WINDOW)
  const paddingTop    = startRow * ROW_H
  const paddingBottom = Math.max(0, totalH - endRow * ROW_H)
  const windowRows    = rows.slice(startRow, endRow)

  // Count visible columns for colSpan
  const visibleColCount = BASE_COLS.filter(c => visibleCols.has(c)).length + extraColumns.length

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
          {/* Column filter (KAN-89) */}
          <ColFilterPopover
            visible={visibleCols}
            onChange={handleColChange}
            extraColumns={extraColumns}
          />
          {/* CSV export (KAN-87) */}
          {rows.length > 0 && (
            <CsvExportButton recorder={recorder} scale={scale} />
          )}
        </div>
      </div>

      {/* Scrollable virtual table (KAN-85) */}
      <div
        ref={containerRef}
        onScroll={e => setScrollTop((e.target as HTMLDivElement).scrollTop)}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}
      >
        <table
          role="table"
          aria-label="Recorded physics data"
          style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}
        >
          <colgroup>
            {visibleCols.has('t')  && <col style={{ width: 52 }} />}
            {visibleCols.has('x')  && <col style={{ width: 52 }} />}
            {visibleCols.has('y')  && <col style={{ width: 52 }} />}
            {visibleCols.has('vx') && <col style={{ width: 56 }} />}
            {visibleCols.has('vy') && <col style={{ width: 56 }} />}
            {visibleCols.has('ax') && <col style={{ width: 56 }} />}
            {visibleCols.has('ay') && <col style={{ width: 56 }} />}
            {extraColumns.map(ec  => <col key={ec.key} style={{ width: 64 }} />)}
          </colgroup>
          <thead>
            <tr>
              {visibleCols.has('t')  && <TH>t (s)</TH>}
              {visibleCols.has('x')  && <TH>x ({u})</TH>}
              {visibleCols.has('y')  && <TH>y ({u})</TH>}
              {visibleCols.has('vx') && <TH>vx ({u}/s)</TH>}
              {visibleCols.has('vy') && <TH>vy ({u}/s)</TH>}
              {visibleCols.has('ax') && <TH>ax</TH>}
              {visibleCols.has('ay') && <TH>ay</TH>}
              {extraColumns.map(ec  => <TH key={ec.key}>{ec.header}</TH>)}
            </tr>
          </thead>
          <tbody aria-live="polite" aria-atomic="false">
            {/* Top spacer for virtual scroll */}
            {paddingTop > 0 && (
              <tr aria-hidden="true">
                <td colSpan={visibleColCount} style={{ height: paddingTop, padding: 0, border: 'none' }} />
              </tr>
            )}

            {windowRows.map((r, wi) => {
              const i = startRow + wi
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  {visibleCols.has('t')  && <TD mono>{r.t.toFixed(3)}</TD>}
                  {visibleCols.has('x')  && <TD mono>{r.x.toFixed(2)}</TD>}
                  {visibleCols.has('y')  && <TD mono>{r.y.toFixed(2)}</TD>}
                  {visibleCols.has('vx') && <TD mono>{r.vx.toFixed(2)}</TD>}
                  {visibleCols.has('vy') && <TD mono>{r.vy.toFixed(2)}</TD>}
                  {visibleCols.has('ax') && <TD mono>{r.ax.toFixed(2)}</TD>}
                  {visibleCols.has('ay') && <TD mono>{r.ay.toFixed(2)}</TD>}
                  {extraColumns.map(ec  => (
                    <TD key={ec.key} mono>{String(ec.getValue(r, i))}</TD>
                  ))}
                </tr>
              )
            })}

            {/* Bottom spacer for virtual scroll */}
            {paddingBottom > 0 && (
              <tr aria-hidden="true">
                <td colSpan={visibleColCount} style={{ height: paddingBottom, padding: 0, border: 'none' }} />
              </tr>
            )}

            {rows.length === 0 && (
              <tr>
                <td colSpan={visibleColCount} style={{
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
  world, recorder, scale, extraColumns,
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
      <DataMonitor world={world} recorder={recorder} scale={scale} extraColumns={extraColumns} />
      <GraphPanel
        recorder={recorder} scale={scale}
        xKey={xKey} yKey={yKey} flipY={flipY}
        onXKeyChange={onXKeyChange} onYKeyChange={onYKeyChange} onFlipY={onFlipY}
      />
    </div>
  )
}
