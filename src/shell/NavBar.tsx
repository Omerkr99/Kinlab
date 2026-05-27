/**
 * NavBar — top navigation bar (56px)
 *
 * Left:   Atom icon + "KinLabs" + "Physics Lab"
 * Center: Tab strip — Simulation | Objects | Forces | Graphs | Data Monitor | Settings | +
 * Right:  🌙/☀️ dark-mode toggle + Save | Load | Export | Help icon-buttons
 *
 * Accessibility:
 *  - <nav role="navigation"> wrapping the tab strip
 *  - Tabs: role="tab" + aria-selected
 *  - Dark mode: aria-label="Toggle dark mode", aria-pressed
 *  - Right actions: aria-label on each button
 *
 * [KAN-93] Dark mode toggle via data-theme CSS variable
 */
import { useState } from 'react'
import { NAV_TABS, type ActiveNavTab } from './shellTypes'
import { useTheme } from '../context/ThemeContext'

interface NavBarProps {
  activeTab: ActiveNavTab
  onChange:  (tab: ActiveNavTab) => void
}

// ── Dark mode toggle ──────────────────────────────────────────────────────────

function DarkModeButton() {
  const { isDark, toggleTheme } = useTheme()
  const [hov, setHov] = useState(false)

  return (
    <button
      aria-label="Toggle dark mode"
      aria-pressed={isDark}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width:        44,
        height:       44,
        display:      'flex',
        flexDirection: 'column',
        alignItems:   'center',
        justifyContent: 'center',
        gap:          2,
        border:       `1px solid ${hov ? '#E5E7EB' : 'transparent'}`,
        borderRadius: 6,
        background:   isDark
          ? (hov ? '#374151' : '#1F2937')
          : (hov ? '#F3F4F6' : 'transparent'),
        cursor:       'pointer',
        transition:   'all 0.15s',
        padding:      0,
        flexShrink:   0,
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden="true">
        {isDark ? '☀️' : '🌙'}
      </span>
      <span style={{ fontSize: 10, color: isDark ? '#9CA3AF' : '#6B7280', lineHeight: 1 }}>
        {isDark ? 'Light' : 'Dark'}
      </span>
    </button>
  )
}

// ── Action buttons (right section) ───────────────────────────────────────────

const RIGHT_ACTIONS = [
  { icon: '💾', label: 'Save',   action: 'save'   },
  { icon: '📂', label: 'Load',   action: 'load'   },
  { icon: '📤', label: 'Export', action: 'export' },
  { icon: '❓', label: 'Help',   action: 'help'   },
] as const

function ActionButton({ icon, label }: { icon: string; label: string }) {
  const [hov, setHov] = useState(false)
  const { isDark } = useTheme()

  return (
    <button
      aria-label={label}
      title={label}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width:        44,
        height:       44,
        display:      'flex',
        flexDirection: 'column',
        alignItems:   'center',
        justifyContent: 'center',
        gap:          2,
        border:       `1px solid ${hov ? (isDark ? '#374151' : '#E5E7EB') : 'transparent'}`,
        borderRadius: 6,
        background:   hov ? (isDark ? '#374151' : '#F3F4F6') : 'transparent',
        cursor:       'pointer',
        transition:   'all 0.12s',
        padding:      0,
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 10, color: isDark ? '#9CA3AF' : '#6B7280', lineHeight: 1 }}>{label}</span>
    </button>
  )
}

// ── Atom SVG logo ─────────────────────────────────────────────────────────────

function AtomIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <ellipse cx="14" cy="14" rx="12" ry="5" stroke="#2563EB" strokeWidth="1.5" fill="none"/>
      <ellipse cx="14" cy="14" rx="12" ry="5" stroke="#2563EB" strokeWidth="1.5" fill="none"
        transform="rotate(60 14 14)"/>
      <ellipse cx="14" cy="14" rx="12" ry="5" stroke="#2563EB" strokeWidth="1.5" fill="none"
        transform="rotate(120 14 14)"/>
      <circle cx="14" cy="14" r="2.5" fill="#2563EB"/>
    </svg>
  )
}

// ── NavBar ────────────────────────────────────────────────────────────────────

