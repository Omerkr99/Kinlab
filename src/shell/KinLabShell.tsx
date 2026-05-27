/**
 * KinLabShell — root layout component
 *
 * Wires all shell sub-components into a pixel-accurate layout:
 *
 *   ┌─────────────────── NavBar (56px) ───────────────────────┐
 *   ├──────────────── SimControlBar (52px) ───────────────────┤
 *   │ LeftSidebar │      CanvasArea       │ ObjectProperties   │
 *   │   260px     │       (flex-1)        │   280px (opt.)     │
 *   ├─────────────┤  BottomPanels (220px) ├────────────────────┤
 *   │ LeftSidebar │  DataMonitor │ Graph  │ ObjectProperties   │
 *   ├─────────────┴──────────────────────┴────────────────────┤
 *   └──────────────── StatusBar (28px) ──────────────────────-┘
 *
 * All UI state lives here. Physics state lives in the props (world, recorder, etc.).
 * Injects global CSS: variables + keyframes + base resets.
 */
import { useState, useCallback, useEffect, useRef, CSSProperties } from 'react'
import { NavBar }                  from './NavBar'
import { SimControlBar }           from './SimControlBar'
import { LeftSidebar }             from './LeftSidebar'
import { CanvasArea }              from './CanvasArea'
import { ObjectPropertiesPanel }   from './ObjectPropertiesPanel'
import { BottomPanels }            from './BottomPanels'
import { StatusBar }               from './StatusBar'
import { WorldCanvas }             from '../canvas/WorldCanvas'
import { GravitySlider }           from '../components/GravitySlider'
import { ScaleControl }            from '../components/ScaleControl'
import { Day9Panel }               from '../components/Day9Panel'
import { ForcesDemoPanel }         from '../components/ForcesDemoPanel'
import { Day10Panel }              from '../components/Day10Panel'
import type { World, InteractionLayer } from '../engine'
import { BodyFactory } from '../engine'
import type { PhysicsEventBus } from '../engine/PhysicsEvents'
import type { DataRecorder, SeriesKey } from '../recorder'
import type { PhysicsScale } from '../units/PhysicsScale'
import { useToast } from '../context/ToastContext'
import { useResizeObserver } from './hooks'
import type {
  PlayState, ActiveNavTab, SidebarTab, ActiveTool,
  EnvironmentSettings, CursorPos,
} from './shellTypes'

// ── Global CSS injection ──────────────────────────────────────────────────────

const SHELL_CSS = `
/* ── CSS custom properties ────────────────────────────────────────────── */
:root {
  --kl-primary:       #2563EB;
  --kl-primary-light: #EFF6FF;
  --kl-primary-dark:  #1D4ED8;
  --kl-success:       #16A34A;
  --kl-warning:       #EAB308;
  --kl-danger:        #DC2626;
  --kl-purple:        #7C3AED;
  --kl-bg-canvas:     #F3F4F6;
  --kl-bg-app:        #FFFFFF;
  --kl-bg-surface:    #F9FAFB;
  --kl-border:        #E5E7EB;
  --kl-text-primary:  #111827;
  --kl-text-secondary:#6B7280;
}

/* Dark mode overrides */
[data-theme="dark"] {
  --kl-primary-light: #1E3A5F;
  --kl-bg-canvas:     #111827;
  --kl-bg-app:        #0F172A;
  --kl-bg-surface:    #1F2937;
  --kl-border:        #374151;
  --kl-text-primary:  #F9FAFB;
  --kl-text-secondary:#9CA3AF;
}

/* Dark mode — shell panel backgrounds */
[data-theme="dark"] .kl-panel {
  background: var(--kl-bg-surface) !important;
  border-color: var(--kl-border) !important;
  color: var(--kl-text-primary) !important;
}
[data-theme="dark"] .kl-input {
  background: #374151 !important;
  border-color: #4B5563 !important;
  color: var(--kl-text-primary) !important;
}
[data-theme="dark"] .kl-btn-ghost:hover {
  background: #374151 !important;
}

/* Smooth theme transition on key elements */
body, header, main, aside, footer, section, nav {
  transition: background 0.2s ease, border-color 0.2s ease, color 0.15s ease;
}

/* ── Base resets ──────────────────────────────────────────────────────── */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--kl-bg-app);
  color: var(--kl-text-primary);
  overflow: hidden;
}

/* ── Keyframes ────────────────────────────────────────────────────────── */
@keyframes kl-spin {
  to { transform: rotate(360deg); }
}
@keyframes kl-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}
@keyframes toastIn {
  from { opacity: 0; transform: translateX(20px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes toastProgress {
  from { width: 100%; }
  to   { width: 0%; }
}
@keyframes kl-fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Skip-to-content ──────────────────────────────────────────────────── */
.kl-skip-link {
  position: absolute;
  top: -100%;
  left: 1rem;
  z-index: 9999;
  padding: 8px 16px;
  background: var(--kl-primary);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  border-radius: 0 0 6px 6px;
  text-decoration: none;
  transition: top 0.15s;
}
.kl-skip-link:focus {
  top: 0;
}

/* ── Focus-visible ────────────────────────────────────────────────────── */
*:focus:not(:focus-visible) { outline: none; }
*:focus-visible {
  outline: 2px solid var(--kl-primary);
  outline-offset: 2px;
}

/* ── Tab panel animation ──────────────────────────────────────────────── */
.kl-tab-panel[hidden] {
  display: none !important;
}
.kl-tab-panel {
  animation: kl-fadeIn 0.18s ease;
}

/* ── Scrollbar styling (webkit) ───────────────────────────────────────── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: #D1D5DB;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover { background: #9CA3AF; }

/* ── Responsive: collapse sidebars at < 1200px ────────────────────────── */
@media (max-width: 1200px) {
  .kl-sidebar-text { display: none !important; }
}
`

