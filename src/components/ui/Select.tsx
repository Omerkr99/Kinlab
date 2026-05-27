/**
 * Select — accessible dropdown
 *
 * Accessibility:
 *  - <label> with htmlFor linkage
 *  - aria-describedby for hint
 *  - Keyboard: native <select> (Arrow, Enter, Space)
 */
import { useState, CSSProperties } from 'react'
import { color, font, radius, focusRing, componentSize } from '../../styles/tokens'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps {
  id:       string
  label?:   string
  /** Hide the label visually but keep it for screen readers */
  srOnly?:  boolean
  options:  SelectOption[]
  value:    string
  onChange: (value: string) => void
  hint?:    string
  disabled?: boolean
  style?:   CSSProperties
}

export function Select({
  id, label, srOnly = false,
  options, value, onChange,
  hint, disabled, style,
}: SelectProps) {
  const [focused, setFocused] = useState(false)
  const hintId = hint ? `${id}-hint` : undefined

  const labelStyle: CSSProperties = srOnly
    ? {
        position: 'absolute',
        width: 1, height: 1,
        padding: 0, margin: -1,
        overflow: 'hidden',
        clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap',
        borderWidth: 0,
      }
    : {
        fontSize:   font.size.sm,
        fontWeight: font.weight.semibold,
        color:      color.text.secondary,
        textTransform: 'uppercase' as const,
        letterSpacing: 0.8,
        cursor:     'pointer',
        marginRight: 6,
      }

  const selectStyle: CSSProperties = {
    height:       componentSize.input.height,
    paddingLeft:  componentSize.input.px,
    paddingRight: componentSize.input.px + 16,
    fontSize:     componentSize.input.fontSize,
    fontWeight:   font.weight.medium,
    fontFamily:   'inherit',
    color:        disabled ? color.text.muted : color.text.primary,
    background:   color.bg.raised,
    border:       `1px solid ${focused ? color.primary.default : color.bg.border}`,
    borderRadius: radius.md,
    cursor:       disabled ? 'not-allowed' : 'pointer',
    outline:      focused ? focusRing.outline : 'none',
    outlineOffset: focused ? focusRing.outlineOffset : undefined,
    transition:   'border-color 0.15s, outline 0.1s',
    appearance:   'none',
    WebkitAppearance: 'none',
    // Chevron via background image
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2394a3b8' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `right ${componentSize.input.px}px center`,
    backgroundSize: '12px 8px',
    minWidth: 120,
    ...style,
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label htmlFor={id} style={labelStyle}>
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-describedby={hintId}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={()  => setFocused(false)}
        style={selectStyle}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && (
        <span id={hintId} style={{ fontSize: font.size.xs, color: color.text.muted }}>
          {hint}
        </span>
      )}
    </div>
  )
}
