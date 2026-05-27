/**
 * LeftSidebar — 260px left panel
 *
 * Tab bar: [Tools] [Add Object]
 *
 * "Add Object" tab:
 *   - Object type list (Circle, Rectangle, Polygon, Line, Fixed Point, Spring)
 *   - [⊕ Custom Object...] button
 *   - Environment section (Floor/Walls toggles, Friction/Restitution sliders)
 *   - Tips section
 *
 * "Tools" tab:
 *   - Select | Move | Force | Delete icon-buttons
 *
 * Extensibility:
 *   - onObjectTypeAdd(type) callback
 *   - onCustomObjectCreate() callback
 *   - pluginSlot: ReactNode for extra tools
 */
import { useState, CSSProperties } from 'react'
import { Toggle } from '../components/ui/Toggle'
import { type SidebarTab, type ActiveTool, type EnvironmentSettings, OBJECT_TYPES } from './shellTypes'

interface LeftSidebarProps {
  sidebarTab:    SidebarTab
  onSidebarTab:  (t: SidebarTab) => void
  activeTool:    ActiveTool
  onToolChange:  (t: ActiveTool) => void
  environment:   EnvironmentSettings
  onEnvChange:   (e: EnvironmentSettings) => void
  /** Called when user clicks an object type to add */
  onObjectTypeAdd?:     (type: string) => void
  /** Called when user clicks the Custom Object button */
  onCustomObjectCreate?: () => void
  /** Extension slot for additional tool buttons */
  pluginSlot?:   React.ReactNode
  /** Whether collapsed to icon-only mode */
  collapsed?:    boolean
}

// ── Sidebar tab button ────────────────────────────────────────────────────────

function SideTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        flex:         1,
        height:       36,
        border:       'none',
        borderBottom: `2px solid ${active ? '#2563EB' : 'transparent'}`,
        background:   'transparent',
        color:        active ? '#2563EB' : '#6B7280',
        fontWeight:   active ? 600 : 400,
        fontSize:     13,
        cursor:       'pointer',
        fontFamily:   'inherit',
        transition:   'all 0.12s',
      }}
    >
      {label}
    </button>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{
      fontSize:      11,
      fontWeight:    600,
      color:         '#9CA3AF',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      padding:       '12px 12px 6px',
    }}>
      {title}
    </div>
  )
}

// ── Object type row ───────────────────────────────────────────────────────────

function ObjectTypeRow({
  icon, label, subtitle, onClick,
}: { icon: string; label: string; subtitle: string; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:         10,
        width:       '100%',
        height:      48,
        padding:     '0 12px',
        border:      'none',
        background:  hov ? '#EFF6FF' : 'transparent',
        cursor:      'pointer',
        textAlign:   'left',
        transition:  'background 0.1s',
        fontFamily:  'inherit',
      }}
    >
      <span style={{ fontSize: 20, flexShrink: 0, width: 28, textAlign: 'center' }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: 1.2 }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {subtitle}
        </div>
      </div>
    </button>
  )
}

// ── Tool button ───────────────────────────────────────────────────────────────

const TOOLS: Array<{ id: ActiveTool; icon: string; label: string }> = [
  { id: 'select', icon: '↖', label: 'Select' },
  { id: 'move',   icon: '✛', label: 'Move'   },
  { id: 'force',  icon: '⚡', label: 'Force'  },
  { id: 'delete', icon: '🗑', label: 'Delete' },
]

function ToolButton({ tool, active, onClick }: {
  tool: typeof TOOLS[number]; active: boolean; onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      aria-label={tool.label}
      aria-pressed={active}
      title={tool.label}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width:          48,
        height:         48,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            3,
        border:         `1px solid ${active ? '#2563EB' : hov ? '#D1D5DB' : '#E5E7EB'}`,
        borderRadius:   8,
        background:     active ? '#2563EB' : hov ? '#F3F4F6' : '#FFFFFF',
        color:          active ? '#FFFFFF' : '#374151',
        cursor:         'pointer',
        transition:     'all 0.12s',
        fontFamily:     'inherit',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 18 }}>{tool.icon}</span>
      <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, lineHeight: 1 }}>
        {tool.label}
      </span>
    </button>
  )
}

// ── Inline slider row ─────────────────────────────────────────────────────────

function SliderRow({ label, id, min, max, step, value, onChange }: {
  label: string; id: string
  min: number; max: number; step: number; value: number
  onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px' }}>
      <span style={{ fontSize: 12, color: '#374151', minWidth: 72, flexShrink: 0 }}>
        {label}
      </span>
      <input
        id={id}
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        style={{ flex: 1, accentColor: '#2563EB', cursor: 'pointer', height: 4 }}
      />
      <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#111827', minWidth: 32, textAlign: 'right' }}>
        {value.toFixed(2)}
      </span>
    </div>
  )
}

// ── Toggle row ────────────────────────────────────────────────────────────────

function ToggleRow({ label, id, checked, onChange }: {
  label: string; id: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '8px 12px',
    }}>
      <span style={{ fontSize: 13, color: '#374151' }}>{label}</span>
      <Toggle id={id} checked={checked} onChange={onChange} size="sm" />
    </div>
  )
}

