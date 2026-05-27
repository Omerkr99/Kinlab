/**
 * Toggle — accessible pill-style toggle switch
 *
 * Accessibility:
 *  - role="switch" + aria-checked
 *  - Keyboard: Enter / Space to toggle
 *  - Focus ring on :focus-visible
 */
import { CSSProperties } from 'react'

interface ToggleProps {
  id:        string
  checked:   boolean
  onChange:  (v: boolean) => void
  /** Optional text label (right of pill by default) */
  label?:    string
  size?:     'sm' | 'md'
  disabled?: boolean
  style?:    CSSProperties
}

export function Toggle({ id, checked, onChange, label, size = 'md', disabled, style }: ToggleProps) {
  const trackW = size === 'sm' ? 28 : 36
  const trackH = size === 'sm' ? 16 : 20
  const thumb  = size === 'sm' ? 12 : 16
  const pad    = 2

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}>
      <span
        role="switch"
        id={id}
        aria-checked={checked}
        aria-disabled={disabled}
        aria-label={label}
        tabIndex={disabled ? -1 : 0}
        onClick={() => { if (!disabled) onChange(!checked) }}
        onKeyDown={e => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault()
            onChange(!checked)
          }
        }}
        onFocus={e => { e.currentTarget.style.boxShadow = '0 0 0 2px rgba(37,99,235,0.35)' }}
        onBlur={e  => { e.currentTarget.style.boxShadow = 'none' }}
        style={{
          position:     'relative',
          display:      'inline-block',
          width:        trackW,
          height:       trackH,
          borderRadius: 9999,
          background:   checked ? '#2563EB' : '#9CA3AF',
          transition:   'background 0.18s',
          cursor:       disabled ? 'not-allowed' : 'pointer',
          opacity:      disabled ? 0.55 : 1,
          flexShrink:   0,
          outline:      'none',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position:     'absolute',
            top:          pad,
            left:         checked ? trackW - thumb - pad : pad,
            width:        thumb,
            height:       thumb,
            borderRadius: '50%',
            background:   'white',
            transition:   'left 0.18s',
            boxShadow:    '0 1px 3px rgba(0,0,0,0.22)',
          }}
        />
      </span>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize:   13,
            color:      '#374151',
            cursor:     disabled ? 'not-allowed' : 'pointer',
            userSelect: 'none',
          }}
        >
          {label}
        </label>
      )}
    </span>
  )
}
