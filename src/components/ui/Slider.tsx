/**
 * Slider — accessible range input
 *
 * Accessibility:
 *  - <label> with htmlFor linkage
 *  - aria-valuenow / aria-valuemin / aria-valuemax / aria-valuetext
 *  - aria-describedby for hint text
 *  - Keyboard: Arrow keys, Home, End (native <input type=range>)
 */
import React, { CSSProperties } from 'react'
import { color, font, radius, focusRing } from '../../styles/tokens'

interface SliderProps {
  id:          string
  label:       string
  min:         number
  max:         number
  step?:       number
  value:       number
  onChange:    (v: number) => void
  unit?:       string
  /** Extra text shown below slider */
  hint?:       string
  /** Width of the track in px (default 280) */
  width?:      number
  /** Format function for aria-valuetext and display */
  format?:     (v: number) => string
  disabled?:   boolean
  style?:      CSSProperties
  /** Additional elements placed beside the label (e.g., preset buttons) */
  labelAddon?: React.ReactNode
}

export function Slider({
  id, label, min, max, step = 1,
  value, onChange,
  unit, hint, width = 280,
  format, disabled,
  style, labelAddon,
}: SliderProps) {
  const hintId      = `${id}-hint`
  const displayText = format ? format(value) : `${value}${unit ? ` ${unit}` : ''}`

  const trackStyle: CSSProperties = {
    width,
    accentColor: color.primary.default,
    cursor:      disabled ? 'not-allowed' : 'pointer',
    height:      4,
    borderRadius: radius.full,
    margin:      0,
    outline:     'none',
    background:  color.bg.raised,
    // Focus ring handled by wrapping label approach — native outline for safety
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>

      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <label
          htmlFor={id}
          style={{
            fontSize:      font.size.sm,
            fontWeight:    font.weight.semibold,
            color:         color.text.secondary,
            textTransform: 'uppercase' as const,
            letterSpacing: 0.8,
            cursor:        'pointer',
          }}
        >
          {label}
        </label>

        {/* Live value readout */}
        <span
          aria-live="polite"
          aria-atomic="true"
          style={{
            fontSize:   font.size.base,
            fontWeight: font.weight.bold,
            color:      color.text.primary,
            minWidth:   80,
          }}
        >
          {displayText}
        </span>

        {labelAddon}
      </div>

      {/* Range track */}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={displayText}
        aria-describedby={hint ? hintId : undefined}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={trackStyle}
        onFocus={e => { e.currentTarget.style.outline = focusRing.outline; e.currentTarget.style.outlineOffset = focusRing.outlineOffset }}
        onBlur={e  => { e.currentTarget.style.outline = 'none' }}
      />

      {/* Tick labels slot */}
      {hint && (
        <span
          id={hintId}
          style={{
            fontSize: font.size.xs,
            color:    color.text.muted,
            marginTop: 0,
          }}
        >
          {hint}
        </span>
      )}
    </div>
  )
}
