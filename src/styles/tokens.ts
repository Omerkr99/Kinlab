/**
 * tokens.ts — KinLab Design System Tokens
 *
 * Single source of truth for all visual constants.
 * Components import from here; NO magic strings scattered across the codebase.
 *
 * Theme: unified dark (matches Day 9 / Day 10 panels, replaces old light main-app theme)
 */

// ── Color palette ────────────────────────────────────────────────────────────

export const color = {
  // Backgrounds — darkest first
  bg: {
    base:    '#0b0f1a',   // page background
    surface: '#111827',   // card / panel
    raised:  '#1e293b',   // input, toolbar
    overlay: '#273449',   // hover surface
    border:  '#334155',   // separator / outline
  },

  // Brand / primary (electric blue)
  primary: {
    default: '#4A90E2',
    light:   '#74aff0',
    dark:    '#2f6abf',
    muted:   '#1b3e6e',
    text:    '#e8f2ff',
  },

  // Accent (teal) — secondary actions, links
  accent: {
    default: '#2dd4bf',
    light:   '#5eead4',
    dark:    '#0f9b8c',
    muted:   '#0d3b37',
    text:    '#ccfbf1',
  },

  // Semantic
  success: {
    default: '#22c55e',
    muted:   '#052e16',
    text:    '#dcfce7',
  },
  warning: {
    default: '#f59e0b',
    muted:   '#2d1d03',
    text:    '#fef3c7',
  },
  danger: {
    default: '#ef4444',
    muted:   '#2d0a0a',
    text:    '#fee2e2',
  },

  // Text hierarchy
  text: {
    primary:   '#f1f5f9',   // headings, important labels
    secondary: '#94a3b8',   // body text, descriptions
    muted:     '#64748b',   // placeholders, disabled
    inverse:   '#0b0f1a',   // on light backgrounds
  },

  // Pure tones
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
} as const

// ── Spacing scale (multiples of 4 px) ───────────────────────────────────────

export const space = {
  0:  0,
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  10: 40,
  12: 48,
  16: 64,
} as const

// ── Typography ───────────────────────────────────────────────────────────────

export const font = {
  family: {
    sans: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", "Courier New", monospace',
  },
  size: {
    xs:   10,
    sm:   12,
    base: 14,
    md:   15,
    lg:   17,
    xl:   20,
    '2xl': 24,
    '3xl': 30,
  },
  weight: {
    normal:   400,
    medium:   500,
    semibold: 600,
    bold:     700,
    extrabold: 800,
  },
  leading: {
    tight:  1.2,
    normal: 1.5,
    loose:  1.75,
  },
} as const

// ── Border radii ─────────────────────────────────────────────────────────────

export const radius = {
  none: 0,
  sm:   4,
  md:   6,
  lg:   8,
  xl:   12,
  '2xl': 16,
  full: 9999,
} as const

// ── Shadows ──────────────────────────────────────────────────────────────────

export const shadow = {
  none: 'none',
  sm:   '0 1px 2px rgba(0,0,0,0.40)',
  md:   '0 4px 6px rgba(0,0,0,0.40)',
  lg:   '0 10px 15px rgba(0,0,0,0.50)',
  glow: {
    primary: `0 0 0 3px ${color.primary.muted}`,
    accent:  `0 0 0 3px ${color.accent.muted}`,
    danger:  `0 0 0 3px ${color.danger.muted}`,
  },
} as const

// ── Focus ring — used by every interactive element ───────────────────────────

export const focusRing = {
  outline:      `2px solid ${color.primary.default}`,
  outlineOffset: '2px',
} as const

// ── Transitions ──────────────────────────────────────────────────────────────

export const transition = {
  fast:   'all 0.1s ease',
  normal: 'all 0.18s ease',
  slow:   'all 0.3s ease',
} as const

// ── Z-index scale ────────────────────────────────────────────────────────────

export const zIndex = {
  base:    0,
  raised:  10,
  overlay: 100,
  modal:   1000,
  toast:   9999,
} as const

// ── Component size tokens ────────────────────────────────────────────────────

export const componentSize = {
  button: {
    sm: { height: 28, px: 10, fontSize: font.size.sm },
    md: { height: 34, px: 14, fontSize: font.size.base },
    lg: { height: 42, px: 20, fontSize: font.size.md },
  },
  input: {
    height: 34,
    px: 10,
    fontSize: font.size.base,
  },
} as const