export function NavBar({ activeTab, onChange }: NavBarProps) {
  const { isDark } = useTheme()

  const headerBg     = isDark ? 'var(--kl-bg-app)'     : '#FFFFFF'
  const borderColor  = isDark ? 'var(--kl-border)'     : '#E5E7EB'
  const wordmarkColor = isDark ? 'var(--kl-text-primary)' : '#111827'
  const subtitleColor = isDark ? 'var(--kl-text-secondary)' : '#6B7280'

  return (
    <header
      role="banner"
      style={{
        height:       56,
        display:      'flex',
        alignItems:   'center',
        gap:          0,
        padding:      '0 16px',
        background:   headerBg,
        borderBottom: `1px solid ${borderColor}`,
        boxShadow:    isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
        position:     'relative',
        zIndex:       100,
        transition:   'background 0.2s, border-color 0.2s',
      }}
    >
      {/* ── Left: Logo ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 150 }}>
        <AtomIcon />
        <div>
          <div style={{
            fontSize:   18,
            fontWeight: 700,
            color:      wordmarkColor,
            lineHeight: 1.1,
            letterSpacing: -0.3,
            transition: 'color 0.2s',
          }}>
            KinLabs
          </div>
          <div style={{ fontSize: 11, color: subtitleColor, lineHeight: 1, transition: 'color 0.2s' }}>
            Physics Lab
          </div>
        </div>
      </div>

      {/* ── Center: Tab strip ───────────────────────────────────────────── */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        style={{
          flex:           1,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            2,
        }}
      >
        {NAV_TABS.map(tab => (
          <NavTab
            key={tab.id}
            tab={tab}
            active={tab.id === activeTab}
            onClick={() => onChange(tab.id)}
          />
        ))}
        <AddTabButton />
      </nav>

      {/* ── Right: Dark mode + action buttons ───────────────────────────── */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            2,
          minWidth:       150,
          justifyContent: 'flex-end',
        }}
      >
        <DarkModeButton />

        {/* thin divider */}
        <div style={{
          width: 1, height: 24,
          background: isDark ? '#374151' : '#E5E7EB',
          margin: '0 4px',
          flexShrink: 0,
        }} />

        {RIGHT_ACTIONS.map(a => (
          <ActionButton key={a.action} icon={a.icon} label={a.label} />
        ))}
      </div>
    </header>
  )
}

// ── NavTab ────────────────────────────────────────────────────────────────────

interface NavTabProps {
  tab:     typeof NAV_TABS[number]
  active:  boolean
  onClick: () => void
}

function NavTab({ tab, active, onClick }: NavTabProps) {
  const [hov, setHov] = useState(false)
  const { isDark }    = useTheme()

  const bg          = active
    ? (isDark ? '#1E3A5F' : '#EFF6FF')
    : hov
      ? (isDark ? '#1F2937' : '#F0F7FF')
      : 'transparent'
  const textColor   = active ? '#2563EB' : hov ? '#2563EB' : (isDark ? '#9CA3AF' : '#6B7280')
  const fontWeight  = active ? 600 : 400
  const borderBottom = active ? '2px solid #2563EB' : '2px solid transparent'

  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          5,
        padding:      '6px 12px',
        height:       40,
        border:       'none',
        borderBottom,
        borderRadius: '6px 6px 0 0',
        background:   bg,
        color:        textColor,
        fontWeight,
        fontSize:     13,
        cursor:       'pointer',
        transition:   'all 0.12s',
        whiteSpace:   'nowrap',
        fontFamily:   'inherit',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 14 }}>{tab.icon}</span>
      {tab.label}
    </button>
  )
}

function AddTabButton() {
  const [hov, setHov] = useState(false)
  const { isDark }    = useTheme()

  return (
    <button
      aria-label="Add new tab"
      title="Add new tab"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width:        28,
        height:       28,
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        border:       `1px solid ${hov ? (isDark ? '#4B5563' : '#D1D5DB') : (isDark ? '#374151' : '#E5E7EB')}`,
        borderRadius: '50%',
        background:   hov ? (isDark ? '#374151' : '#F3F4F6') : 'transparent',
        color:        isDark ? '#6B7280' : '#9CA3AF',
        fontSize:     16,
        fontWeight:   400,
        cursor:       'pointer',
        marginLeft:   4,
      }}
    >
      +
    </button>
  )
}
