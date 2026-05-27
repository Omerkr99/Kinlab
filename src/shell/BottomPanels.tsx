/**
 * BottomPanels — bottom area split into DataMonitor (~55%) + GraphPanel (~45%)
 *
 * DataMonitor: live table of all bodies (time, x, y, vx, vy, ax, ay)
 * GraphPanel:  wraps the existing GraphCanvas + AxisSelector
 *
 * Accessibility:
 *  - DataMonitor: role="table" with scope headers, aria-live="polite" on tbody
 *  - GraphPanel: axis selectors have <label> linkage
 */
import { useCallback } from 'react'
import React from 'react'
import { GraphCanvas } from '../canvas/GraphCanvas'
import { AxisSelector } from '../components/AxisSelector'
import { CsvExportButton } from '../components/CsvExportButton'
import type { DataRecorder, SeriesKey } from '../recorder'
import type { PhysicsScale } from '../units/PhysicsScale'
import type { World } from '../engine'
import { usePoll } from './hooks'
import { FLOOR_Y } from '../constants'

// ── DataMonitor ───────────────────────────────────────────────────────────────

interface DataMonitorProps {
  world:    World
  recorder: DataRecorder
  scale:    PhysicsScale
}

export const BODY_COLORS = ['#2563EB', '#16A34A', '#DC2626', '#7C3AED', '#EAB308']
const BODY_ICONS  = ['🔵', '🟩', '🔴', '🟣', '🟡']

const TH = ({ children }: { children: React.ReactNode }) => (
  <th style={{
    padding:      '6px 10px',
    fontSize:     11,
    fontWeight:   600,
    color:        '#6B7280',
    background:   '#F9FAFB',
    borderBottom: '1px solid #E5E7EB',
    textAlign:    'right',
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
    padding:    '5px 10px',
    fontSize:   12,
    color:      '#111827',
    textAlign:  left ? 'left' : 'right',
    fontFamily: mono ? '"JetBrains Mono","Fira Code",monospace' : 'inherit',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid #F3F4F6',
  }}>
    {children}
  </td>
)

function DataMonitor({ world, recorder: _recorder, scale }: DataMonitorProps) {
  const getBodies = useCallback(() =>
    world.bodies.map((b, i) => ({
      i,
      x:  b.x / scale.pixelsPerUnit,
      y:  (FLOOR_Y - b.y) / scale.pixelsPerUnit,
      vx: b.vx / scale.pixelsPerUnit,
      vy: -b.vy / scale.pixelsPerUnit,
      ax: b.ax / scale.pixelsPerUnit,
      ay: -b.ay / scale.pixelsPerUnit,
    }))
  , [world, scale])

  const rows    = usePoll(getBodies, 80)
  const time    = usePoll(() => world.time, 80)
  const timeStr = time.toFixed(2)
  const u       = scale.unitSymbol

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
        padding:        '8px 12px',
        borderBottom:   '1px solid #E5E7EB',
        flexShrink:     0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
          Data Monitor
        </span>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#9CA3AF' }}>
          t = {timeStr} s
        </span>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        <table
          role="table"
          aria-label="Live physics data"
          style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}
        >
          <thead>
            <tr>
              <TH>Time (s)</TH>
              <TH>Object</TH>
              <TH>x ({u})</TH>
              <TH>y ({u})</TH>
              <TH>vx ({u}/s)</TH>
              <TH>vy ({u}/s)</TH>
              <TH>ax ({u}/s²)</TH>
              <TH>ay ({u}/s²)</TH>
            </tr>
          </thead>
          <tbody aria-live="polite" aria-atomic="false">
            {rows.map((r, i) => (
              <tr key={r.i} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                <TD mono>{timeStr}</TD>
                <TD left>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 14 }}>{BODY_ICONS[r.i % BODY_ICONS.length]}</span>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>
                      {BODY_ICONS[r.i % BODY_ICONS.length] === '🟩' ? 'Rect' : 'Circle'} {r.i + 1}
                    </span>
                  </span>
                </TD>
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
                <td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                  Press ▶ Start to begin recording data
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
