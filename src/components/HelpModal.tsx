/**
 * HelpModal — KAN-112: keyboard shortcuts + feature summary
 * Rendered as a React portal so it sits above all other content.
 */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../context/ThemeContext'

interface HelpModalProps {
  onClose: () => void
}

const SECTIONS: Array<{
  heading: string
  rows:    Array<[string, string]>  // [key/action, description]
}> = [
  {
    heading: 'Simulation',
    rows: [
      ['Space / ▶',  'Play / Pause'],
      ['R',          'Reset simulation'],
      ['Ctrl + S',   'Save state'],
      ['Ctrl + Z',   'Undo (coming soon)'],
    ],
  },
  {
    heading: 'Tools',
    rows: [
      ['S',          'Select tool — click a body to inspect it'],
      ['M',          'Move tool — drag a body with the mouse'],
      ['F',          'Force tool — drag from a body to apply an impulse'],
      ['D',          'Delete tool — click a body to remove it'],
    ],
  },
  {
    heading: 'Object Types',
    rows: [
      ['Circle',     'Circular body — default type, perfectly elastic collisions'],
      ['Rectangle',  'Box-shaped body — same physics as circle (bounding sphere)'],
    ],
  },
  {
    heading: 'Environment',
    rows: [
      ['Floor',       'Toggle floor boundary on/off'],
      ['Walls',       'Toggle left/right wall boundaries'],
      ['Restitution', 'Bounciness of the floor (0 = absorb, 1 = elastic)'],
      ['Friction',    'Floor friction (0 = none, 1 = full stop on bounce)'],
    ],
  },
  {
    heading: 'Units & Scale',
    rows: [
      ['px',     '1:1 pixels — cartoon physics, no real-world scale'],
      ['cm',     '10 px = 1 cm — tabletop experiments'],
      ['m',      '100 px = 1 m — real-world gravity (9.8 m/s²)'],
      ['custom', 'User-defined px-per-unit ratio'],
    ],
  },
]

export function HelpModal({ onClose }: HelpModalProps) {
  const { isDark } = useTheme()

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const bg      = isDark ? '#1F2937' : '#FFFFFF'
  const border  = isDark ? '#374151' : '#E5E7EB'
  const heading = isDark ? '#F9FAFB' : '#111827'
  const muted   = isDark ? '#9CA3AF' : '#6B7280'
  const rowBg   = isDark ? '#111827' : '#F9FAFB'
  const keyBg   = isDark ? '#374151' : '#EFF6FF'
  const keyText = isDark ? '#93C5FD' : '#2563EB'

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 1000,
        }}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="KinLab Help"
        style={{
          position:     'fixed',
          top:          '50%',
          left:         '50%',
          transform:    'translate(-50%, -50%)',
          width:        560,
          maxWidth:     'calc(100vw - 32px)',
          maxHeight:    '80vh',
          background:   bg,
          border:       `1px solid ${border}`,
          borderRadius: 12,
          boxShadow:    '0 24px 64px rgba(0,0,0,0.3)',
          zIndex:       1001,
          display:      'flex',
          flexDirection: 'column',
          overflow:     'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '16px 20px',
          borderBottom:   `1px solid ${border}`,
          flexShrink:     0,
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: heading }}>
            ❓ KinLab Help
          </span>
          <button
            onClick={onClose}
            aria-label="Close help"
            style={{
              width: 28, height: 28, border: 'none',
              background: 'transparent', fontSize: 18,
              color: muted, cursor: 'pointer', borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {SECTIONS.map(section => (
            <section key={section.heading} style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: 0.8, color: muted, marginBottom: 8,
              }}>
                {section.heading}
              </div>
              <div style={{
                background: rowBg, borderRadius: 6,
                border: `1px solid ${border}`, overflow: 'hidden',
              }}>
                {section.rows.map(([key, desc], i) => (
                  <div
                    key={key}
                    style={{
                      display:     'flex',
                      alignItems:  'center',
                      gap:         12,
                      padding:     '7px 12px',
                      borderBottom: i < section.rows.length - 1 ? `1px solid ${border}` : 'none',
                    }}
                  >
                    <code style={{
                      fontSize:     11,
                      fontWeight:   600,
                      background:   keyBg,
                      color:        keyText,
                      padding:      '2px 6px',
                      borderRadius: 4,
                      whiteSpace:   'nowrap',
                      minWidth:     80,
                      textAlign:    'center',
                      flexShrink:   0,
                    }}>
                      {key}
                    </code>
                    <span style={{ fontSize: 13, color: heading }}>
                      {desc}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>,
    document.body
  )
}
