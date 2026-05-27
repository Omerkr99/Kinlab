/**
 * Divider — visual section separator
 *
 * Accessibility: role="separator" with aria-orientation
 * Can render with optional text label in the middle.
 */
import { CSSProperties } from 'react'
import { color, font } from '../../styles/tokens'

interface DividerProps {
  /** Label shown in the middle of the line */
  label?:       string
  orientation?: 'horizontal' | 'vertical'
  /** Space above/below (or left/right for vertical). px value. */
  spacing?:     number
  style?:       CSSProperties
}

export function Divider({
  label, orientation = 'horizontal', spacing = 8, style,
}: DividerProps) {
  const isH = orientation === 'horizontal'

  if (!isH) {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        style={{
          width:       1,
          alignSelf:   'stretch',
          background:  color.bg.border,
          margin:      `0 ${spacing}px`,
          flexShrink:  0,
          ...style,
        }}
      />
    )
  }

  if (label) {
    return (
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={label}
        style={{
          display:     'flex',
          alignItems:  'center',
          gap:         10,
          margin:      `${spacing}px 0`,
          ...style,
        }}
      >
        <span style={{ flex: 1, height: 1, background: color.bg.border }} />
        <span style={{ fontSize: font.size.xs, color: color.text.muted, whiteSpace: 'nowrap', userSelect: 'none' }}>
          {label}
        </span>
        <span style={{ flex: 1, height: 1, background: color.bg.border }} />
      </div>
    )
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      style={{
        height:     1,
        background: color.bg.border,
        margin:     `${spacing}px 0`,
        ...style,
      }}
    />
  )
}
