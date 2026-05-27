/**
 * AppShell — top-level accessible layout
 *
 * Accessibility features:
 *  1. Skip-to-content link (first focusable element, visible on :focus)
 *  2. <header role="banner"> — app identity
 *  3. <nav role="navigation" aria-label="Main navigation"> — primary tab bar
 *  4. <main id="main-content"> — tab panel host
 *  5. <footer> — version / credits
 *  6. aria-live="assertive" toast region for future notifications
 *  7. Global @keyframes for animations (spin, pulse) injected once via <style>
 *
 * Tab structure:
 *   🔬 Simulation   — main physics sim (Day 1–8 controls)
 *   🌀 Spring Lab   — Day 9 spring demo + forces demo
 *   ⚛  Physics Lab  — Day 10 collisions / rotation / constraints
 *   📊 Analysis     — graph, data table, CSV export
 */
import React, { useState, CSSProperties } from 'react'
import { TabNav, TabPanel, type TabItem } from './ui/TabNav'
import { color, font, space, shadow } from '../styles/tokens'

const TABS: TabItem[] = [
  { id: 'simulation', icon: '🔬', label: 'Simulation'  },
  { id: 'spring',     icon: '🌀', label: 'Spring Lab'  },
  { id: 'physics',    icon: '⚛️',  label: 'Physics Lab' },
  { id: 'analysis',   icon: '📊', label: 'Analysis'    },
]

/** Keyframes injected once at shell mount */
const GLOBAL_STYLES = `
@keyframes spin {
  to { transform: rotate(360deg); }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0);    }
}
/* Skip-link: only visible when focused */
.skip-link {
  position: absolute;
  top: -100%;
  left: 1rem;
  z-index: 9999;
  padding: 8px 16px;
  background: ${color.primary.default};
  color: ${color.white};
  font-size: 14px;
  font-weight: 600;
  border-radius: 0 0 6px 6px;
  text-decoration: none;
  transition: top 0.15s;
}
.skip-link:focus {
  top: 0;
}
/* Focus-visible polyfill for all interactive elements */
*:focus:not(:focus-visible) {
  outline: none;
}
*:focus-visible {
  outline: 2px solid ${color.primary.default};
  outline-offset: 2px;
}
`

// ── Sub-components ────────────────────────────────────────────────────────────

interface ShellHeaderProps {
  activeTab: string
}

function ShellHeader({ activeTab }: ShellHeaderProps) {
  void activeTab   // reserved for future breadcrumb / title update

  return (
    <header
      role="banner"
      style={{
        padding:        `${space[4]}px ${space[6]}px ${space[3]}px`,
        borderBottom:   `1px solid ${color.bg.border}`,
        background:     color.bg.surface,
        display:        'flex',
        alignItems:     'center',
        gap:            space[4],
        flexWrap:       'wrap',
        boxShadow:      shadow.sm,
      }}
    >
      {/* Logo / wordmark */}
      <div>
        <h1
          style={{
            margin:     0,
            fontSize:   font.size.xl,
            fontWeight: font.weight.extrabold,
            color:      color.text.primary,
            letterSpacing: -0.5,
          }}
        >
          🔬 KinLab
        </h1>
        <p
          style={{
            margin:     0,
            fontSize:   font.size.xs,
            color:      color.text.muted,
            marginTop:  2,
          }}
        >
          Interactive Physics Simulation
        </p>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Version badge */}
      <span
        aria-label="Application version"
        style={{
          fontSize:     font.size.xs,
          color:        color.text.muted,
          fontFamily:   'monospace',
          background:   color.bg.raised,
          padding:      '2px 8px',
          borderRadius: 4,
          border:       `1px solid ${color.bg.border}`,
        }}
      >
        Day 10 ✓
      </span>
    </header>
  )
}

// ── AppShell props ────────────────────────────────────────────────────────────

interface AppShellProps {
  /** Simulation + gravity + controls */
  simulationSlot: React.ReactNode
  /** Spring Lab (Day9Panel + ForcesDemoPanel) */
  springSlot:     React.ReactNode
  /** Physics Lab (Day10Panel) */
  physicsSlot:    React.ReactNode
  /** Analysis (GraphCanvas + AxisSelector + DataTable + CSV) */
  analysisSlot:   React.ReactNode
  /** Global controls placed in header (ScaleControl) */
  headerControls?: React.ReactNode
}