// ── LeftSidebar ───────────────────────────────────────────────────────────────

export function LeftSidebar({
  sidebarTab, onSidebarTab,
  activeTool, onToolChange,
  environment, onEnvChange,
  onObjectTypeAdd, onCustomObjectCreate,
  pluginSlot,
  collapsed = false,
}: LeftSidebarProps) {

  const w = collapsed ? 56 : 260

  const setEnv = (patch: Partial<EnvironmentSettings>) =>
    onEnvChange({ ...environment, ...patch })

  return (
    <aside
      aria-label="Left sidebar"
      style={{
        width:          w,
        minWidth:       w,
        maxWidth:       w,
        height:         '100%',
        background:     '#FFFFFF',
        borderRight:    '1px solid #E5E7EB',
        display:        'flex',
        flexDirection:  'column',
        overflow:       'hidden',
        transition:     'width 0.2s',
        flexShrink:     0,
      }}
    >
      {/* Tab bar */}
      {!collapsed && (
        <div
          role="tablist"
          aria-label="Sidebar sections"
          style={{
            display:     'flex',
            borderBottom: '1px solid #E5E7EB',
            flexShrink:  0,
          }}
        >
          <SideTab label="Tools"      active={sidebarTab === 'tools'}      onClick={() => onSidebarTab('tools')}      />
          <SideTab label="Add Object" active={sidebarTab === 'add-object'} onClick={() => onSidebarTab('add-object')} />
        </div>
      )}

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

        {/* ── Tools tab ──────────────────────────────────────────────────── */}
        {(sidebarTab === 'tools' || collapsed) && (
          <div>
            {!collapsed && <SectionTitle title="Tools" />}
            <div style={{
              display:         'flex',
              flexWrap:        'wrap',
              gap:             8,
              padding:         collapsed ? '8px 4px' : '4px 12px 12px',
              justifyContent:  collapsed ? 'center' : 'flex-start',
            }}>
              {TOOLS.map(t => (
                <ToolButton
                  key={t.id}
                  tool={t}
                  active={activeTool === t.id}
                  onClick={() => onToolChange(t.id)}
                />
              ))}
            </div>
            {/* Extension slot */}
            {pluginSlot && (
              <div style={{ padding: '0 12px 12px' }}>
                {pluginSlot}
              </div>
            )}
          </div>
        )}

        {/* ── Add Object tab ─────────────────────────────────────────────── */}
        {sidebarTab === 'add-object' && !collapsed && (
          <div>
            <SectionTitle title="Add New Object" />

            {/* Object type list */}
            <div role="list" aria-label="Object types">
              {OBJECT_TYPES.map(ot => (
                <div key={ot.type} role="listitem">
                  <ObjectTypeRow
                    icon={ot.icon}
                    label={ot.label}
                    subtitle={ot.subtitle}
                    onClick={() => onObjectTypeAdd?.(ot.type)}
                  />
                </div>
              ))}
            </div>

            {/* Custom object button */}
            <div style={{ padding: '8px 12px 4px' }}>
              <button
                onClick={onCustomObjectCreate}
                style={{
                  width:        '100%',
                  height:       38,
                  border:       '1.5px dashed #D1D5DB',
                  borderRadius: 6,
                  background:   'transparent',
                  color:        '#6B7280',
                  fontSize:     13,
                  fontWeight:   500,
                  cursor:       'pointer',
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'center',
                  gap:          6,
                  fontFamily:   'inherit',
                  transition:   'all 0.12s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#2563EB'
                  e.currentTarget.style.color = '#2563EB'
                  e.currentTarget.style.background = '#EFF6FF'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#D1D5DB'
                  e.currentTarget.style.color = '#6B7280'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                ⊕ Custom Object…
              </button>
            </div>

            {/* Separator */}
            <div style={{ height: 1, background: '#F3F4F6', margin: '8px 0' }} />

            {/* ── Environment section ─────────────────────────────────── */}
            <SectionTitle title="Environment" />

            <ToggleRow
              id="env-floor" label="Floor"
              checked={environment.floor}
              onChange={v => setEnv({ floor: v })}
            />
            <ToggleRow
              id="env-walls" label="Walls"
              checked={environment.walls}
              onChange={v => setEnv({ walls: v })}
            />
            <SliderRow
              id="env-friction" label="Friction"
              min={0} max={1} step={0.01}
              value={environment.friction}
              onChange={v => setEnv({ friction: v })}
            />
            <SliderRow
              id="env-restitution" label="Restitution"
              min={0} max={1} step={0.01}
              value={environment.restitution}
              onChange={v => setEnv({ restitution: v })}
            />
          </div>
        )}
      </div>

      {/* ── Tips section (sticky bottom) ───────────────────────────────── */}
      {!collapsed && (
        <div style={{
          margin:        8,
          padding:       10,
          background:    '#FFFBEB',
          borderRadius:  6,
          border:        '1px solid #FDE68A',
          flexShrink:    0,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#92400E', marginBottom: 4 }}>
            💡 Tips
          </div>
          <div style={{ fontSize: 11, color: '#78350F', lineHeight: 1.5 }}>
            Select a tool and click on the canvas to interact with objects. Drag objects to move them.
          </div>
        </div>
      )}
    </aside>
  )
}
