/**
 * Input — accessible text / email / search / password input
 *
 * Accessibility:
 *  - <label htmlFor={id}> always linked
 *  - aria-required, aria-invalid, aria-describedby (hint + error)
 *  - Focus ring via onFocus/onBlur state (no CSS module needed)
 *  - Error icon + helper text
 *
 * Variants: default | filled
 * Sizes:    sm | md | lg
 */
import React, { useState, useId, CSSProperties, InputHTMLAttributes } from 'react'
import { color, font, radius, transition, focusRing } from '../../styles/tokens'

export type InputSize    = 'sm' | 'md' | 'lg'
export type InputVariant = 'default' | 'filled'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'style'> {
  label?:       string
  /** Visually hides the label but keeps it accessible */
  labelHidden?: boolean
  hint?:        string
  error?:       string
  size?:        InputSize
  variant?:     InputVariant
  /** Icon before the input value */
  iconBefore?:  React.ReactNode
  /** Icon/element after the input value (e.g. units label) */
  iconAfter?:   React.ReactNode
  style?:       CSSProperties
  /** Width of the whole field wrapper */
  width?:       number | string
}

const sizeH: Record<InputSize, number> = { sm: 28, md: 34, lg: 40 }
const sizeFs: Record<InputSize, number> = {
  sm: font.size.sm,
  md: font.size.base,
  lg: font.size.md,
}
const sizePx: Record<InputSize, number> = { sm: 8, md: 10, lg: 14 }

export function Input({
  label, labelHidden = false,
  hint, error,
  size = 'md', variant = 'default',
  iconBefore, iconAfter,
  style, width,
  id: idProp,
  ...rest
}: InputProps) {
  const autoId = useId()
  const id     = idProp ?? autoId
  const hintId = hint  ? `${id}-hint`  : undefined
  const errId  = error ? `${id}-error` : undefined
  const descBy = [hintId, errId].filter(Boolean).join(' ') || undefined

  const [focused, setFocused] = useState(false)

  const h  = sizeH[size]
  const fs = sizeFs[size]
  const px = sizePx[size]

  const wrapperStyle: CSSProperties = {
    display:       'flex',
    flexDirection: 'column',
    gap:           4,
    width:         width ?? '100%',
    ...style,
  }

  const labelStyle: CSSProperties = labelHidden
    ? { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }
    : { fontSize: font.size.sm, fontWeight: font.weight.medium, color: color.text.secondary, userSelect: 'none' }

  const fieldBg    = variant === 'filled' ? color.bg.raised : color.bg.surface
  const borderCol  = error ? color.danger.default
    : focused       ? color.primary.default
    : color.bg.border

  const fieldStyle: CSSProperties = {
    display:      'flex',
    alignItems:   'center',
    height:       h,
    borderRadius: radius.md,
    border:       `1px solid ${borderCol}`,
    background:   fieldBg,
    transition:   transition.fast,
    outline:      focused ? focusRing.outline : 'none',
    outlineOffset: focused ? focusRing.outlineOffset : undefined,
    boxShadow:    error && !focused ? `0 0 0 3px ${color.danger.muted}` : 'none',
    overflow:     'hidden',
  }

  const inputStyle: CSSProperties = {
    flex:       1,
    height:     '100%',
    border:     'none',
    outline:    'none',
    background: 'transparent',
    paddingLeft:  iconBefore ? 4 : px,
    paddingRight: iconAfter  ? 4 : px,
    fontSize:   fs,
    fontFamily: 'inherit',
    color:      rest.disabled ? color.text.muted : color.text.primary,
    cursor:     rest.disabled ? 'not-allowed' : 'text',
    minWidth:   0,
  }

  const iconStyle: CSSProperties = {
    display:    'flex',
    alignItems: 'center',
    padding:    `0 ${px}px`,
    color:      error ? color.danger.default : color.text.muted,
    flexShrink: 0,
    fontSize:   fs,
  }

  return (
    <div style={wrapperStyle}>
      {label && (
        <label htmlFor={id} style={labelStyle}>
          {label}
          {rest.required && <span aria-hidden="true" style={{ color: color.danger.default, marginLeft: 2 }}>*</span>}
        </label>
      )}

      <div style={fieldStyle}>
        {iconBefore && <span aria-hidden="true" style={iconStyle}>{iconBefore}</span>}
        <input
          id={id}
          aria-required={rest.required}
          aria-invalid={!!error}
          aria-describedby={descBy}
          onFocus={e => { setFocused(true); rest.onFocus?.(e) }}
          onBlur={e  => { setFocused(false); rest.onBlur?.(e) }}
          style={inputStyle}
          {...rest}
        />
        {iconAfter && <span aria-hidden="true" style={iconStyle}>{iconAfter}</span>}
      </div>

      {hint && !error && (
        <span id={hintId} style={{ fontSize: font.size.xs, color: color.text.muted }}>
          {hint}
        </span>
      )}
      {error && (
        <span id={errId} role="alert" style={{ fontSize: font.size.xs, color: color.danger.default }}>
          ⚠ {error}
        </span>
      )}
    </div>
  )
}
