/**
 * TabNav — accessible tab navigation
 *
 * Implements ARIA Authoring Practices Guide (APG) tabs pattern:
 *  https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
 *
 * Accessibility:
 *  - role="tablist" on the container
 *  - role="tab" + aria-selected + aria-controls on each tab button
 *  - role="tabpanel" + aria-labelledby on each panel (consumer is responsible for role="tabpanel")
 *  - Keyboard: ArrowLeft / ArrowRight to move focus, Home / End to jump,
 *              Enter / Space to activate (automatic activation mode)
 */
import React, { useRef, KeyboardEvent, CSSProperties } from 'react'
import { color, font, radius, transition, focusRing } from '../../styles/tokens'

export interface TabItem {
  id:      string
  label:   string
  icon?:   string   // emoji or short text prefix
  badge?:  string   // small count/status bubble
  disabled?: boolean
}

interface TabNavProps {
  tabs:       TabItem[]
  activeTab:  string
  onChange:   (id: string) => void
  /** ID prefix for aria-controls (panel IDs will be `${panelIdPrefix}-${tab.id}`) */
  panelIdPrefix?: string
  /** Orientation */
  orientation?: 'horizontal' | 'vertical'
  /** Visual density */
  size?: 'sm' | 'md' | 'lg'
  style?: CSSProperties
}

const sizeTokens = {
  sm: { px: 10, py: 5,  fontSize: font.size.sm,   gap: 4 },
  md: { px: 14, py: 8,  fontSize: font.size.base,  gap: 6 },
  lg: { px: 18, py: 10, fontSize: font.size.md,    gap: 8 },
} as const

export function TabNav({
  tabs, activeTab, onChange,
  panelIdPrefix = 'tabpanel',
  orientation   = 'horizontal',
  size          = 'md',
  style,
}: TabNavProps) {
  const tabRefs  = useRef<Record<string, HTMLButtonElement | null>>({})
  const s        = sizeTokens[size]
  const isHoriz  = orientation === 'horizontal'

  // ── Keyboard navigation ──────────────────────────────────────────────────

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const enabledTabs = tabs.filter(t => !t.disabled)
    const curIdx      = enabledTabs.findIndex(t => t.id === tabs[index].id)
    if (curIdx === -1) return

    let nextIdx: number | null = null

    if ((isHoriz && e.key === 'ArrowRight') || (!isHoriz && e.key === 'ArrowDown')) {
      nextIdx = (curIdx + 1) % enabledTabs.length
    } else if ((isHoriz && e.key === 'ArrowLeft') || (!isHoriz && e.key === 'ArrowUp')) {
      nextIdx = (curIdx - 1 + enabledTabs.length) % enabledTabs.length
    } else if (e.key === 'Home') {
      nextIdx = 0
    } else if (e.key === 'End') {
      nextIdx = enabledTabs.length - 1
    }

    if (nextIdx !== null) {
      e.preventDefault()
      const target = enabledTabs[nextIdx]
      tabRefs.current[target.id]?.focus()
      onChange(target.id)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const listStyle: CSSProperties = {
    display:        'flex',
    flexDirection:  isHoriz ? 'row' : 'column',
    gap:            isHoriz ? 2 : 2,
    padding:        4,
    background:     color.bg.surface,
    borderRadius:   radius.xl,
    border:         `1px solid ${color.bg.border}`,
    ...style,
  }

  return (
    <div
      role="tablist"
      aria-orientation={orientation}
      style={listStyle}
    >
      {tabs.map((tab, index) => {
        const isActive   = tab.id === activeTab
        const controlsId = `${panelIdPrefix}-${tab.id}`

        const tabStyle: CSSProperties = {
          display:        'inline-flex',
          alignItems:     'center',
          gap:            s.gap,
          paddingLeft:    s.px,
          paddingRight:   s.px,
          paddingTop:     s.py,
          paddingBottom:  s.py,
          fontSize:       s.fontSize,
          fontWeight:     isActive ? font.weight.semibold : font.weight.medium,
          fontFamily:     'inherit',
          border:         'none',
          borderRadius:   radius.lg,
          background:     isActive ? color.primary.muted : color.transparent,
          color:          isActive ? color.primary.text   : color.text.secondary,
          cursor:         tab.disabled ? 'not-allowed' : 'pointer',
          opacity:        tab.disabled ? 0.4 : 1,
          transition:     transition.fast,
          whiteSpace:     'nowrap',
          position:       'relative',
          // Bottom border indicator for horizontal, left border for vertical
          boxShadow:      isActive && isHoriz
            ? `inset 0 -2px 0 ${color.primary.default}`
            : isActive && !isHoriz
              ? `inset 2px 0 0 ${color.primary.default}`
              : 'none',
        }

        return (
          <button
            key={tab.id}
            ref={el => { tabRefs.current[tab.id] = el }}
            role="tab"
            aria-selected={isActive}
            aria-controls={controlsId}
            aria-disabled={tab.disabled}
            tabIndex={isActive ? 0 : -1}   // roving tabindex pattern
            disabled={tab.disabled}
            id={`tab-${tab.id}`}
            onClick={() => { if (!tab.disabled) onChange(tab.id) }}
            onKeyDown={e => handleKeyDown(e, index)}
            style={tabStyle}
            onFocus={e  => { if (!isActive) e.currentTarget.style.outline = focusRing.outline; e.currentTarget.style.outlineOffset = focusRing.outlineOffset }}
            onBlur={e   => { e.currentTarget.style.outline = 'none' }}
          >
            {tab.icon  && <span aria-hidden="true">{tab.icon}</span>}
            {tab.label}
            {tab.badge && (
              <span
                aria-label={`${tab.badge} items`}
                style={{
                  background:   isActive ? color.primary.default : color.bg.border,
                  color:        isActive ? color.white           : color.text.secondary,
                  fontSize:     font.size.xs - 1,
                  fontWeight:   font.weight.bold,
                  padding:      '1px 5px',
                  borderRadius: radius.full,
                  lineHeight:   1.4,
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── TabPanel helper ──────────────────────────────────────────────────────────

interface TabPanelProps {
  id:          string
  labelledBy:  string
  active:      boolean
  children:    React.ReactNode
  style?:      CSSProperties
  /** If true, unmounts the panel when inactive instead of hiding */
  unmountOnHide?: boolean
}

export function TabPanel({
  id, labelledBy, active, children, style, unmountOnHide = false,
}: TabPanelProps) {
  if (unmountOnHide && !active) return null

  return (
    <div
      id={id}
      role="tabpanel"
      aria-labelledby={labelledBy}
      hidden={!active}
      tabIndex={0}
      style={{
        outline: 'none',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
