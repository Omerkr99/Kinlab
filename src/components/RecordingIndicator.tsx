import { useEffect, useState } from 'react'
import { DataRecorder } from '../recorder'
import { InteractionLayer } from '../engine'

type Status = 'idle' | 'recording' | 'paused'

interface Props {
  recorder:    DataRecorder
  interaction: InteractionLayer
}

export function RecordingIndicator({ recorder, interaction }: Props) {
  const [status, setStatus]   = useState<Status>('idle')
  const [blink,  setBlink]    = useState(true)   // drives the REC dot pulse

  // Poll recording state at 10 fps
  useEffect(() => {
    const id = setInterval(() => {
      if (!recorder.isRecording()) {
        setStatus('idle')
      } else if (interaction.isPaused()) {
        setStatus('paused')
      } else {
        setStatus('recording')
      }
    }, 100)
    return () => clearInterval(id)
  }, [recorder, interaction])

  // Blink tick for REC dot
  useEffect(() => {
    if (status !== 'recording') { setBlink(true); return }
    const id = setInterval(() => setBlink(b => !b), 600)
    return () => clearInterval(id)
  }, [status])

  if (status === 'idle') return null

  const cfg = status === 'recording'
    ? { dot: '#e53935', label: 'REC', bg: '#fff5f5', border: '#ffcdd2', textColor: '#c62828' }
    : { dot: '#f59e0b', label: 'PAUSED', bg: '#fffbeb', border: '#fde68a', textColor: '#92400e' }

  return (
    <div style={{
      display:    'inline-flex',
      alignItems: 'center',
      gap:        6,
      padding:    '4px 10px',
      borderRadius: 20,
      background: cfg.bg,
      border:     `1px solid ${cfg.border}`,
      fontSize:   12,
      fontWeight: 700,
      color:      cfg.textColor,
      letterSpacing: 0.8,
      userSelect: 'none',
    }}>
      {/* pulsing dot */}
      <span style={{
        width: 8, height: 8,
        borderRadius: '50%',
        background:   cfg.dot,
        display:      'inline-block',
        opacity:      status === 'recording' ? (blink ? 1 : 0.2) : 1,
        transition:   'opacity 0.3s',
      }} />
      {cfg.label}
    </div>
  )
}
