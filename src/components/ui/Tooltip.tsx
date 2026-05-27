/**
 * Tooltip — lightweight hover/focus tooltip
 *
 * Accessibility:
 *  - Wraps the trigger in a <span> with aria-describedby pointing to a hidden tooltip element
 *  - Tooltip element uses role="tooltip"
 *  - Shown on hover AND focus so keyboard users get it too
 *  - Delays 350 ms before appearing to avoid flicker on fast mouse movements
 *
 * Usage:
 *   <Tooltip content="Delete object">
 *     <button>🗑</button>
 *   </Tooltip>
 */
import React, { useState, useRef, useId, CSSProperties } from 'react'
import { color, font, radius, zIndex } from '../../styles/tokens'

type Placement = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  content:    React.ReactNode
  children:   React.ReactElement
  placement?: Placement
  delay?:     number   // ms before showing (default 350)
  disabled?:  boolean
}

const OFFSET = 8  // px gap between trigger and tooltip

export function Tooltip({
  content, children,
  placement = 'top',
  delay = 350,
  disabled = false,
}: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipId = useId()

  const show = () => {
    if (disabled) return
    timerRef.current = setTimeout(() => setVisible(true), delay)
  }
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
  }

  // ── Placement → CSS offset ────────────────────────────────────────────────
  const placementStyle: Record<Placement, CSSProperties> = {
    top:    { bottom: `calc(100% + ${OFFSET}px)`, left: '50%', transform: 'translateX(-50%)' },
    bottom: { top:    `calc(100% + ${OFFSET}px)`, left: '50%', transform: 'translateX(-50%)' },
    left:   { right:  `calc(100% + ${OFFSET}px)`, top:  '50%', transform: 'translateY(-50%)' },
    right:  { left:   `calc(100% + ${OFFSET}px)`, top:  '50%', transform: 'translateY(-50%)' },
  }

  // Inject aria-describedby into the child trigger
  const trigger = React.cloneElement(children, {
    'aria-describedby': visible ? tooltipId : undefined,
    onMouseEnter:       (e: React.MouseEvent) => { show(); children.props.onMouseEnter?.(e) },
    onMouseLeave:       (e: React.MouseEvent) => { hide(); children.props.onMouseLeave?.(e) },
    onFocus:            (e: React.FocusEvent) => { show(); children.props.onFocus?.(e)      },
    onBlur:             (e: React.FocusEvent) => { hide(); children.props.onBlur?.(e)       },
  })

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      {trigger}
      <span
        id={tooltipId}
        role="tooltip"
        aria-hidden={!visible}
        style={{
          position:     'absolute',
          ...placementStyle[placement],
          zIndex:       zIndex.toast,
          pointerEvents: 'none',
          // Visibility
          opacity:      visible ? 1 : 0,
          transition:   'opacity 0.12s ease',
          // Appearance
          background:   color.bg.base,
          color:        color.text.primary,
          border:       `1px solid ${color.bg.border}`,
          borderRadius: radius.md,
          padding:      '5px 9px',
          fontSize:     font.size.sm,
          fontWeight:   font.weight.normal,
          whiteSpace:   'nowrap',
          boxShadow:    '0 4px 8px rgba(0,0,0,0.35)',
          lineHeight:   1.4,
        }}
      >
        {content}
      </span>
    </span>
  )
}