// ── AppShell ──────────────────────────────────────────────────────────────────

export function AppShell({
  simulationSlot,
  springSlot,
  physicsSlot,
  analysisSlot,
  headerControls,
}: AppShellProps) {
  const [activeTab, setActiveTab] = useState<string>('simulation')

  const pageStyle: CSSProperties = {
    minHeight:  '100vh',
    background: color.bg.base,
    color:      color.text.primary,
    fontFamily: `"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
    display:    'flex',
    flexDirection: 'column',
  }

  const navStyle: CSSProperties = {
    padding:      `${space[3]}px ${space[6]}px`,
    background:   color.bg.base,
    borderBottom: `1px solid ${color.bg.border}`,
    display:      'flex',
    flexDirection: 'column',
    gap:          space[3],
  }

  const mainStyle: CSSProperties = {
    flex:    1,
    padding: `${space[6]}px`,
    // Animate panel transitions
    animation: 'fadeIn 0.18s ease',
  }

  const toastRegionStyle: CSSProperties = {
    position:   'fixed',
    bottom:     space[6],
    right:      space[6],
    zIndex:     9999,
    display:    'flex',
    flexDirection: 'column',
    gap:        space[2],
    pointerEvents: 'none',
  }

  return (
    <>
      {/* Global animations + skip-link CSS */}
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLES }} />

      <div style={pageStyle}>

        {/* 1. Skip-to-content link — always first focusable element */}
        <a
          href="#main-content"
          className="skip-link"
        >
          Skip to main content
        </a>

        {/* 2. Header */}
        <ShellHeader activeTab={activeTab} />

        {/* 3. Optional global controls (ScaleControl) */}
        {headerControls && (
          <div
            style={{
              padding:      `${space[3]}px ${space[6]}px`,
              background:   color.bg.base,
              borderBottom: `1px solid ${color.bg.border}`,
            }}
          >
            {headerControls}
          </div>
        )}

        {/* 4. Navigation */}
        <nav role="navigation" aria-label="Main navigation" style={navStyle}>
          <TabNav
            tabs={TABS}
            activeTab={activeTab}
            onChange={setActiveTab}
            panelIdPrefix="panel"
            size="md"
          />
        </nav>

        {/* 5. Main content area */}
        <main id="main-content" tabIndex={-1} style={mainStyle}>

          {/* Tab panels — hidden but not unmounted to preserve rAF loops */}
          <TabPanel
            id="panel-simulation"
            labelledBy="tab-simulation"
            active={activeTab === 'simulation'}
          >
            {simulationSlot}
          </TabPanel>

          <TabPanel
            id="panel-spring"
            labelledBy="tab-spring"
            active={activeTab === 'spring'}
          >
            {springSlot}
          </TabPanel>

          <TabPanel
            id="panel-physics"
            labelledBy="tab-physics"
            active={activeTab === 'physics'}
          >
            {physicsSlot}
          </TabPanel>

          <TabPanel
            id="panel-analysis"
            labelledBy="tab-analysis"
            active={activeTab === 'analysis'}
          >
            {analysisSlot}
          </TabPanel>
        </main>

        {/* 6. Footer */}
        <footer
          role="contentinfo"
          style={{
            padding:      `${space[3]}px ${space[6]}px`,
            borderTop:    `1px solid ${color.bg.border}`,
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'space-between',
            flexWrap:     'wrap',
            gap:          space[3],
          }}
        >
          <span style={{ fontSize: font.size.xs, color: color.text.muted }}>
            KinLab — Physics Simulation Platform
          </span>
          <span style={{ fontSize: font.size.xs, color: color.text.muted, fontFamily: 'monospace' }}>
            Days 1–10 complete · React + TypeScript + Vite
          </span>
        </footer>

        {/* 7. Live notification region (toast) */}
        <div
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          aria-label="Notifications"
          style={toastRegionStyle}
          id="toast-region"
        />
      </div>
    </>
  )
}
