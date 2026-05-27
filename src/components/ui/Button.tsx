/**
 * Button — accessible base button component
 *
 * Handles:
 *  - Keyboard: Enter / Space (native <button>)
 *  - ARIA: aria-label, aria-pressed, aria-disabled, aria-busy
 *  - Focus: :focus-visible ring via inline styles (no CSS module needed)
 *  - Variants: primary | secondary | ghost | danger | success
 *  - Sizes: sm | md | lg
 */
import React, { useState, CSSProperties } from 'react'
import { color, font, radius, transition, focusRing, componentSize } from '../../styles/tokens'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
export type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?:    ButtonVariant
  size?:       ButtonSize
  /** Reflects a toggle state — sets aria-pressed */
  pressed?:    boolean
  /** Shows a spinner + sets aria-busy */
  loading?:    boolean
  /** Icon placed before children */
  iconBefore?: React.ReactNode
  /** Override any token-based style */
  style?:      CSSProperties
  children:    React.ReactNode
}

// ── Token-based variant palette ──────────────────────────────────────────────

const variantStyles: Record<ButtonVariant, {
  bg: string; bgHover: string; bgActive: string
  text: string; border: string; borderHover: string
}> = {
  primary: {
    bg:          color.primary.default,
    bgHover:     color.primary.light,
    bgActive:    color.primary.dark,
    text:        color.white,
    border:      color.primary.dark,
    borderHover: color.primary.light,
  },
  secondary: {
    bg:          color.bg.raised,
    bgHover:     color.bg.overlay,
    bgActive:    color.bg.border,
    text:        color.text.primary,
    border:      color.bg.border,
    borderHover: color.primary.default,
  },
  ghost: {
    bg:          color.transparent,
    bgHover:     color.bg.overlay,
    bgActive:    color.bg.raised,
    text:        color.text.secondary,
    border:      color.transparent,
    borderHover: color.bg.border,
  },
  danger: {
    bg:          color.danger.muted,
    bgHover:     color.danger.default,
    bgActive:    '#b91c1c',
    text:        color.danger.text,
    border:      color.danger.default,
    borderHover: color.danger.default,
  },
  success: {
    bg:          color.success.muted,
    bgHover:     color.success.default,
    bgActive:    '#15803d',
    text:        color.success.text,
    border:      color.success.default,
    borderHover: color.success.default,
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Button({
  variant  = 'secondary',
  size     = 'md',
  pressed,
  loading  = false,
  iconBefore,
  style,
  children,
  disabled,
  onClick,
  ...rest
}: ButtonProps) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  const isDisabled = disabled || loading
  const v          = variantStyles[variant]
  const s          = componentSize.button[size]

  const baseStyle: CSSProperties = {
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
    height:         s.height,
    paddingLeft:    s.px,
    paddingRight:   s.px,
    fontSize:       s.fontSize,
    fontWeight:     font.weight.semibold,
    fontFamily:     'inherit',
    borderRadius:   radius.md,
    border:         `1px solid ${hovered ? v.borderHover : v.border}`,
    background:     hovered ? v.bgHover : v.bg,
    color:          isDisabled ? color.text.muted : v.text,
    cursor:         isDisabled ? 'not-allowed' : 'pointer',
    opacity:        isDisabled ? 0.55 : 1,
    transition:     transition.fast,
    userSelect:     'none',
    whiteSpace:     'nowrap',
    // Focus ring — shown only on keyboard focus (focus-visible semantics)
    outline:        focused ? focusRing.outline : 'none',
    outlineOffset:  focused ? focusRing.outlineOffset : undefined,
    // Pressed (toggle) visual
    boxShadow:      pressed
      ? `inset 0 1px 3px rgba(0,0,0,0.3), 0 0 0 2px ${color.primary.default}`
      : 'none',
    ...style,
  }

  return (
    <button
      {...rest}
      disabled={isDisabled}
      aria-pressed={pressed}
      aria-busy={loading}
      aria-disabled={isDisabled}
      style={baseStyle}
      onClick={!isDisabled ? onClick : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={()  => setFocused(false)}
    >
      {loading && <Spinner size={size} />}
      {!loading && iconBefore}
      {children}
    </button>
  )
}

// ── Tiny spinner ──────────────────────────────────────────────────────────────

function Spinner({ size }: { size: ButtonSize }) {
  const dim = size === 'sm' ? 10 : size === 'md' ? 13 : 16
  return (
    <span
      aria-hidden="true"
      style={{
        display:     'inline-block',
        width:       dim,
        height:      dim,
        borderRadius: radius.full,
        border:      `2px solid currentColor`,
        borderTopColor: 'transparent',
        animation:   'spin 0.6s linear infinite',
      }}
    />
  )
}
