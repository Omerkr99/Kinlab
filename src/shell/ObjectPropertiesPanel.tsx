/**
 * ObjectPropertiesPanel — right sidebar (280px)
 *
 * Shown when an object is selected. Sections:
 *  1. Header: "Object Properties" + close button
 *  2. Object type row: color swatch + type + ID
 *  3. Position (x, y)
 *  4. Velocity (vx, vy)
 *  5. Acceleration (ax, ay) — read-only
 *  6. Physical properties (mass, width, height, restitution)
 *  7. Appearance (color picker)
 *  8. Delete button
 *  9. Live Values card (time, fps, objects, energy, momentum)
 * 10. Recorder section
 *
 * Props:
 *  - bodyIndex: which body is selected (null = hidden)
 *  - world: for live polling of body state
 *  - recorder: for recording state
 *  - onClose: deselect handler
 *  - onDelete: delete handler
 *  - onBodyChange: field change handler (fired on input blur / Enter)
 *  - playState: 'idle' | 'running' | 'paused'
 *  - fps: measured FPS
 */
import { useState, useCallback } from 'react'
import type { World } from '../engine'
import type { DataRecorder } from '../recorder'
import type { PlayState } from './shellTypes'
import type { PhysicsScale } from '../units/PhysicsScale'
import { usePoll, useFps } from './hooks'
import { FLOOR_Y } from '../constants'

interface ObjectPropertiesPanelProps {
  bodyIndex:      number | null
  world:          World
  recorder:       DataRecorder
  playState:      PlayState
  onClose:        () => void
  onDelete?:      (index: number) => void
  onPlayStateChange: (s: PlayState) => void
  interaction:    { resume(): void; pause(): void }
  /** KAN-108: current physics scale — drives position/velocity/accel unit labels */
  scale:          PhysicsScale
}

// ── Property input ────────────────────────────────────────────────────────────

function PropInput({
  id, label, unit, value, readOnly, onChange,
}: {
  id: string; label: string; unit?: string; value: number | string
  readOnly?: boolean; onChange?: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')

  const display = typeof value === 'number' ? value.toFixed(3) : value

  const commit = () => {
    setEditing(false)
    const n = parseFloat(draft)
    if (!isNaN(n)) onChange?.(n)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label htmlFor={id} style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>
        {label}{unit ? ` (${unit})` : ''}
      </label>
      <input
        id={id}
        type="text"
        value={editing ? draft : display}
        readOnly={readOnly}
        onChange={e => setDraft(e.target.value)}
        onFocus={() => { if (!readOnly) { setEditing(true); setDraft(String(display)) } }}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        aria-label={`${label}${unit ? ` in ${unit}` : ''}`}
        style={{
          width:        '100%',
          padding:      '5px 8px',
          fontSize:     13,
          fontFamily:   '"JetBrains Mono", "Fira Code", monospace',
          border:       '1px solid #E5E7EB',
          borderRadius: 4,
          background:   readOnly ? '#F9FAFB' : '#FFFFFF',
          color:        readOnly ? '#9CA3AF' : '#111827',
          boxSizing:    'border-box' as const,
          outline:      'none',
          cursor:       readOnly ? 'default' : 'text',
        }}
        onFocusCapture={e => { if (!readOnly) e.currentTarget.style.borderColor = '#2563EB' }}
        onBlurCapture={e  => { e.currentTarget.style.borderColor = '#E5E7EB' }}
      />
    </div>
  )
}

// ── Grid layout for 2-column property groups ──────────────────────────────────

function PropGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {children}
    </div>
  )
}

// ── Group section ─────────────────────────────────────────────────────────────

function PropSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} style={{ marginBottom: 14 }}>
      <div style={{
        fontSize:   11,
        fontWeight: 600,
        color:      '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: 0.7,
        marginBottom: 6,
      }}>
        {title}
      </div>
      {children}
    </section>
  )
}

// ── Recording indicator ───────────────────────────────────────────────────────

function RecordingBadge({ recorder }: { recorder: DataRecorder }) {
  const len = usePoll(() => recorder.getLength(), 500)
  const isRecording = len > 0

  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          8,
      padding:      '8px 10px',
      background:   isRecording ? '#FFF1F2' : '#F9FAFB',
      borderRadius: 6,
      border:       `1px solid ${isRecording ? '#FCA5A5' : '#E5E7EB'}`,
    }}>
      <span
        aria-hidden="true"
        style={{
          width:        8,
          height:       8,
          borderRadius: '50%',
          background:   isRecording ? '#DC2626' : '#9CA3AF',
          animation:    isRecording ? 'pulse 1.2s ease infinite' : 'none',
          flexShrink:   0,
        }}
      />
      <span style={{ fontSize: 12, fontWeight: 600, color: isRecording ? '#DC2626' : '#9CA3AF' }}>
        {isRecording ? 'Recording…' : 'Not recording'}
      </span>
      {isRecording && (
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#6B7280', marginLeft: 'auto' }}>
          {len} pts
        </span>
      )}
    </div>
  )
}

// ── ObjectPropertiesPanel ─────────────────────────────────────────────────────

const OBJECT_COLORS: Record<number, string> = {
  0: '#2563EB',  // circle — blue
  1: '#16A34A',  // rect — green
  2: '#DC2626',  // circle 3 — red
}

