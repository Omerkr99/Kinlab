/**
 * Shell hooks — shared polling/reactive utilities
 */
import { useState, useEffect, useCallback } from 'react'

/**
 * usePoll — re-reads a value on a timer interval.
 *
 * Usage:
 *   const time = usePoll(() => world.time, 100)
 *
 * @param getter  Function that returns the current value (must be stable or wrapped with useCallback)
 * @param ms      Polling interval in milliseconds (default: 100)
 */
export function usePoll<T>(getter: () => T, ms = 100): T {
  const [value, setValue] = useState<T>(getter)

  useEffect(() => {
    // Immediate update on mount / getter change
    setValue(getter())
    const id = setInterval(() => setValue(getter()), ms)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getter, ms])

  return value
}

/**
 * useFps — measures live frames-per-second by counting ticks in a 1-second window.
 * Intended for use in components that display "FPS: 60".
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

/**
 * useHover — returns [ref, isHovered] for an element.
 * Prefer CSS :hover where possible; use this when hover must control JS state.
 */
export function useHover<T extends HTMLElement>() {
  const [hovered, setHovered] = useState(false)
  const onEnter = useCallback(() => setHovered(true),  [])
  const onLeave = useCallback(() => setHovered(false), [])
  return { hovered, onEnter, onLeave }
}