// ── Panel renderers for non-simulation tabs ───────────────────────────────────

function OtherTabContent({ activeTab }: { activeTab: ActiveNavTab }) {
  const panelStyle: CSSProperties = {
    flex:    1,
    padding: 24,
    overflowY: 'auto',
    background: '#F9FAFB',
  }

  if (activeTab === 'objects') {
    return (
      <div style={panelStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Objects</h2>
        <p style={{ color: '#6B7280', fontSize: 14 }}>
          Object management panel — add, remove, and configure physics objects here.
        </p>
      </div>
    )
  }
  if (activeTab === 'forces') {
    return (
      <div style={panelStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Forces</h2>
        <div style={{ marginTop: 16 }}>
          <ForcesDemoPanel />
        </div>
      </div>
    )
  }
  if (activeTab === 'graphs') {
    return (
      <div style={panelStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Graphs</h2>
        <p style={{ color: '#6B7280', fontSize: 14 }}>
          Extended graph analysis — multiple series, export, and layout options.
        </p>
      </div>
    )
  }
  if (activeTab === 'data') {
    return (
      <div style={panelStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Data Monitor</h2>
        <p style={{ color: '#6B7280', fontSize: 14 }}>
          Full data monitor with export, filtering, and historical playback.
        </p>
      </div>
    )
  }
  if (activeTab === 'settings') {
    return (
      <div style={panelStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Settings</h2>
        <div style={{ maxWidth: 500, display: 'flex', flexDirection: 'column', gap: 20, marginTop: 16 }}>
          <section aria-label="Scale settings">
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              Unit Scale
            </h3>
            {/* ScaleControl rendered by parent and injected via headerControls slot */}
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>Scale control is available in the simulation tab toolbar.</p>
          </section>
          <section aria-label="Spring Lab">
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              Spring Lab (Day 9)
            </h3>
            <Day9Panel />
          </section>
          <section aria-label="Physics Lab">
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              Physics Lab (Day 10)
            </h3>
            <Day10Panel />
          </section>
        </div>
      </div>
    )
  }

  return null
}

// ── KinLabShell props ─────────────────────────────────────────────────────────

interface KinLabShellProps {
  world:           World
  recorder:        DataRecorder
  interaction:     InteractionLayer
  /** PhysicsEventBus wired to world.bus — used for toast notifications */
  eventBus?:       PhysicsEventBus
  scale:           PhysicsScale
  onScaleChange:   (s: PhysicsScale) => void
  gravity:         number
  onGravityChange: (v: number) => void
}

// ── KinLabShell ───────────────────────────────────────────────────────────────

export function KinLabShell({
  world, recorder, interaction,
  eventBus,
  scale, onScaleChange,
  gravity, onGravityChange,
}: KinLabShellProps) {

  // ── Toast notifications from PhysicsEventBus [KAN-94] ─────────────────────
  const { toast } = useToast()

  useEffect(() => {
    if (!eventBus) return

    const onCollision = () => toast.info('Bodies collided', { duration: 2500 })
    const onRest      = () => toast.success('Body came to rest', { duration: 2500 })
    const onBounce    = () => { /* floor-bounce — intentionally silent to avoid spam */ }

    eventBus.on('collision',    onCollision)
    eventBus.on('rest',         onRest)
    eventBus.on('floor-bounce', onBounce)

    return () => {
      eventBus.off('collision',    onCollision)
      eventBus.off('rest',         onRest)
      eventBus.off('floor-bounce', onBounce)
    }
  }, [eventBus, toast])

  // ── UI state ───────────────────────────────────────────────────────────────
  const [activeNavTab,  setActiveNavTab]  = useState<ActiveNavTab>('simulation')
  const [sidebarTab,    setSidebarTab]    = useState<SidebarTab>('tools')
  const [activeTool,    setActiveTool]    = useState<ActiveTool>('select')
  const [selectedBody,  setSelectedBody]  = useState<number | null>(null)
  const [playState,     setPlayState]     = useState<PlayState>('idle')
  const [gravityEnabled, setGravityEnabled] = useState(true)
  const [gridEnabled,   setGridEnabled]   = useState(true)
  const [snapEnabled,   setSnapEnabled]   = useState(false)
  const [zoom,          setZoom]          = useState(1)
  const [simSpeed,      setSimSpeed]      = useState(1)
  const [cursorPos,     setCursorPos]     = useState<CursorPos | null>(null)
  const [sidebarCollapsed,    setSidebarCollapsed]    = useState(false)
  // Track whether the user manually toggled the sidebar (overrides auto-collapse)
  const [sidebarUserLocked,   setSidebarUserLocked]   = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)

  // KAN-96: Auto-collapse sidebar below 1200px using ResizeObserver
  const { width: shellWidth } = useResizeObserver(shellRef as React.RefObject<Element>)
  useEffect(() => {
    if (shellWidth === 0) return  // not yet measured
    if (!sidebarUserLocked) {
      setSidebarCollapsed(shellWidth < 1200)
    }
  }, [shellWidth, sidebarUserLocked])

  // Manual toggle: lock to user preference until next resize crosses the threshold
  const handleSidebarToggle = useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed)
    setSidebarUserLocked(true)
    // Auto-unlock if they resize back to a clear breakpoint
  }, [])
  const [environment,   setEnvironment]   = useState<EnvironmentSettings>({
    floor:       true,
    walls:       true,
    friction:    0.20,
    restitution: 0.80,
  })

  // Graph axis state
  const [xKey, setXKey] = useState<SeriesKey>('time')
  const [yKey, setYKey] = useState<SeriesKey>('y')
  const [flipY, setFlipY] = useState(false)

  // Sync gravityEnabled toggle → physics engine
  // When disabled, world.gravity is zeroed; when re-enabled, the last gravity value is restored.
  useEffect(() => {
    world.gravity = gravityEnabled ? gravity : 0
  }, [gravityEnabled, gravity, world])

  // KAN-100: Sync environment settings → physics engine
  // Runs whenever floor/walls/friction/restitution UI controls change.
  useEffect(() => {
    world.floorEnabled    = environment.floor
    world.wallsEnabled    = environment.walls
    world.floorFriction   = 1 - environment.friction      // UI: 0=no friction; engine: 1=no friction
    world.floorRestitution = environment.restitution
  }, [environment, world])

  // Auto-select body 0 when simulation starts
  useEffect(() => {
    if (playState === 'running' && selectedBody === null && world.bodies.length > 0) {
      setSelectedBody(0)
    }
  }, [playState, selectedBody, world.bodies.length])

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleBodySelect = useCallback((idx: number | null) => {
    setSelectedBody(idx)
  }, [])

  const handleBodyDelete = useCallback((idx: number) => {
    world.bodies.splice(idx, 1)
    // KAN-109: disable collision detection when only 1 body remains
    world.collisionDetection = world.bodies.length > 1
    setSelectedBody(null)
  }, [world])

  const showRightPanel = selectedBody !== null

  // ── CSS Grid layout values ─────────────────────────────────────────────────
  const leftW  = sidebarCollapsed ? 56 : 260
  const rightW = showRightPanel ? 280 : 0
  const cols   = `${leftW}px 1fr${showRightPanel ? ` ${rightW}px` : ''}`

  const isSimulation = activeNavTab === 'simulation'

  return (
    <>
      {/* Global CSS injection */}
      <style dangerouslySetInnerHTML={{ __html: SHELL_CSS }} />

      <div
        ref={shellRef}
        style={{
          display:       'flex',
          flexDirection: 'column',
          height:        '100vh',
          overflow:      'hidden',
          background:    '#FFFFFF',
          fontFamily:    '"Inter", system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Skip-to-content */}
        <a href="#kl-main" className="kl-skip-link">Skip to main content</a>

        {/* ── NavBar ──────────────────────────────────────────────────── */}
        <NavBar activeTab={activeNavTab} onChange={setActiveNavTab} />

        {/* ── SimControlBar ─────────────────────────────────────────── */}
        <SimControlBar
          world={world}
          recorder={recorder}
          interaction={interaction}
          playState={playState}
          onPlayStateChange={setPlayState}
          gravityEnabled={gravityEnabled}
          onGravityEnabled={setGravityEnabled}
          gridEnabled={gridEnabled}
          onGridEnabled={setGridEnabled}
          snapEnabled={snapEnabled}
          onSnapEnabled={setSnapEnabled}
          onAfterReset={() => toast.info('Simulation reset', { duration: 2000 })}
        />

        {/* ── Main area (CSS Grid) ───────────────────────────────────── */}
        <main
          id="kl-main"
          tabIndex={-1}
          style={{
            flex:     1,
            display:  'grid',
            gridTemplateColumns: cols,
            overflow: 'hidden',
            minHeight: 0,
            transition: 'grid-template-columns 0.2s',
          }}
        >
          {/* ── Left sidebar ──────────────────────────────────────── */}
          <LeftSidebar
            sidebarTab={sidebarTab}
            onSidebarTab={setSidebarTab}
            activeTool={activeTool}
            onToolChange={setActiveTool}
            environment={environment}
            onEnvChange={setEnvironment}
            onObjectTypeAdd={type => {
              const idx = world.bodies.length
              // KAN-102: dispatch to correct factory method by type
              const b = BodyFactory.fromType(type, idx)
              world.addBody(b)
              world.collisionDetection = world.bodies.length > 1
              setSelectedBody(idx)
              toast.success(`${b.type} ${idx + 1} added`, { duration: 2000 })
            }}
            onCustomObjectCreate={() => console.log('custom object')}
            collapsed={sidebarCollapsed}
            onCollapsedChange={handleSidebarToggle}
          />

          {/* ── Center column ─────────────────────────────────────── */}
          <div style={{
            display:       'flex',
            flexDirection: 'column',
            overflow:      'hidden',
            minWidth:      0,
          }}>
            {/* Simulation tab content */}
            {isSimulation && (
              <>
                {/* Scale control toolbar strip */}
                <div style={{
                  padding:      '6px 12px',
                  background:   '#FFFFFF',
                  borderBottom: '1px solid #F3F4F6',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          12,
                  flexWrap:     'wrap',
                  flexShrink:   0,
                }}>
                  <ScaleControl scale={scale} onChange={onScaleChange} />
                  <div style={{ flex: 1 }} />
                  <GravitySlider value={gravity} onChange={onGravityChange} scale={scale} />
                </div>

                {/* Canvas + Bottom panels */}
                <CanvasArea
                  scale={scale}
                  zoom={zoom}
                  onCursorMove={setCursorPos}
                  style={{ flex: 1, minHeight: 0 }}
                >
                  <WorldCanvas
                    world={world}
                    recorder={recorder}
                    interaction={interaction}
                    scale={scale}
                    simSpeed={simSpeed}
                    onBodySelect={handleBodySelect}
                    eventBus={eventBus}
                    gridEnabled={gridEnabled}
                    snapEnabled={snapEnabled}
                    selectedBodyIndex={selectedBody}
                    activeTool={activeTool}
                    onBodyDelete={handleBodyDelete}
                  />
                </CanvasArea>

                <BottomPanels
                  world={world}
                  recorder={recorder}
                  scale={scale}
                  xKey={xKey} yKey={yKey} flipY={flipY}
                  onXKeyChange={setXKey}
                  onYKeyChange={setYKey}
                  onFlipY={setFlipY}
                />
              </>
            )}

            {/* Other nav tab content */}
            {!isSimulation && (
              <OtherTabContent activeTab={activeNavTab} />
            )}
          </div>

          {/* ── Right sidebar (Object Properties) ─────────────────── */}
          {showRightPanel && (
            <ObjectPropertiesPanel
              bodyIndex={selectedBody}
              world={world}
              recorder={recorder}
              playState={playState}
              onPlayStateChange={setPlayState}
              interaction={interaction}
              onClose={() => setSelectedBody(null)}
              onDelete={handleBodyDelete}
              scale={scale}
            />
          )}
        </main>

        {/* ── StatusBar ─────────────────────────────────────────────── */}
        <StatusBar
          cursorPos={cursorPos}
          scale={scale}
          zoom={zoom}
          onZoomChange={setZoom}
          simulationSpeed={simSpeed}
          onSimSpeedChange={setSimSpeed}
        />
      </div>
    </>
  )
}
