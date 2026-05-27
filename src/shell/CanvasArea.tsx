/**
 * CanvasArea — canvas host wrapper
 *
 * Features:
 *  - Light gray background with dot-grid overlay (CSS background-image)
 *  - Coordinate readout: "( x.xx, y.yy ) m" in top-left corner
 *  - Hosts the WorldCanvas component (slot pattern)
 *  - Fires onCursorMove(canvasX, canvasY) for StatusBar coordinate display
 *  - aria-label on the canvas region
 *
 * Does NOT render canvas drawing or simulation — that lives in WorldCanvas.
 */
import { useRef, useState, CSSProperties } from 'react'
import { PhysicsScale, DEFAULT_SCALE } from '../units/PhysicsScale'
import { FLOOR_Y } from '../constants'
import type { CursorPos } from './shellTypes'

interface CanvasAreaProps {
  /** The WorldCanvas element (rendered by App, passed as a child slot) */
  children:     React.ReactNode
  scale?:       PhysicsScale
  onCursorMove?: (pos: CursorPos | null) => void
  style?:       CSSProperties
}

export function CanvasArea({ children, scale = DEFAULT_SCALE, onCursorMove, style }: CanvasAreaProps) {
  const [coord, setCoord] = useState<{ x: number; y: number; sym?: string } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const toPhysical = (canvasX: number, canvasY: number) => {
    const ppu = scale.pixelsPerUnit
    const sym = scale.unitSymbol
    const xPhys =  canvasX / ppu
    const yPhys = (FLOOR_Y - canvasY) / ppu
    return { x: xPhys, y: yPhys, sym }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Find canvas position relative to the wrapper
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    // The WorldCanvas is centered inside the wrapper
    // We need the position relative to the canvas element itself.
    // Use e.target to check if we're on the canvas:
    const target = e.target as HTMLElement
    if (target.tagName !== 'CANVAS') {
      setCoord(null)
      onCursorMove?.(null)
      return
    }
    const canvasRect = target.getBoundingClientRect()
    const cx = e.clientX - canvasRect.left
    const cy = e.clientY - canvasRect.top
    const phys = toPhysical(cx, cy)
    setCoord({ x: phys.x, y: phys.y, sym: phys.sym })
    onCursorMove?.({ canvasX: cx, canvasY: cy })
  }

  const handleMouseLeave = () => {
    setCoord(null)
    onCursorMove?.(null)
  }

  const fmt = (v: number) => v.toFixed(2)

  return (
    <div
      ref={wrapRef}
      aria-label="Physics simulation canvas"
      role="region"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        flex:           1,
        overflow:       'hidden',
        position:       'relative',
        background:     '#F3F4F6',
        // Dot-grid overlay — fine 20px grid
        backgroundImage: 'radial-gradient(circle, #D1D5DB 1px, transparent 1px)',
        backgroundSize:  '20px 20px',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        minHeight:      0,
        ...style,
      }}
    >
      {/* Canvas slot */}
      {children}

      {/* Coordinate readout — top-left corner */}
      {coord && (
        <div
          aria-live="off"
          style={{
            position:   'absolute',
            top:        8,
            left:       8,
            padding:    '3px 7px',
            background: 'rgba(255,255,255,0.88)',
            border:     '1px solid #E5E7EB',
            borderRadius: 4,
            fontSize:   11,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            color:      '#6B7280',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          ({fmt(coord.x)}, {fmt(coord.y)}) {coord.sym ?? 'px'}
        </div>
      )}
    </div>
  )
}
