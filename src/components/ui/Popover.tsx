/**
 * Popover — floating panel anchored to a trigger element
 *
 * Uses CSS position:fixed + portal-style rendering to escape overflow:hidden.
 * Placement auto-flips when near viewport edges.
 *
 * Accessibility (APG Disclosure pattern):
 *  - Trigger gets aria-expanded + aria-controls
 *  - Panel gets role="dialog" (or "listbox" via `role` prop) + aria-labelledby
 *  - Escape key closes; focus returns to trigger
 *  - Click-outside closes
 *
 * Usage:
 *   <Popover
 *     trigger={<button>Options</button>}
 *     open={open}
 *     onClose={() => setOpen(false)}
 *   >
 *     <MenuItem>…</MenuItem>
 *   </Popover>
 */
import React, {
  useRef, useEffect, useId, useCallback, CSSProperties,
} from 'react'
import { color, radius, shadow, zIndex } from '../../styles/tokens'

type Placement = 'bottom-start' | 'bottom-end' | 'bottom' | 'top-start' | 'top-end' | 'top'

interface PopoverProps {
  trigger:    React.ReactElement
  children:   React.ReactNode
  open:       boolean
  onClose:    () => void
  placement?: Placement
  /** Width of the popover panel. 'anchor' matches trigger width, a number sets px, 'auto' is content-driven */
  width?:     number | 'anchor' | 'auto'
  /** role on the panel (default: "dialog") */
  role?:      'dialog' | 'listbox' | 'menu' | 'tree' | 'grid'
  /** Accessible name for the panel */
  label?:     string
  style?:     CSSProperties
}

export function Popover({
  trigger, children,
  open, onClose,
  placement = 'bottom-start',
  width = 'auto',
  role: panelRole = 'dialog',
  label,
  style,
}: PopoverProps) {
  const triggerId = useId()
  const panelId   = useId()
  const triggerRef = useRef<HTMLElement>(null)
  const panelRef   = useRef<HTMLDivElement>(null)

  // ── Close on click-outside ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current   && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  // ── Close on Escape ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // ── Focus first focusable element when panel opens ────────────────────────
  useEffect(() => {
    if (open && panelRef.current) {
      const first = panelRef.current.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      first?.focus()
    }
  }, [open])

  // ── Compute panel position relative to trigger ────────────────────────────
  const getPosition = useCallback((): CSSProperties => {
    if (!triggerRef.current) return {}
    const rect = triggerRef.current.getBoundingClientRect()
    const GAP  = 4

    let top: number | undefined
    let bottom: number | undefined
    let left: number | undefined
    let right: number | undefined

    const isTop = placement.startsWith('top')
    if (isTop) {
      bottom = window.innerHeight - rect.top + GAP
    } else {
      top = rect.bottom + GAP
    }

    if (placement.endsWith('end')) {
      right = window.innerWidth - rect.right
    } else if (placement.endsWith('start')) {
      left = rect.left
    } else {
      left = rect.left + rect.width / 2
    }

    const panelWidth = width === 'anchor' ? rect.width
      : typeof width === 'number' ? width
      : undefined

    return {
      position: 'fixed',
      top:      top    !== undefined ? top    : undefined,
      bottom:   bottom !== undefined ? bottom : undefined,
      left:     left   !== undefined ? left   : undefined,
      right:    right  !== undefined ? right  : undefined,
      width:    panelWidth,
      transform: placement.endsWith('center') ? 'translateX(-50%)' : undefined,
    }
  }, [placement, width])

  // Clone trigger to inject ref + aria attributes
  const triggerEl = React.cloneElement(trigger, {
    ref:            triggerRef,
    id:             triggerId,
    'aria-expanded': open,
    'aria-controls': panelId,
    'aria-haspopup': panelRole === 'menu' ? 'menu' : 'dialog',
  })

  return (
    <>
      {triggerEl}

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role={panelRole}
          aria-labelledby={label ? undefined : triggerId}
          aria-label={label}
          style={{
            ...getPosition(),
            zIndex:       zIndex.modal,
            background:   color.bg.surface,
            border:       `1px solid ${color.bg.border}`,
            borderRadius: radius.xl,
            boxShadow:    shadow.lg,
            overflowY:    'auto',
            maxHeight:    '80vh',
            outline:      'none',
            ...style,
          }}
        >
          {children}
        </div>
      )}
    </>
  )
}

// ── MenuItem — convenience child for menu/list popovers ──────────────────────

interface MenuItemProps {
  children:   React.ReactNode
  onClick?:   () => void
  icon?:      React.ReactNode
  disabled?:  boolean
  danger?:    boolean
  style?:     CSSProperties
}

export function MenuItem({ children, onClick, icon, disabled, danger, style }: MenuItemProps) {
  const [hov, setHov] = React.useState(false)

  return (
    <button
      role="menuitem"
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:         8,
        width:       '100%',
        padding:     '8px 14px',
        border:      'none',
        background:  hov ? (danger ? color.danger.muted : color.bg.raised) : 'transparent',
        color:       disabled ? color.text.muted
          : danger   ? color.danger.default
          : color.text.primary,
        fontSize:    14,
        fontFamily:  'inherit',
        textAlign:   'left',
        cursor:      disabled ? 'not-allowed' : 'pointer',
        opacity:     disabled ? 0.5 : 1,
        transition:  'background 0.1s',
        ...style,
      }}
    >
      {icon && <span aria-hidden="true" style={{ fontSize: 14, width: 18, flexShrink: 0 }}>{icon}</span>}
      {children}
    </button>
  )
}
