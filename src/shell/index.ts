/**
 * Shell barrel export
 *
 * Exports all KinLab shell sub-components, types, hooks, and constants.
 *
 * Usage:
 *   import { KinLabShell, NavBar, usePoll, useTheme } from '../shell'
 */

// ── Shell components ──────────────────────────────────────────────────────────
export { KinLabShell }              from './KinLabShell'
export { NavBar }                   from './NavBar'
export { SimControlBar }            from './SimControlBar'
export { LeftSidebar }              from './LeftSidebar'
export { CanvasArea }               from './CanvasArea'
export { ObjectPropertiesPanel }    from './ObjectPropertiesPanel'
export { BottomPanels, BODY_COLORS } from './BottomPanels'
export { StatusBar }                from './StatusBar'

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  PlayState,
  ActiveNavTab,
  ObjectType,
  SidebarTab,
  ActiveTool,
  SimulationState,
  PhysicsObjectUI,
  EnvironmentSettings,
  CursorPos,
  NavTabConfig,
  ObjectTypeConfig,
} from './shellTypes'

export { NAV_TABS, OBJECT_TYPES } from './shellTypes'

// ── Hooks ─────────────────────────────────────────────────────────────────────
export {
  usePoll,
  useFps,
  useHover,
  useLocalStorage,
  useKeyboard,
  useResizeObserver,
  useClickOutside,
  useAnimationFrame,
} from './hooks'
