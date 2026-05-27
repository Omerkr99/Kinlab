/**
 * shellTypes.ts — Shared type definitions for the KinLab UI shell
 */

export type PlayState    = 'idle' | 'running' | 'paused'
export type ActiveNavTab = 'simulation' | 'objects' | 'forces' | 'graphs' | 'data' | 'settings'
export type ObjectType   = 'circle' | 'rectangle' | 'polygon' | 'line' | 'fixed-point' | 'spring'
export type SidebarTab   = 'tools' | 'add-object'
export type ActiveTool   = 'select' | 'move' | 'force' | 'delete'

// ── Live simulation state passed to shell components ──────────────────────────

export interface SimulationState {
  time:            number
  playState:       PlayState
  fps:             number
  gravityEnabled:  boolean
  gridEnabled:     boolean
  snapEnabled:     boolean
  simulationSpeed: number
  zoom:            number
}

// ── Thin UI view of a physics body (mapped from engine Body) ──────────────────

export interface PhysicsObjectUI {
  id:          string    // `body-${index}`
  type:        ObjectType
  x:           number
  y:           number
  vx:          number
  vy:          number
  ax:          number
  ay:          number
  mass:        number
  color:       string
  radius?:     number
  width?:      number
  height?:     number
  restitution: number
}

// ── Environment (floor, walls, friction, restitution) ─────────────────────────

export interface EnvironmentSettings {
  floor:       boolean
  walls:       boolean
  friction:    number
  restitution: number
}

// ── Mouse / cursor position on canvas ────────────────────────────────────────

export interface CursorPos {
  /** Canvas pixels */
  canvasX: number
  canvasY: number
}

// ── Nav tab metadata ──────────────────────────────────────────────────────────

export interface NavTabConfig {
  id:    ActiveNavTab
  icon:  string
  label: string
}

export const NAV_TABS: NavTabConfig[] = [
  { id: 'simulation', icon: '▶',  label: 'Simulation'    },
  { id: 'objects',    icon: '⬜',  label: 'Objects'       },
  { id: 'forces',     icon: '⚡',  label: 'Forces'        },
  { id: 'graphs',     icon: '📈', label: 'Graphs'        },
  { id: 'data',       icon: '📊', label: 'Data Monitor'  },
  { id: 'settings',   icon: '⚙',  label: 'Settings'      },
]

// ── Object type metadata ──────────────────────────────────────────────────────

export interface ObjectTypeConfig {
  type:     ObjectType
  icon:     string
  label:    string
  subtitle: string
  color:    string
}

export const OBJECT_TYPES: ObjectTypeConfig[] = [
  { type: 'circle',      icon: '🔵', label: 'Circle',      subtitle: 'Add a circular object',    color: '#2563EB' },
  { type: 'rectangle',   icon: '🟩', label: 'Rectangle',   subtitle: 'Add a rectangular object', color: '#16A34A' },
  { type: 'polygon',     icon: '🟡', label: 'Polygon',     subtitle: 'Add a polygon object',     color: '#EAB308' },
  { type: 'line',        icon: '╱',  label: 'Line',        subtitle: 'Add a line object',        color: '#6B7280' },
  { type: 'fixed-point', icon: '•',  label: 'Fixed Point', subtitle: 'Add a fixed point',        color: '#374151' },
  { type: 'spring',      icon: '≋',  label: 'Spring',      subtitle: 'Add a spring',             color: '#7C3AED' },
]
