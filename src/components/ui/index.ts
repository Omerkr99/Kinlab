/**
 * KinLab UI Component Library — barrel export
 *
 * ── Primitive inputs ──────────────────────────────────────────────────────────
 *   Button, IconButton, Toggle       — actions
 *   Input, NumberInput, Slider,      — data entry
 *   Select
 *
 * ── Layout / containers ───────────────────────────────────────────────────────
 *   Card, Divider                    — structure
 *   TabNav, TabPanel                 — tabs
 *
 * ── Feedback / overlay ────────────────────────────────────────────────────────
 *   Badge, Tooltip, Popover,         — status + floating layers
 *   MenuItem
 *
 * ── Icons ─────────────────────────────────────────────────────────────────────
 *   Icon, IconName, Icon* (individual named exports)
 *
 * Usage:
 *   import { Button, Icon, Tooltip, NumberInput } from '../components/ui'
 */

// ── Actions ───────────────────────────────────────────────────────────────────
export { Button }                from './Button'
export type { ButtonVariant, ButtonSize }  from './Button'

export { IconButton }            from './IconButton'
export type { IconButtonVariant, IconButtonSize } from './IconButton'

export { Toggle }                from './Toggle'

// ── Data entry ────────────────────────────────────────────────────────────────
export { Input }                 from './Input'
export type { InputSize, InputVariant }   from './Input'

export { NumberInput }           from './NumberInput'

export { Slider }                from './Slider'

export { Select }                from './Select'
export type { SelectOption }     from './Select'

// ── Layout / containers ───────────────────────────────────────────────────────
export { Card }                  from './Card'
export { Divider }               from './Divider'
export { TabNav, TabPanel }      from './TabNav'
export type { TabItem }          from './TabNav'

// ── Feedback / overlay ────────────────────────────────────────────────────────
export { Badge }                 from './Badge'
export type { BadgeVariant }     from './Badge'

export { Tooltip }               from './Tooltip'
export { Popover, MenuItem }     from './Popover'

// ── Icons ─────────────────────────────────────────────────────────────────────
export { Icon }                  from './icons'
export type { IconName }         from './icons'

// Named icon components (for direct use without the <Icon name="…"> registry)
export {
  IconPlay, IconPause, IconStop, IconReset, IconStepForward,
  IconAtom, IconSettings, IconHelp, IconLayers,
  IconCircle, IconSquare, IconPin, IconSpring, IconLink,
  IconArrowUp, IconGravity, IconForce, IconVelocity,
  IconCursor, IconMove, IconZap, IconEraser,
  IconChartLine, IconTable, IconDownload, IconUpload, IconSave, IconOpen,
  IconPlus, IconMinus, IconX, IconCheck,
  IconChevronDown, IconChevronRight, IconChevronLeft, IconChevronUp,
  IconExpand, IconCollapse,
  IconSun, IconMoon, IconInfo, IconWarning, IconErrorCircle,
  IconPencil, IconCopy, IconTrash, IconUndo, IconRedo, IconLock, IconUnlock,
} from './icons'
