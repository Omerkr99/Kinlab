/**
 * Shell hooks — shared reactive utilities for the KinLab UI shell
 *
 * Exports:
 *  usePoll          — poll an imperative value on a timer (bridges engine → React)
 *  useFps           — measure live frames-per-second
 *  useHover         — track mouse hover on a DOM element
 *  useLocalStorage  — useState backed by localStorage (SSR-safe)
 *  useKeyboard      — register global keyboard shortcuts declaratively
 *  useResizeObserver — watch an element's size with ResizeObserver
 *  useClickOutside  — fire a callback when a click lands outside a ref
 *  useAnimationFrame — run a callback every rAF tick (auto-cancelled on unmount)
 */
import {
  useState, useEffect, useCallback, useRef,
  type RefObject, type MutableRefObject,
} from 'react'

// ── usePoll ───────────────────────────────────────────────────────────────────

/**
 * Re-reads a value on a timer interval.
 * Bridges the physics engine's mutable state into React re-renders.
 *
 * @example
 *   const time = usePoll(() => world.time, 80)
 */
export function usePoll<T>(getter: () => T, ms = 100): T {
  const [value, setValue] = useState<T>(getter)

  useEffect(() => {
    setValue(getter())
    const id = setInterval(() => setValue(getter()), ms)
    return () => clearInterval(id)
  // getter is expected to be stable (useCallback or module-level fn)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getter, ms])

  return value
}

// ── useFps ────────────────────────────────────────────────────────────────────

/**
 * Measures live frames-per-second by counting rAF ticks in a 1-second window.
 *
 * @param active  When false the counter stops (saves battery). Default: true.
 */
export function useFps(active = true): number {
  const [fps, setFps] = useState(0)

  useEffect(() => {
    if (!active) return
    let frames = 0
    let raf: number
    let last  = performance.now()

    const tick = (now: number) => {
      frames++
      if (now - last >= 1000) {
        setFps(Math.round(frames * 1000 / (now - last)))
        frames = 0
        last   = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active])

  return fps
}

// ── useHover ──────────────────────────────────────────────────────────────────

/**
 * Returns hover state + event handlers to attach to a DOM element.
 *
 * Prefer CSS :hover where possible; use this only when hover must drive JS state.
 *
 * @example
 *   const { hovered, onEnter, onLeave } = useHover()
 *   <div onMouseEnter={onEnter} onMouseLeave={onLeave}>…</div>
 */
export function useHover() {
  const [hovered, setHovered] = useState(false)
  const onEnter = useCallback(() => setHovered(true),  [])
  const onLeave = useCallback(() => setHovered(false), [])
  return { hovered, onEnter, onLeave }
}

// ── useLocalStorage ───────────────────────────────────────────────────────────

/**
 * useState backed by localStorage.
 * Falls back to initialValue when localStorage is unavailable.
 *
 * @example
 *   const [theme, setTheme] = useLocalStorage('kinlab-theme', 'light')
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [stored, setStored] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key)
      return item !== null ? (JSON.parse(item) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStored(prev => {
      const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
  }, [key])

  return [stored, setValue]
}

// ── useKeyboard ───────────────────────────────────────────────────────────────

type ModifierSet = { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean }
type KeyBinding  = ModifierSet & { key: string; onPress: (e: KeyboardEvent) => void; disabled?: boolean }

/**
 * Register global keyboard shortcuts declaratively.
 *
 * @example
 *   useKeyboard([
 *     { key: ' ', onPress: togglePlay },
 *     { key: 'r', ctrl: true, onPress: reset },
 *   ])
 */
export function useKeyboard(bindings: KeyBinding[]) {
  const bindingsRef = useRef(bindings)
  bindingsRef.current = bindings

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if focus is in an input/textarea — caller can override by checking e.target
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      for (const b of bindingsRef.current) {
        if (b.disabled) continue
        if (e.key !== b.key) continue
        if (b.ctrl  !== undefined && e.ctrlKey  !== b.ctrl)  continue
        if (b.meta  !== undefined && e.metaKey  !== b.meta)  continue
        if (b.shift !== undefined && e.shiftKey !== b.shift) continue
        if (b.alt   !== undefined && e.altKey   !== b.alt)   continue
        e.preventDefault()
        b.onPress(e)
        break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])  // intentionally empty — we read fresh bindings via ref
}

// ── useResizeObserver ─────────────────────────────────────────────────────────

interface Size { width: number; height: number }

/**
 * Observe an element's size using ResizeObserver.
 * Returns { width, height } of the content box.
 *
 * @example
 *   const ref = useRef<HTMLDivElement>(null)
 *   const { width } = useResizeObserver(ref)
 *   <div ref={ref}>…</div>
 */
export function useResizeObserver(ref: RefObject<Element>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const obs = new ResizeObserver(entries => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize(prev =>
        prev.width === width && prev.height === height ? prev : { width, height }
      )
    })
    obs.observe(el)

    // Initial read
    const rect = el.getBoundingClientRect()
    setSize({ width: rect.width, height: rect.height })

    return () => obs.disconnect()
  }, [ref])

  return size
}

// ── useClickOutside ───────────────────────────────────────────────────────────

/**
 * Fires `handler` when a mousedown event occurs outside all provided refs.
 *
 * @example
 *   const panelRef = useRef<HTMLDivElement>(null)
 *   useClickOutside([panelRef], () => setOpen(false))
 */
export function useClickOutside(
  refs: Array<RefObject<Element> | MutableRefObject<Element | null>>,
  handler: (e: MouseEvent) => void,
) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const listener = (e: MouseEvent) => {
      const outside = refs.every(r => !r.current?.contains(e.target as Node))
      if (outside) handlerRef.current(e)
    }
    document.addEventListener('mousedown', listener)
    return () => document.removeEventListener('mousedown', listener)
  // Ignore refs array identity changes — we read fresh refs via .current
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

// ── useAnimationFrame ─────────────────────────────────────────────────────────

/**
 * Run a callback on every animation frame.
 * The callback receives the elapsed time in milliseconds since the previous frame.
 * Cancels automatically on unmount or when `active` becomes false.
 *
 * @example
 *   useAnimationFrame(dt => setAngle(a => a + dt * 0.001), isPlaying)
 */
export function useAnimationFrame(
  callback: (deltaMs: number) => void,
  active = true,
) {
  const cbRef  = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    if (!active) return
    let rafId: number
    let last = performance.now()

    const tick = (now: number) => {
      cbRef.current(now - last)
      last = now
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [active])
}
