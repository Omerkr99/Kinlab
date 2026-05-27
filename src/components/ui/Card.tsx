/**
 * Card — surface container
 *
 * Accessibility:
 *  - role="region" with aria-label when title is provided
 *  - aria-expanded / aria-controls when collapsible
 *  - Collapse toggle is a <button> with proper labeling
 */
import React, { useState, useId, CSSProperties } from 'react'
import { color, font, radius, shadow, space, transition } from '../../styles/tokens'

interface CardProps {
  title?:           string
  /** Caption shown below the title */
  subtitle?:        string
  /** Header right-side slot (e.g., a badge or button group) */
  headerAction?:    React.ReactNode
  children:         React.ReactNode
  collapsible?:     boolean
  defaultExpanded?: boolean
  /** Elevates the card shadow */
  elevated?:        boolean
  style?:           CSSProperties
  bodyStyle?:       CSSProperties
}

export function Card({
  title, subtitle, headerAction,
  children, collapsible = false,
  defaultExpanded = true,
  elevated = false,
  style, bodyStyle,
}: CardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const bodyId = useId()

  const cardStyle: CSSProperties = {
    background:   color.bg.surface,
    border:       `1px solid ${color.bg.border}`,
    borderRadius: radius.xl,
    boxShadow:    elevated ? shadow.lg : shadow.sm,
    overflow:     'hidden',
    ...style,
  }

  const headerStyle: CSSProperties = {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            space[2],
    padding:        `${space[3]}px ${space[4]}px`,
    borderBottom:   expanded && (children !== null && children !== undefined)
      ? `1px solid ${color.bg.border}`
      : 'none',
  }

  const titleGroupStyle: CSSProperties = {
    display:       'flex',
    flexDirection: 'column',
    gap:           2,
    flex:          1,
    minWidth:      0,
  }

  const bodyPadding: CSSProperties = {
    padding: `${space[4]}px`,
    ...bodyStyle,
  }

  const hasHeader = title || headerAction

  return (
    <section
      role="region"
      aria-label={title}
      style={cardStyle}
    >
      {/* Header */}
      {hasHeader && (
        <div style={headerStyle}>
          <div style={titleGroupStyle}>
            {title && (
              <span style={{
                fontSize:   font.size.base,
                fontWeight: font.weight.semibold,
                color:      color.text.primary,
                letterSpacing: 0.2,
              }}>
                {title}
              </span>
            )}
            {subtitle && (
              <span style={{
                fontSize: font.size.xs,
                color:    color.text.muted,
              }}>
                {subtitle}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
            {headerAction}

            {/* Collapse toggle */}
            {collapsible && (
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={bodyId}
                aria-label={expanded ? `Collapse ${title ?? 'section'}` : `Expand ${title ?? 'section'}`}
                onClick={() => setExpanded(v => !v)}
                style={{
                  width:        24,
                  height:       24,
                  border:       'none',
                  borderRadius: radius.sm,
                  background:   color.transparent,
                  color:        color.text.muted,
                  cursor:       'pointer',
                  fontSize:     font.size.sm,
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'center',
                  transition:   transition.fast,
                  transform:    expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                }}
              >
                ▾
              </button>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      {(!collapsible || expanded) && (
        <div id={bodyId} style={bodyPadding}>
          {children}
        </div>
      )}
    </section>
  )
}
