/**
 * ToastContext — application-wide toast notification queue
 *
 * Features:
 *  - Max 3 toasts visible simultaneously (oldest removed when 4th arrives)
 *  - Auto-dismiss after 3 s (configurable per toast)
 *  - 4 variants: info | success | warning | error
 *  - Toast region: role="region" aria-label="Notifications"
 *  - Individual toasts: role="alert" aria-live="assertive"
 *  - Manual dismiss button on each toast
 *  - Pause auto-dismiss on hover
 *
 * Usage:
 *   // Wrap the app:
 *   <ToastProvider>…</ToastProvider>
 *
 *   // Trigger a toast anywhere:
 *   const { toast } = useToast()
 *   toast.info('Simulation reset')
 *   toast.success('Recording saved', { duration: 5000 })
 *   toast.error('Engine error', { message: err.message })
 */
import React, {
  createContext, useContext, useState, useCallback,
  useEffect, useRef,
} from 'react'
import { font, radius, zIndex, shadow } from '../styles/tokens'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface ToastItem {
  id:        string
  variant:   ToastVariant
  title:     string
  message?:  string
  duration:  number   // ms — 0 = persistent
}

interface ToastOptions {
  message?:  string
  duration?: number
}

interface ToastAPI {
  info:    (title: string, opts?: ToastOptions) => void
  success: (title: string, opts?: ToastOptions) => void
  warning: (title: string, opts?: ToastOptions) => void
  error:   (title: string, opts?: ToastOptions) => void
  dismiss: (id: string) => void
}

interface ToastContextValue {
  toasts: ToastItem[]
  toast:  ToastAPI
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

const MAX_TOASTS   = 3
const DEFAULT_DURATION = 3000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const push = useCallback((variant: ToastVariant, title: string, opts?: ToastOptions) => {
    const id: string = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setToasts(prev => {
      const next = [...prev, { id, variant, title, message: opts?.message, duration: opts?.duration ?? DEFAULT_DURATION }]
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next
    })
  }, [])

  const toast: ToastAPI = {
    info:    (t, o) => push('info',    t, o),
    success: (t, o) => push('success', t, o),
    warning: (t, o) => push('warning', t, o),
    error:   (t, o) => push('error',   t, o),
    dismiss,
  }

  return (
    <ToastContext.Provider value={{ toasts, toast }}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

// ── Toast Region (rendered in provider) ──────────────────────────────────────

const VARIANT_CONFIG: Record<ToastVariant, { icon: string; bg: string; border: string; text: string }> = {
  info:    { icon: 'ℹ',  bg: '#1E3A5F', border: '#2563EB', text: '#93C5FD' },
  success: { icon: '✓',  bg: '#052e16', border: '#16A34A', text: '#86EFAC' },
  warning: { icon: '⚠',  bg: '#2d1d03', border: '#EAB308', text: '#FDE68A' },
  error:   { icon: '✗',  bg: '#2d0a0a', border: '#DC2626', text: '#FCA5A5' },
}

function ToastRegion({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      aria-atomic="false"
      style={{
        position:      'fixed',
        bottom:        40,
        right:         20,
        zIndex:        zIndex.toast,
        display:       'flex',
        flexDirection: 'column',
        gap:           8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false)
  const [paused,  setPaused]  = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cfg = VARIANT_CONFIG[toast.variant]

  const doClose = useCallback(() => {
    setExiting(true)
    setTimeout(() => onDismiss(toast.id), 200)
  }, [toast.id, onDismiss])

  // Auto-dismiss timer — pauses on hover
  useEffect(() => {
    if (toast.duration === 0 || paused) return
    timerRef.current = setTimeout(doClose, toast.duration)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [toast.duration, paused, doClose])

  return (
    <div
      role="alert"
      aria-live="assertive"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        display:      'flex',
        alignItems:   'flex-start',
        gap:          10,
        padding:      '12px 14px',
        borderRadius: radius.xl,
        border:       `1px solid ${cfg.border}`,
        background:   cfg.bg,
        boxShadow:    shadow.lg,
        minWidth:     280,
        maxWidth:     380,
        pointerEvents: 'all',
        opacity:      exiting ? 0 : 1,
        transform:    exiting ? 'translateX(20px)' : 'translateX(0)',
        transition:   'opacity 0.2s, transform 0.2s',
        animation:    !exiting ? 'toastIn 0.18s ease' : undefined,
      }}
    >
      {/* Icon */}
      <span
        aria-hidden="true"
        style={{
          fontSize:   16,
          color:      cfg.text,
          lineHeight: 1.4,
          flexShrink: 0,
          fontWeight: font.weight.bold,
        }}
      >
        {cfg.icon}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, color: cfg.text, lineHeight: 1.3 }}>
          {toast.title}
        </div>
        {toast.message && (
          <div style={{ fontSize: font.size.xs, color: cfg.text, opacity: 0.8, marginTop: 3 }}>
            {toast.message}
          </div>
        )}
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={doClose}
        style={{
          border:       'none',
          background:   'transparent',
          color:        cfg.text,
          opacity:      0.7,
          cursor:       'pointer',
          fontSize:     14,
          padding:      '2px 4px',
          borderRadius: radius.sm,
          flexShrink:   0,
          lineHeight:   1,
        }}
      >
        ×
      </button>

      {/* Progress bar */}
      {toast.duration > 0 && !paused && (
        <div
          aria-hidden="true"
          style={{
            position:   'absolute',
            bottom:     0,
            left:       0,
            height:     2,
            background: cfg.border,
            borderRadius: `0 0 ${radius.xl}px ${radius.xl}px`,
            animation:  `toastProgress ${toast.duration}ms linear forwards`,
          }}
        />
      )}
    </div>
  )
}
