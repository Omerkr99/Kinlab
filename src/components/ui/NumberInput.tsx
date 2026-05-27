/**
 * NumberInput — numeric input with +/- stepper buttons
 *
 * Accessibility:
 *  - role="spinbutton", aria-valuemin/max/now/valuetext
 *  - Keyboard: ArrowUp/Down to step, Shift+Arrow for big step
 *  - Label + hint/error via aria-describedby
 */
import { useState, useId, useCallback, KeyboardEvent, CSSProperties } from 'react'
import { color, font, radius, transition, focusRing } from '../../styles/tokens'

interface NumberInputProps {
  id?:         string
  label?:      string
  labelHidden?: boolean
  value:       number
  onChange:    (v: number) => void
  min?:        number
  max?:        number
  step?:       number
  /** Large step used with Shift+Arrow */
  bigStep?:    number
  decimals?:   number
  unit?:       string
  hint?:       string
  error?:      string
  disabled?:   boolean
  style?:      CSSProperties
  width?:      number | string
}

export function NumberInput({
  id: idProp,
  label, labelHidden = false,
  value, onChange,
  min = -Infinity, max = Infinity, step = 1, bigStep,
  decimals = 2,
  unit, hint, error, disabled,
  style, width,
}: NumberInputProps) {
  const autoId = useId()
  const id     = idProp ?? autoId
  const hintId = hint  ? `${id}-hint`  : undefined
  const errId  = error ? `${id}-error` : undefined
  const descBy = [hintId, errId].filter(Boolean).join(' ') || undefined

  const [focused,  setFocused]  = useState(false)
  const [draft,    setDraft]    = useState<string | null>(null)  // null = show value

  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max])

  const applyStep = useCallback((delta: number) => {
    if (disabled) return
    onChange(clamp(parseFloat((value + delta).toFixed(decimals))))
  }, [disabled, value, decimals, onChange, clamp])

  const commitDraft = () => {
    if (draft !== null) {
      const n = parseFloat(draft)
      if (!isNaN(n)) onChange(clamp(parseFloat(n.toFixed(decimals))))
    }
    setDraft(null)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const multiplier = e.shiftKey ? (bigStep ?? step * 10) / step : 1
    if (e.key === 'ArrowUp')   { e.preventDefault(); applyStep(step * multiplier)  }
    if (e.key === 'ArrowDown') { e.preventDefault(); applyStep(-step * multiplier) }
    if (e.key === 'Enter')     commitDraft()
    if (e.key === 'Escape')    setDraft(null)
  }

  const displayVal = draft !== null ? draft : value.toFixed(decimals)
  const borderCol  = error ? color.danger.default : focused ? color.primary.default : color.bg.border

  const labelStyle: CSSProperties = labelHidden
    ? { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }
    : { fontSize: font.size.sm, fontWeight: font.weight.medium, color: color.text.secondary, userSelect: 'none' }

  const stepBtnStyle = (side: 'up' | 'down'): CSSProperties => ({
    width:          26,
    height:         '100%',
    border:         'none',
    borderLeft:     side === 'up'   ? `1px solid ${color.bg.border}` : 'none',
    borderRight:    side === 'down' ? `1px solid ${color.bg.border}` : 'none',
    background:     color.bg.raised,
    color:          disabled ? color.text.muted : color.text.secondary,
    cursor:         disabled ? 'not-allowed' : 'pointer',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontSize:       14,
    transition:     transition.fast,
    flexShrink:     0,
    order:          side === 'down' ? -1 : 1,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: width ?? '100%', ...style }}>
      {label && (
        <label htmlFor={id} style={labelStyle}>
          {label}
        </label>
      )}

      <div style={{
        display:      'flex',
        alignItems:   'stretch',
        height:       34,
        borderRadius: radius.md,
        border:       `1px solid ${borderCol}`,
        background:   color.bg.surface,
        overflow:     'hidden',
        outline:      focused ? focusRing.outline : 'none',
        outlineOffset: focused ? focusRing.outlineOffset : undefined,
        transition:   transition.fast,
      }}>
        {/* Decrement */}
        <button
          type="button"
          aria-label={`Decrease ${label ?? 'value'}`}
          tabIndex={-1}
          disabled={disabled || value <= min}
          onClick={() => applyStep(-step)}
          style={stepBtnStyle('down')}
        >
          −
        </button>

        {/* Input */}
        <input
          id={id}
          role="spinbutton"
          type="text"
          inputMode="decimal"
          value={displayVal}
          aria-valuemin={min === -Infinity ? undefined : min}
          aria-valuemax={max === Infinity  ? undefined : max}
          aria-valuenow={value}
          aria-valuetext={`${displayVal}${unit ? ' ' + unit : ''}`}
          aria-describedby={descBy}
          aria-invalid={!!error}
          disabled={disabled}
          onChange={e => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); commitDraft() }}
          onKeyDown={handleKeyDown}
          style={{
            flex:       1,
            height:     '100%',
            border:     'none',
            outline:    'none',
            background: 'transparent',
            textAlign:  'center',
            fontSize:   font.size.base,
            fontFamily: '"JetBrains Mono","Fira Code",monospace',
            color:      disabled ? color.text.muted : color.text.primary,
            cursor:     disabled ? 'not-allowed' : 'text',
            minWidth:   0,
          }}
        />

        {/* Unit label */}
        {unit && (
          <span style={{
            display:    'flex',
            alignItems: 'center',
            paddingRight: 6,
            fontSize:   font.size.xs,
            color:      color.text.muted,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            {unit}
          </span>
        )}

        {/* Increment */}
        <button
          type="button"
          aria-label={`Increase ${label ?? 'value'}`}
          tabIndex={-1}
          disabled={disabled || value >= max}
          onClick={() => applyStep(step)}
          style={stepBtnStyle('up')}
        >
          +
        </button>
      </div>

      {hint && !error && (
        <span id={hintId} style={{ fontSize: font.size.xs, color: color.text.muted }}>{hint}</span>
      )}
      {error && (
        <span id={errId} role="alert" style={{ fontSize: font.size.xs, color: color.danger.default }}>
          ⚠ {error}
        </span>
      )}
    </div>
  )
}
