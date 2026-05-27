/**
 * StatusBar — bottom status bar (28px)
 *
 * Left:   Mouse: (4.32, 1.05) m
 * Center: Zoom: 100%  [−] [slider] [+]
 * Right:  Simulation Speed: 1.0x  [slider]
 */
import type { CursorPos } from './shellTypes'
import type { PhysicsScale } from '../units/PhysicsScale'
import { FLOOR_Y } from '../constants'

interface StatusBarProps {
  cursorPos?:          CursorPos | null
  scale:               PhysicsScale
  zoom:                number
  onZoomChange:        (v: number) => void
  simulationSpeed:     number
  onSimSpeedChange:    (v: number) => void
}

function MiniSlider({
  id, min, max, step, value, onChange, width = 80,
}: {
  id: string; min: number; max: number; step: number; value: number
  onChange: (v: number) => void; width?: number
}) {
  return (
    <input
      id={id}
      type="range"
      min={min} max={max} step={step} value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      aria-label={id}
      style={{
        width,
        height:      3,
        accentColor: '#2563EB',
        cursor:      'pointer',
        verticalAlign: 'middle',
      }}
    />
  )
}

function ZoomBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label === '−' ? 'Zoom out' : 'Zoom in'}
      onClick={onClick}
      style={{
        width: 18, height: 18,
        border: '1px solid #E5E7EB',
        borderRadius: 3,
        background: '#F9FAFB',
        color: '#374151',
        fontSize: 14,
        lineHeight: 1,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'monospace',
        padding: 0,
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  )
}

export function StatusBar({
  cursorPos, scale,
  zoom, onZoomChange,
  simulationSpeed, onSimSpeedChange,
}: StatusBarProps) {
  const unit = scale.unitSymbol
  const ppu  = scale.pixelsPerUnit

  let coordText = '—'
  if (cursorPos) {
    const x = (cursorPos.canvasX / ppu).toFixed(2)
    const y = ((FLOOR_Y - cursorPos.canvasY) / ppu).toFixed(2)
    coordText = `(${x}, ${y}) ${unit}`
  }

  return (
    <div
      role="status"
      aria-label="Status bar"
      style={{
        height:         28,
        minHeight:      28,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '0 14px',
        background:     '#F9FAFB',
        borderTop:      '1px solid #E5E7EB',
        flexShrink:     0,
        gap:            16,
        overflow:       'hidden',
      }}
    >
      {/* Left: mouse coordinates */}
      <span
        aria-live="off"
        style={{
          fontSize:   11,
          fontFamily: '"JetBrains Mono","Fira Code",monospace',
          color:      '#9CA3AF',
          whiteSpace: 'nowrap',
          minWidth:   140,
        }}
      >
        Mouse:&nbsp;{coordText}
      </span>

      {/* Center: zoom control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' }}>
        <span style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>
          Zoom: {Math.round(zoom * 100)}%
        </span>
        <ZoomBtn label="−" onClick={() => onZoomChange(Math.max(0.25, zoom - 0.1))} />
        <MiniSlider
          id="zoom-slider"
          min={0.25} max={4} step={0.05} value={zoom}
          onChange={onZoomChange} width={80}
        />
        <ZoomBtn label="+" onClick={() => onZoomChange(Math.min(4, zoom + 0.1))} />
      </div>

      {/* Right: simulation speed */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 160, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>
          Sim Speed: {simulationSpeed.toFixed(1)}×
        </span>
        <MiniSlider
          id="sim-speed-slider"
          min={0.1} max={3} step={0.1} value={simulationSpeed}
          onChange={onSimSpeedChange} width={70}
        />
      </div>
    </div>
  )
}
