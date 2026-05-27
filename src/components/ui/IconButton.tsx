/**
 * IconButton — compact square button for icon-only actions
 *
 * Always paired with a Tooltip for keyboard/screen-reader users.
 * `aria-label` is REQUIRED.
 *
 * Accessibility:
 *  - aria-label (required — no visible text)
 *  - aria-pressed for toggle mode
 *  - Focus ring on keyboard focus
 *  - Minimum 32×32 click target (configurable)
 */
import { useState, CSSProperties } from 'react'
import { color, radius, transition, focusRing } from '../../styles/tokens'

export type IconButtonVariant = 'ghost' | 'soft' | 'outlined' | 'danger'
export type IconButtonSize    = 'xs' | 'sm' | 'md' | 'lg'

interface IconButtonProps {
  /** Screen-reader label — REQUIRED */
  'aria-label':  string
  icon:          React.ReactNode
  variant?:      IconButtonVariant
  size?:         IconButtonSize
  pressed?:      boolean
  disabled?:     boolean
  onClick?:      (e: React.MouseEvent<HTMLButtonElement>) => void
  style?:        CSSProperties
  type?:         'button' | 'submit' | 'reset'
}

const sizeMap: Record<IconButtonSize, { dim: number; fontSize: number }> = {
  xs: { dim: 24, fontSize: 12 },
  sm: { dim: 28, fontSize: 14 },
  md: { dim: 34, fontSize: 16 },
  lg: { dim: 40, fontSize: 18 },
}

const variantPalette: Record<IconButtonVariant, {
  bg: string; bgHover: string; border: string; borderHover: string; textColor: string
}> = {
  ghost: {
    bg:          'transparent',
    bgHover:     color.bg.overlay,
    border:      'transparent',
    borderHover: color.bg.border,
    textColor:   color.text.secondary,
  },
  soft: {
    bg:          color.bg.raised,
    bgHover:     color.bg.overlay,
    border:      color.bg.border,
    borderHover: color.primary.default,
    textColor:   color.text.primary,
  },
  outlined: {
    bg:          'transparent',
    bgHover:     color.primary.muted,
    border:      color.bg.border,
    borderHover: color.primary.default,
    textColor:   color.text.secondary,
  },
  danger: {
    bg:          'transparent',
    bgHover:     color.danger.muted,
    border:      'transparent',
    borderHover: color.danger.default,
    textColor:   color.danger.default,
  },
}

export function IconButton({
  'aria-label': ariaLabel,
  icon, variant = 'ghost', size = 'md',
  pressed, disabled = false,
  onClick, style, type = 'button',
}: IconButtonProps) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  const { dim, fontSize } = sizeMap[size]
  const v = variantPalette[variant]

  const btnStyle: CSSProperties = {
    width:          dim,
    height:         dim,
    minWidth:       dim,
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    border:         `1px solid ${hovered ? v.borderHover : v.border}`,
    borderRadius:   radius.md,
    background:     pressed
      ? color.primary.muted
      : hovered ? v.bgHover : v.bg,
    color:          disabled ? color.text.muted : v.textColor,
    fontSize,
    cursor:         disabled ? 'not-allowed' : 'pointer',
    opacity:        disabled ? 0.5 : 1,
    transition:     transition.fast,
    outline:        focused ? focusRing.outline : 'none',
    outlineOffset:  focused ? focusRing.outlineOffset : undefined,
    boxShadow:      pressed ? `inset 0 1px 3px rgba(0,0,0,0.25)` : 'none',
    flexShrink:     0,
    padding:        0,
    ...style,
  }

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={!disabled ? onClick : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={btnStyle}
    >
      {icon}
    </button>
  )
}
