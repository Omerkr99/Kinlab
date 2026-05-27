/**
 * CanvasArea — canvas host wrapper
 *
 * Features:
 *  - Light gray background with dot-grid overlay (CSS background-image)
 *  - Coordinate readout: "( x.xx, y.yy ) m" in top-left corner
 *  - Hosts the WorldCanvas component (slot pattern)
 *  - Fires onCursorMove(canvasX, canvasY) for StatusBar coordinate display
 *  - aria-label on the canvas region
 *  - [KAN-90] zoom: CSS transform:scale on canvas wrapper, corrects cursor coords
 *
 * Does NOT render canvas drawing or simulation — that lives in WorldCanvas.
 */
import { useRef, useState, CSSProperties } from 'react'
import { PhysicsScale, DEFAULT_SCALE } from '../units/PhysicsScale'
import { FLOOR_Y } from '../constants'
import type { CursorPos } from './shellTypes'

interface CanvasAreaProps {
  /** The WorldCanvas element (rendered by App, passed as a child slot) */
  children:      React.ReactNode
  scale?:        PhysicsScale
  /** 1 = 100%, 0.5 = 50%, 2 = 200% — applied as CSS transform:scale */
  zoom?:         number
  onCursorMove?: (pos: CursorPos | null) => void
  style?:        CSSProperties
}

export function CanvasArea({
  children,
  scale = DEFAULT_SCALE,
  zoom  = 1,
  onCursorMove,
  style,
}: CanvasAreaProps) {
  const [coord, setCoord] = useState<{ x: number; y: number; sym?: string } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Convert raw canvas pixel position → physical units
  // When zoom != 1 we must divide offset by zoom so coords stay correct
  const toPhysical = (canvasX: number, canvasY: number) => {
    const ppu = scale.pixelsPerUnit
    const sym = scale.unitSymbol
    const xPhys =  canvasX / ppu
    const yPhys = (FLOOR_Y - canvasY) / ppu
    return { x: xPhys, y: yPhys, sym }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.tagName !== 'CANVAS') {
      setCoord(null)
      onCursorMove?.(null)
      return
    }
    const canvasRect = target.getBoundingClientRect()
    // Divide by zoom to convert from screen pixels → canvas pixels
    const cx = (e.clientX - canvasRect.left)  / zoom
    const cy = (e.clientY - canvasRect.top)   / zoom
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
        background:     'var(--kl-bg-canvas, #F3F4F6)',
        backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.12) 1px, transparent 1px)',
        backgroundSize:  '20px 20px',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        minHeight:      0,
        ...style,
      }}
    >
      {/* Canvas slot — zoom applied here via CSS transform */}
      <div
        style={{
          transform:       `scale(${zoom})`,
          transformOrigin: 'center center',
          transition:      'transform 0.15s ease',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
        }}
      >
        {children}
      </div>

      {/* Coordinate readout — top-left corner */}
      {coord && (
        <div
          aria-live="off"
          style={{
            position:      'absolute',
            top:           8,
            left:          8,
            padding:       '3px 7px',
            background:    'rgba(255,255,255,0.88)',
            border:        '1px solid #E5E7EB',
            borderRadius:  4,
            fontSize:      11,
            fontFamily:    '"JetBrains Mono", "Fira Code", monospace',
            color:         '#6B7280',
            pointerEvents: 'none',
            userSelect:    'none',
          }}
        >
          ({fmt(coord.x)}, {fmt(coord.y)}) {coord.sym ?? 'px'}
        </div>
      )}

      {/* Zoom badge — bottom-right corner */}
      {zoom !== 1 && (
        <div
          aria-label={`Zoom: ${Math.round(zoom * 100)}%`}
          style={{
            position:      'absolute',
            bottom:        8,
            right:         8,
            padding:       '2px 6px',
            background:    'rgba(0,0,0,0.55)',
            borderRadius:  4,
            fontSize:      10,
            fontFamily:    'monospace',
            color:         '#E5E7EB',
            pointerEvents: 'none',
            userSelect:    'none',
          }}
        >
          {Math.round(zoom * 100)}%
        </div>
      )}
    </div>
  )
}
