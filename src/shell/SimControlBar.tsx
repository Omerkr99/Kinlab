/**
 * SimControlBar — simulation control bar (52px)
 *
 * Left:   ▶ Start | ⏸ Pause | ⏹ Reset
 * Center: Time: 2.45 s
 * Right:  Gravity [toggle] | Grid [toggle] | Snap [toggle]
 *
 * Wires into: World, DataRecorder, InteractionLayer
 * All physics resets (ball position) happen here via resetBall().
 */
import { useState } from 'react'
import { Toggle } from '../components/ui/Toggle'
import { type PlayState } from './shellTypes'
import { usePoll } from './hooks'
import type { World } from '../engine'
import type { DataRecorder } from '../recorder'
import type { InteractionLayer } from '../engine'
import { FLOOR_Y } from '../constants'

const START_X = 300
const START_Y = 50

function resetBall(world: World): void {
  world.time = 0
  const b = world.bodies[0]
  if (b) { b.x = START_X; b.y = START_Y; b.vx = 0; b.vy = 0; b.ax = 0; b.ay = 0 }
}

interface SimControlBarProps {
  world:          World
  recorder:       DataRecorder
  interaction:    InteractionLayer
  playState:      PlayState
  onPlayStateChange: (s: PlayState) => void
  gravityEnabled: boolean
  onGravityEnabled: (v: boolean) => void
  gridEnabled:    boolean
  onGridEnabled:  (v: boolean) => void
  snapEnabled:    boolean
  onSnapEnabled:  (v: boolean) => void
  /** Called after a full simulation reset (for toast / side-effects) */
  onAfterReset?:  () => void
}

// ── Control button ────────────────────────────────────────────────────────────

interface CtrlBtnProps {
  icon:      string
  label:     string
  variant:   'primary' | 'outline'
  onClick:   () => void
  disabled?: boolean
}

function CtrlBtn({ icon, label, variant, onClick, disabled }: CtrlBtnProps) {
  const [hov, setHov] = useState(false)
  const isPrimary = variant === 'primary'

  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:    'inline-flex',
        alignItems: 'center',
        gap:        6,
        height:     36,
        padding:    '0 16px',
        fontSize:   13,
        fontWeight: 600,
        fontFamily: 'inherit',
        border:     isPrimary
          ? 'none'
          : `1px solid ${hov ? '#D1D5DB' : '#E5E7EB'}`,
        borderRadius: 6,
        background:   isPrimary
          ? (disabled ? '#93C5FD' : hov ? '#1D4ED8' : '#2563EB')
          : (hov ? '#F3F4F6' : '#FFFFFF'),
        color:        isPrimary ? '#FFFFFF' : '#374151',
        cursor:       disabled ? 'not-allowed' : 'pointer',
        opacity:      disabled ? 0.65 : 1,
        transition:   'all 0.12s',
        whiteSpace:   'nowrap',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 14 }}>{icon}</span>
      {label}
    </button>
  )
}

// ── Toggle row item ───────────────────────────────────────────────────────────

function ToggleItem({ id, label, checked, onChange }: {
  id: string; label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 500, letterSpacing: 0.3 }}>
        {label}
      </span>
      <Toggle id={id} checked={checked} onChange={onChange} size="sm" />
    </div>
  )
}

// ── SimControlBar ─────────────────────────────────────────────────────────────

export function SimControlBar({
  world, recorder, interaction,
  playState, onPlayStateChange,
  gravityEnabled, onGravityEnabled,
  gridEnabled,    onGridEnabled,
  snapEnabled,    onSnapEnabled,
  onAfterReset,
}: SimControlBarProps) {

  // Poll world.time every 80ms for the time display
  const time = usePoll(() => world.time, 80)

  const handlePlay = () => {
    resetBall(world)
    recorder.reset()
    recorder.start()
    const b0 = world.bodies[0]
    if (b0) recorder.record(world.time, b0.x, FLOOR_Y - b0.y, b0.vx, -b0.vy, b0.ax, -b0.ay)
    interaction.resume()
    onPlayStateChange('running')
  }

  const handlePause = () => {
    interaction.pause()
    onPlayStateChange('paused')
  }

  const handleReset = () => {
    interaction.pause()
    recorder.reset()
    resetBall(world)
    onPlayStateChange('idle')
    onAfterReset?.()
  }

  return (
    <div
      role="toolbar"
      aria-label="Simulation controls"
      style={{
        height:         52,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '0 16px',
        background:     '#FFFFFF',
        borderBottom:   '1px solid #E5E7EB',
        gap:            16,
      }}
    >
      {/* Left: Play / Pause / Reset */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <CtrlBtn
          icon="▶" label="Start"
          variant="primary"
          onClick={handlePlay}
          disabled={playState === 'running'}
        />
        <CtrlBtn
          icon="⏸" label="Pause"
          variant="outline"
          onClick={handlePause}
          disabled={playState !== 'running'}
        />
        <CtrlBtn
          icon="⏹" label="Reset"
          variant="outline"
          onClick={handleReset}
          disabled={playState === 'idle'}
        />
      </div>

      {/* Center: Time display */}
      <div
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}
        aria-live="polite"
        aria-label={`Simulation time: ${time.toFixed(2)} seconds`}
      >
        <span style={{ fontSize: 11, color: '#9CA3AF', letterSpacing: 0.5, fontWeight: 500 }}>
          Time
        </span>
        <span style={{
          fontSize:   20,
          fontWeight: 700,
          color:      '#111827',
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          letterSpacing: -0.5,
          lineHeight: 1.1,
        }}>
          {time.toFixed(2)}&nbsp;s
        </span>
      </div>

      {/* Right: Toggle row */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <ToggleItem id="tog-gravity" label="Gravity" checked={gravityEnabled} onChange={onGravityEnabled} />
        <ToggleItem id="tog-grid"    label="Grid"    checked={gridEnabled}    onChange={onGridEnabled}    />
        <ToggleItem id="tog-snap"    label="Snap"    checked={snapEnabled}    onChange={onSnapEnabled}    />
      </div>
    </div>
  )
}
