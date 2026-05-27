/**
 * ThemeContext — light / dark mode provider
 *
 * Sets `document.documentElement.dataset.theme` to "" (light) or "dark".
 * KinLabShell's injected CSS already defines [data-theme="dark"] overrides
 * for all --kl-* custom properties — this context wires the React state to that.
 *
 * Persists preference to localStorage under key "kinlab-theme".
 *
 * Usage:
 *   // Wrap the app:
 *   <ThemeProvider>…</ThemeProvider>
 *
 *   // Consume anywhere:
 *   const { theme, toggleTheme } = useTheme()
 */
import React, { createContext, useContext, useEffect } from 'react'
import { useLocalStorage } from '../shell/hooks'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme:       Theme
  setTheme:    (t: Theme) => void
  toggleTheme: () => void
  isDark:      boolean
}

// ── Context ───────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  children:    React.ReactNode
  /** Override default (follows OS preference). Set to 'light' or 'dark' to force. */
  defaultTheme?: Theme
}

export function ThemeProvider({ children, defaultTheme }: ThemeProviderProps) {
  // Resolve OS preference as the initial default
  const osDefault: Theme =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'

  const [theme, setTheme] = useLocalStorage<Theme>('kinlab-theme', defaultTheme ?? osDefault)

  // Apply data-theme to <html> whenever theme changes
  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : ''
  }, [theme])

  // Also apply on initial mount (in case localStorage value differs from DOM)
  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
