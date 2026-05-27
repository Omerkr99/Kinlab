/**
 * KinLab icon system — inline SVG icon registry
 *
 * All icons are:
 *  - aria-hidden="true" (descriptive text is always the responsibility of the
 *    surrounding button's aria-label or adjacent text)
 *  - Scalable via `size` prop (default 16)
 *  - Colored via `color` prop or CSS `currentColor` (default)
 *  - Consistent 24×24 viewBox
 *
 * Usage:
 *   <Icon name="play" size={20} />
 *   <Icon name="trash" color="#DC2626" />
 *
 * Icon categories:
 *   Simulation controls:  play, pause, stop, reset, step-forward
 *   Navigation:           atom, home, settings, help, layers
 *   Objects:              circle-dot, square, hexagon, pin, spring, link
 *   Physics:              arrow-up, gravity, force, velocity, acceleration
 *   Tools:                cursor, move, zap, eraser
 *   Data:                 chart-line, table, download-csv, upload, save, open
 *   UI actions:           plus, minus, x, check, chevron-down, chevron-right,
 *                         expand, collapse, sun, moon, info, warning, error-circle
 *   Editing:              pencil, copy, trash, undo, redo, lock, unlock
 */
import { CSSProperties } from 'react'

// ── Base SVG wrapper ──────────────────────────────────────────────────────────

interface SvgProps {
  size?:    number
  color?:   string
  style?:   CSSProperties
  className?: string
}

function Svg({ size = 16, color = 'currentColor', style, className, children }: SvgProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle', ...style }}
      className={className}
    >
      {children}
    </svg>
  )
}

// ── Individual icon components ────────────────────────────────────────────────

export const IconPlay = (p: SvgProps) => (
  <Svg {...p}><polygon points="5 3 19 12 5 21 5 3" fill={p.color ?? 'currentColor'} stroke="none" /></Svg>
)

export const IconPause = (p: SvgProps) => (
  <Svg {...p}><rect x="6" y="4" width="4" height="16" rx="1" fill={p.color ?? 'currentColor'} stroke="none" /><rect x="14" y="4" width="4" height="16" rx="1" fill={p.color ?? 'currentColor'} stroke="none" /></Svg>
)

export const IconStop = (p: SvgProps) => (
  <Svg {...p}><rect x="4" y="4" width="16" height="16" rx="2" fill={p.color ?? 'currentColor'} stroke="none" /></Svg>
)

export const IconReset = (p: SvgProps) => (
  <Svg {...p}>
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 .49-6" />
  </Svg>
)

export const IconStepForward = (p: SvgProps) => (
  <Svg {...p}>
    <polygon points="5 4 15 12 5 20 5 4" fill={p.color ?? 'currentColor'} stroke="none" />
    <line x1="19" y1="4" x2="19" y2="20" strokeWidth={3} />
  </Svg>
)

export const IconAtom = (p: SvgProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="2.5" fill={p.color ?? 'currentColor'} stroke="none" />
    <ellipse cx="12" cy="12" rx="10" ry="4" />
    <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
    <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
  </Svg>
)

export const IconSettings = (p: SvgProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
)

export const IconHelp = (p: SvgProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth={3} />
  </Svg>
)

export const IconLayers = (p: SvgProps) => (
  <Svg {...p}>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </Svg>
)

export const IconCircle = (p: SvgProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /></Svg>
)

export const IconSquare = (p: SvgProps) => (
  <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" /></Svg>
)

export const IconPin = (p: SvgProps) => (
  <Svg {...p}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </Svg>
)

export const IconSpring = (p: SvgProps) => (
  <Svg {...p}>
    <path d="M12 2v2M8 5l4-3 4 3M8 8l4-3 4 3M8 11l4-3 4 3M8 14l4-3 4 3M12 17v3" strokeWidth={1.5} />
    <circle cx="12" cy="2" r="1.5" fill={p.color ?? 'currentColor'} stroke="none" />
    <circle cx="12" cy="20" r="1.5" fill={p.color ?? 'currentColor'} stroke="none" />
  </Svg>
)

export const IconLink = (p: SvgProps) => (
  <Svg {...p}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </Svg>
)

export const IconArrowUp = (p: SvgProps) => (
  <Svg {...p}><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></Svg>
)