export function ObjectPropertiesPanel({
  bodyIndex, world, recorder, playState, onClose, onDelete, scale,
}: ObjectPropertiesPanelProps) {
  // Poll the selected body's live state
  const getBodySnap = useCallback(() => {
    if (bodyIndex === null) return null
    const b = world.bodies[bodyIndex]
    if (!b) return null
    return {
      x:  b.x,
      y:  FLOOR_Y - b.y,  // physical y (floor=0, up=+)
      vx: b.vx,
      vy: -b.vy,           // physical vy
      ax: b.ax,
      ay: -b.ay,           // physical ay
      mass: b.mass,
    }
  }, [bodyIndex, world])

  const snap = usePoll(getBodySnap, 80)
  const fps  = useFps(playState === 'running')

  // Live stats
  const objectCount = usePoll(() => world.bodies.length, 500)
  const liveTime    = usePoll(() => world.time, 80)

  if (bodyIndex === null || !snap) return null

  const b         = world.bodies[bodyIndex]
  const typeLabel = b?.type ?? 'Circle'   // KAN-111: read Body.type; default 'Circle'
  const typeColor = OBJECT_COLORS[bodyIndex % 3] ?? '#2563EB'

  return (
    <aside
      aria-label="Object Properties"
      style={{
        width:         280,
        minWidth:      280,
        height:        '100%',
        background:    '#FFFFFF',
        borderLeft:    '1px solid #E5E7EB',
        display:       'flex',
        flexDirection: 'column',
        overflow:      'hidden',
        flexShrink:    0,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '12px 14px 10px',
        borderBottom:   '1px solid #E5E7EB',
        flexShrink:     0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
          Object Properties
        </span>
        <button
          aria-label="Close properties panel"
          onClick={onClose}
          style={{
            width: 24, height: 24,
            border: 'none',
            background: 'transparent',
            fontSize: 16, color: '#9CA3AF',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 4,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#374151' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF' }}
        >
          ✕
        </button>
      </div>

      {/* ── Scrollable body ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>

        {/* Object type row */}
        <div style={{
          display:      'flex',
          alignItems:   'center',
          gap:          8,
          marginBottom: 16,
          padding:      '8px 10px',
          background:   '#F9FAFB',
          borderRadius: 6,
          border:       '1px solid #E5E7EB',
        }}>
          <span style={{
            width: 16, height: 16, borderRadius: '50%',
            background: typeColor, flexShrink: 0, display: 'inline-block',
          }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', flex: 1 }}>
            {typeLabel}
          </span>
          <span style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>
            ID: {bodyIndex}
          </span>
        </div>

        {/* Position */}
        <PropSection title="Position">
          <PropGrid>
            <PropInput id="prop-x" label="x" unit={scale.unitSymbol} value={snap.x}
              onChange={v => { if (b) b.x = v }} />
            <PropInput id="prop-y" label="y" unit={scale.unitSymbol} value={snap.y}
              onChange={v => { if (b) b.y = FLOOR_Y - v }} />
          </PropGrid>
        </PropSection>

        {/* Velocity */}
        <PropSection title="Velocity">
          <PropGrid>
            <PropInput id="prop-vx" label="vx" unit={`${scale.unitSymbol}/s`} value={snap.vx}
              onChange={v => { if (b) b.vx = v }} />
            <PropInput id="prop-vy" label="vy" unit={`${scale.unitSymbol}/s`} value={snap.vy}
              onChange={v => { if (b) b.vy = -v }} />
          </PropGrid>
        </PropSection>

        {/* Acceleration (read-only) */}
        <PropSection title="Acceleration">
          <PropGrid>
            <PropInput id="prop-ax" label="ax" unit={`${scale.unitSymbol}/s²`} value={snap.ax} readOnly />
            <PropInput id="prop-ay" label="ay" unit={`${scale.unitSymbol}/s²`} value={snap.ay} readOnly />
          </PropGrid>
        </PropSection>

        {/* Physical properties */}
        <PropSection title="Physical Properties">
          <PropGrid>
            <PropInput id="prop-mass" label="Mass" unit="kg" value={snap.mass}
              onChange={v => { if (b) b.mass = Math.max(0.01, v) }} />
            <PropInput id="prop-rad" label="Radius" unit="px"
              value={b?.radius ?? 20} readOnly />
          </PropGrid>
        </PropSection>

        {/* Appearance */}
        <PropSection title="Appearance">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#374151' }}>Color</span>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: typeColor,
              border: '1px solid #E5E7EB', cursor: 'pointer',
            }} />
            <span style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace' }}>
              {typeColor}
            </span>
          </div>
        </PropSection>

        {/* Delete */}
        <button
          onClick={() => onDelete?.(bodyIndex)}
          style={{
            width:        '100%',
            height:       36,
            border:       '1px solid #DC2626',
            borderRadius: 6,
            background:   'transparent',
            color:        '#DC2626',
            fontSize:     13,
            fontWeight:   600,
            cursor:       'pointer',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            gap:          6,
            fontFamily:   'inherit',
            marginBottom: 14,
            transition:   'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#FFF1F2' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          🗑 Delete Object
        </button>

        {/* Live Values card */}
        <div style={{
          background:   '#F9FAFB',
          borderRadius: 8,
          border:       '1px solid #E5E7EB',
          padding:      '10px 12px',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
            Live Values
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 0', rowGap: 4 }}>
            {([
              ['Time',                    `${liveTime.toFixed(2)} s`],
              ['FPS',                     String(fps)],
              ['Objects',                 String(objectCount)],
              ['Momentum',                `${(snap.mass * Math.hypot(snap.vx, snap.vy)).toFixed(2)} kg·m/s`],
            ] as [string, string][]).map(([k, v]) => (
              <>
                <span key={`k-${k}`} style={{ fontSize: 11, color: '#9CA3AF' }}>{k}</span>
                <span key={`v-${k}`} style={{ fontSize: 12, fontFamily: 'monospace', color: '#111827', textAlign: 'right' }}>{v}</span>
              </>
            ))}
          </div>
        </div>

        {/* Recorder section */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Recorder
          </div>
          <RecordingBadge recorder={recorder} />
        </div>
      </div>
    </aside>
  )
}
