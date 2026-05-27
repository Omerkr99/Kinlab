/**
 * Badge — compact status / label chip
 *
 * Accessibility:
 *  - role="status" with aria-live when live=true (for async state changes)
 *  - role="img" + aria-label when icon-only
 *  - Dot animation: aria-hidden so it doesn't announce as text
 */
import { CSSProperties } from 'react'
import { color, font, radius } from '../../styles/tokens'

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'accent'

interface BadgeProps {
  label:     string
  variant?:  BadgeVariant
  /** Show animated pulse dot before the label */
  dot?:      boolean
  /** Use aria-live="polite" to announce label changes */
  live?:     boolean
  style?:    CSSProperties
}

const palette: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  default: { bg: color.bg.raised,    text: color.text.secondary, dot: color.text.muted     },
  primary: { bg: color.primary.muted, text: color.primary.text,  dot: color.primary.default },
  success: { bg: color.success.muted, text: color.success.text,  dot: color.success.default },
  warning: { bg: color.warning.muted, text: color.warning.text,  dot: color.warning.default },
  danger:  { bg: color.danger.muted,  text: color.danger.text,   dot: color.danger.default  },
  accent:  { bg: color.accent.muted,  text: color.accent.text,   dot: color.accent.default  },
}

export function Badge({ label, variant = 'default', dot = false, live = false, style }: BadgeProps) {
  const p = palette[variant]

  return (
    <span
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
      aria-atomic={live ? 'true' : undefined}
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          5,
        padding:      '2px 8px',
        borderRadius: radius.full,
        fontSize:     font.size.xs,
        fontWeight:   font.weight.semibold,
        letterSpacing: 0.5,
        textTransform: 'uppercase' as const,
        background:   p.bg,
        color:        p.text,
        border:       `1px solid ${p.dot}30`,
        whiteSpace:   'nowrap',
        ...style,
      }}
    >
      {dot && (
        <span
          aria-hidden="true"
          style={{
            width:        7,
            height:       7,
            borderRadius: radius.full,
            background:   p.dot,
            display:      'inline-block',
            animation:    'pulse 1.2s ease-in-out infinite',
            flexShrink:   0,
          }}
        />
      )}
      {label}
    </span>
  )
}