export const IconGravity = (p: SvgProps) => (
  <Svg {...p}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="5 12 12 19 19 12" />
    <line x1="6" y1="3" x2="18" y2="3" strokeDasharray="2 2" />
  </Svg>
)

export const IconForce = (p: SvgProps) => (
  <Svg {...p}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
    <circle cx="5" cy="12" r="2" fill={p.color ?? 'currentColor'} stroke="none" />
  </Svg>
)

export const IconVelocity = (p: SvgProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </Svg>
)

export const IconCursor = (p: SvgProps) => (
  <Svg {...p}><path d="m4 4 7.07 17 2.51-7.39L21 11.07z" fill={p.color ?? 'currentColor'} stroke="none" /></Svg>
)

export const IconMove = (p: SvgProps) => (
  <Svg {...p}>
    <polyline points="5 9 2 12 5 15" />
    <polyline points="9 5 12 2 15 5" />
    <polyline points="15 19 12 22 9 19" />
    <polyline points="19 9 22 12 19 15" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="12" y1="2" x2="12" y2="22" />
  </Svg>
)

export const IconZap = (p: SvgProps) => (
  <Svg {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill={p.color ?? 'currentColor'} stroke="none" /></Svg>
)

export const IconEraser = (p: SvgProps) => (
  <Svg {...p}>
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
    <path d="M22 21H7" />
    <path d="m5 11 9 9" />
  </Svg>
)

export const IconChartLine = (p: SvgProps) => (
  <Svg {...p}>
    <line x1="3" y1="20" x2="21" y2="20" />
    <line x1="3" y1="3" x2="3" y2="20" />
    <polyline points="7 16 11 8 15 14 19 6" />
  </Svg>
)

export const IconTable = (p: SvgProps) => (
  <Svg {...p}>
    <rect x="2" y="3" width="20" height="18" rx="2" />
    <line x1="2" y1="9" x2="22" y2="9" />
    <line x1="8" y1="9" x2="8" y2="21" />
    <line x1="14" y1="9" x2="14" y2="21" />
  </Svg>
)

export const IconDownload = (p: SvgProps) => (
  <Svg {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </Svg>
)

export const IconUpload = (p: SvgProps) => (
  <Svg {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </Svg>
)

export const IconSave = (p: SvgProps) => (
  <Svg {...p}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></Svg>
)

export const IconOpen = (p: SvgProps) => (
  <Svg {...p}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></Svg>
)

export const IconPlus = (p: SvgProps) => (
  <Svg {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Svg>
)

export const IconMinus = (p: SvgProps) => (
  <Svg {...p}><line x1="5" y1="12" x2="19" y2="12" /></Svg>
)

export const IconX = (p: SvgProps) => (
  <Svg {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>
)

export const IconCheck = (p: SvgProps) => (
  <Svg {...p}><polyline points="20 6 9 17 4 12" /></Svg>
)

export const IconChevronDown = (p: SvgProps) => (
  <Svg {...p}><polyline points="6 9 12 15 18 9" /></Svg>
)

export const IconChevronRight = (p: SvgProps) => (
  <Svg {...p}><polyline points="9 18 15 12 9 6" /></Svg>
)

export const IconChevronLeft = (p: SvgProps) => (
  <Svg {...p}><polyline points="15 18 9 12 15 6" /></Svg>
)

export const IconChevronUp = (p: SvgProps) => (
  <Svg {...p}><polyline points="18 15 12 9 6 15" /></Svg>
)

export const IconExpand = (p: SvgProps) => (
  <Svg {...p}>
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </Svg>
)

export const IconCollapse = (p: SvgProps) => (
  <Svg {...p}>
    <polyline points="4 14 10 14 10 20" />
    <polyline points="20 10 14 10 14 4" />
    <line x1="10" y1="14" x2="3" y2="21" />
    <line x1="21" y1="3" x2="14" y2="10" />
  </Svg>
)

export const IconSun = (p: SvgProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="4" />
    <line x1="12" y1="20" x2="12" y2="22" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="2" y1="12" x2="4" y2="12" />
    <line x1="20" y1="12" x2="22" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </Svg>
)

export const IconMoon = (p: SvgProps) => (
  <Svg {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill={p.color ?? 'currentColor'} stroke="none" /></Svg>
)

export const IconInfo = (p: SvgProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" strokeWidth={3} /></Svg>
)

export const IconWarning = (p: SvgProps) => (
  <Svg {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth={3} /></Svg>
)

export const IconErrorCircle = (p: SvgProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></Svg>
)

export const IconPencil = (p: SvgProps) => (
  <Svg {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></Svg>
)

export const IconCopy = (p: SvgProps) => (
  <Svg {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Svg>
)

export const IconTrash = (p: SvgProps) => (
  <Svg {...p}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></Svg>
)

export const IconUndo = (p: SvgProps) => (
  <Svg {...p}><polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" /></Svg>
)

export const IconRedo = (p: SvgProps) => (
  <Svg {...p}><polyline points="15 14 20 9 15 4" /><path d="M4 20v-7a4 4 0 0 1 4-4h12" /></Svg>
)

export const IconLock = (p: SvgProps) => (
  <Svg {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Svg>
)

export const IconUnlock = (p: SvgProps) => (
  <Svg {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></Svg>
)

// ── Icon registry + generic <Icon> component ──────────────────────────────────

export type IconName =
  | 'play' | 'pause' | 'stop' | 'reset' | 'step-forward'
  | 'atom' | 'settings' | 'help' | 'layers'
  | 'circle' | 'square' | 'pin' | 'spring' | 'link'
  | 'arrow-up' | 'gravity' | 'force' | 'velocity'
  | 'cursor' | 'move' | 'zap' | 'eraser'
  | 'chart-line' | 'table' | 'download' | 'upload' | 'save' | 'open'
  | 'plus' | 'minus' | 'x' | 'check'
  | 'chevron-down' | 'chevron-right' | 'chevron-left' | 'chevron-up'
  | 'expand' | 'collapse'
  | 'sun' | 'moon' | 'info' | 'warning' | 'error-circle'
  | 'pencil' | 'copy' | 'trash' | 'undo' | 'redo' | 'lock' | 'unlock'

const ICON_MAP: Record<IconName, (p: SvgProps) => JSX.Element> = {
  'play':          IconPlay,
  'pause':         IconPause,
  'stop':          IconStop,
  'reset':         IconReset,
  'step-forward':  IconStepForward,
  'atom':          IconAtom,
  'settings':      IconSettings,
  'help':          IconHelp,
  'layers':        IconLayers,
  'circle':        IconCircle,
  'square':        IconSquare,
  'pin':           IconPin,
  'spring':        IconSpring,
  'link':          IconLink,
  'arrow-up':      IconArrowUp,
  'gravity':       IconGravity,
  'force':         IconForce,
  'velocity':      IconVelocity,
  'cursor':        IconCursor,
  'move':          IconMove,
  'zap':           IconZap,
  'eraser':        IconEraser,
  'chart-line':    IconChartLine,
  'table':         IconTable,
  'download':      IconDownload,
  'upload':        IconUpload,
  'save':          IconSave,
  'open':          IconOpen,
  'plus':          IconPlus,
  'minus':         IconMinus,
  'x':             IconX,
  'check':         IconCheck,
  'chevron-down':  IconChevronDown,
  'chevron-right': IconChevronRight,
  'chevron-left':  IconChevronLeft,
  'chevron-up':    IconChevronUp,
  'expand':        IconExpand,
  'collapse':      IconCollapse,
  'sun':           IconSun,
  'moon':          IconMoon,
  'info':          IconInfo,
  'warning':       IconWarning,
  'error-circle':  IconErrorCircle,
  'pencil':        IconPencil,
  'copy':          IconCopy,
  'trash':         IconTrash,
  'undo':          IconUndo,
  'redo':          IconRedo,
  'lock':          IconLock,
  'unlock':        IconUnlock,
}

interface IconProps extends SvgProps {
  name: IconName
}

/**
 * Generic icon component — picks from the icon registry by name.
 *
 * @example
 *   <Icon name="play" size={20} color="#2563EB" />
 */
export function Icon({ name, ...rest }: IconProps) {
  const Component = ICON_MAP[name]
  return Component ? <Component {...rest} /> : null
}
