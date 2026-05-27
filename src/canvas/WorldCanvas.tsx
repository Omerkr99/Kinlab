/**
 * WorldCanvas — simulation canvas with rAF loop
 *
 * KAN-95: Collision flash highlight
 *   - Subscribes to floor-bounce, wall-bounce, collision events via PhysicsEventBus
 *   - Each hit triggers a 400ms glowing ring on the affected body that fades out
 *   - Flash state lives in a Map<bodyIndex, flashStartMs> ref (no React re-renders)
 */
import { useRef, useEffect } from 'react'
import { World } from '../engine'
import { DataRecorder } from '../recorder'
import { InteractionLayer } from '../engine'
import { FLOOR_Y, CANVAS_W, CANVAS_H, BALL_RADIUS } from '../constants'
import { PhysicsScale, DEFAULT_SCALE } from '../units/PhysicsScale'
import type { PhysicsEventBus } from '../engine/PhysicsEvents'

// Per-body color palette — light/dark gradient stops for each body (KAN-97)
const BODY_PALETTE: Array<[string, string]> = [
  ['#74b3f0', '#2574c4'],  // blue  (body 0)
  ['#86efac', '#16A34A'],  // green (body 1)
  ['#fca5a5', '#DC2626'],  // red   (body 2)
  ['#d8b4fe', '#7C3AED'],  // purple(body 3)
  ['#fde68a', '#D97706'],  // amber (body 4)
]
const VEL_ARROW_COLORS = ['#E24A4A', '#DC2626', '#E24A4A', '#7C3AED', '#D97706']

interface Props {
  world:          World
  recorder:       DataRecorder
  interaction:    InteractionLayer
  scale?:         PhysicsScale
  /**
   * Simulation speed multiplier. 1 = real-time, 2 = 2× faster, 0.5 = half speed.
   * Applied via ref so changes never restart the rAF loop. [KAN-92]
   */
  simSpeed?:      number
  /** Called when the user clicks a body (index) or the background (null) */
  onBodySelect?:  (index: number | null) => void
  /** Physics event bus — used for collision flash highlight [KAN-95] */
  eventBus?:      PhysicsEventBus
  /** Draw a subtle grid overlay on the canvas */
  gridEnabled?:   boolean
  /** Snap dragged bodies to the nearest grid cell */
  snapEnabled?:   boolean
}

const VEL_SCALE      = 5
const FLASH_DURATION = 400  // ms
const GRID_SIZE      = 50   // px between grid lines

/**
 * Draw a compact scale ruler in the bottom-left corner.
 * Skipped in px mode (no real-world calibration).
 */
function drawScaleRuler(ctx: CanvasRenderingContext2D, scale: PhysicsScale): void {
  if (scale.id === 'px') return

  const { pixelsPerUnit, unitSymbol } = scale

  // Pick a ruler width that looks good (~60-120 px on screen)
  let rulerPx    = pixelsPerUnit
  let rulerUnits = 1
  if (rulerPx > 150) {
    rulerPx    = pixelsPerUnit / 2
    rulerUnits = 0.5
  } else if (rulerPx < 20) {
    rulerPx    = pixelsPerUnit * 10
    rulerUnits = 10
  } else if (rulerPx < 40) {
    rulerPx    = pixelsPerUnit * 5
    rulerUnits = 5
  }

  const x0 = 10
  const y0 = FLOOR_Y - 22

  // Ruler background
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillRect(x0 - 3, y0 - 14, rulerPx + 6, 22)

  // Ruler line
  ctx.strokeStyle = '#555'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x0, y0); ctx.lineTo(x0 + rulerPx, y0)
  ctx.stroke()

  // End ticks
  ctx.beginPath()
  ctx.moveTo(x0, y0 - 5);            ctx.lineTo(x0, y0 + 5)
  ctx.moveTo(x0 + rulerPx, y0 - 5); ctx.lineTo(x0 + rulerPx, y0 + 5)
  ctx.stroke()

  // Label
  const label = rulerUnits === 1
    ? `1 ${unitSymbol}`
    : `${rulerUnits} ${unitSymbol}`
  ctx.fillStyle = '#444'
  ctx.font = '10px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(label, x0 + rulerPx / 2, y0 - 7)
  ctx.textAlign = 'left'  // reset
}

/** Draw a subtle dot-grid over the canvas background. */
function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save()
  ctx.strokeStyle = 'rgba(0,0,0,0.07)'
  ctx.lineWidth = 1
  for (let x = GRID_SIZE; x < w; x += GRID_SIZE) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let y = GRID_SIZE; y < h; y += GRID_SIZE) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }
  ctx.restore()
}

function drawWorld(
  canvas:      HTMLCanvasElement,
  world:       World,
  scale:       PhysicsScale,
  flashMap:    Map<number, number>,  // bodyIndex → flash start (performance.now())
  gridEnabled: boolean,
): void {
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Background
  ctx.fillStyle = '#f8f9fa'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Grid overlay (drawn before all bodies so bodies sit on top)
  if (gridEnabled) drawGrid(ctx, canvas.width, canvas.height)

  // Floor
  ctx.strokeStyle = '#555'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, FLOOR_Y)
  ctx.lineTo(canvas.width, FLOOR_Y)
  ctx.stroke()

  // Floor label
  ctx.fillStyle = '#999'
  ctx.font = '11px sans-serif'
  ctx.fillText(`floor (y = ${FLOOR_Y})`, 8, FLOOR_Y - 5)

  const now = performance.now()

  // Bodies
  for (let bi = 0; bi < world.bodies.length; bi++) {
    const b = world.bodies[bi]

    // Shadow — use actual body radius (KAN-97)
    const bRadius = b.radius ?? BALL_RADIUS
    ctx.fillStyle = 'rgba(0,0,0,0.08)'
    ctx.beginPath()
    ctx.ellipse(b.x, FLOOR_Y, bRadius * 0.8, 6, 0, 0, Math.PI * 2)
    ctx.fill()

    // ── Collision flash ring (KAN-95) ────────────────────────────────────────
    const flashStart = flashMap.get(bi)
    if (flashStart !== undefined) {
      const elapsed = now - flashStart
      if (elapsed < FLASH_DURATION) {
        const t     = elapsed / FLASH_DURATION                        // 0 → 1
        const alpha = (1 - t) * 0.85                                  // fade out
        const radius = (b.radius ?? BALL_RADIUS) + 4 + t * 12        // expand outward

        ctx.save()
        ctx.globalAlpha = alpha
        ctx.shadowColor  = '#FBBF24'
        ctx.shadowBlur   = 16
        ctx.strokeStyle  = '#F59E0B'
        ctx.lineWidth    = 3 - t * 2
        ctx.beginPath()
        ctx.arc(b.x, b.y, radius, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      } else {
        // Flash expired — clean up
        flashMap.delete(bi)
      }
    }

    // Ball — per-body color palette (KAN-97)
    const [light, dark] = BODY_PALETTE[bi % BODY_PALETTE.length]
    const r = b.radius ?? BALL_RADIUS
    const gradient = ctx.createRadialGradient(b.x - 6, b.y - 6, 2, b.x, b.y, r)
    gradient.addColorStop(0, light)
    gradient.addColorStop(1, dark)
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
    ctx.fill()

    // Body index label (when multiple bodies) (KAN-97)
    if (world.bodies.length > 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.font = `bold ${r < 16 ? 9 : 10}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(bi + 1), b.x, b.y + 1)
      ctx.textBaseline = 'alphabetic'  // reset
      ctx.textAlign = 'left'
    }

    // Velocity vector (FR-21) — per-body arrow color
    const arrowColor = VEL_ARROW_COLORS[bi % VEL_ARROW_COLORS.length]
    const vLen = Math.hypot(b.vx, b.vy)
    if (vLen > 0.1) {
      ctx.strokeStyle = arrowColor
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(b.x, b.y)
      ctx.lineTo(b.x + b.vx * VEL_SCALE, b.y + b.vy * VEL_SCALE)
      ctx.stroke()
      // Arrowhead
      const angle = Math.atan2(b.vy, b.vx)
      const tipX = b.x + b.vx * VEL_SCALE
      const tipY = b.y + b.vy * VEL_SCALE
      ctx.fillStyle = arrowColor
      ctx.beginPath()
      ctx.moveTo(tipX, tipY)
      ctx.lineTo(tipX - 8 * Math.cos(angle - 0.4), tipY - 8 * Math.sin(angle - 0.4))
      ctx.lineTo(tipX - 8 * Math.cos(angle + 0.4), tipY - 8 * Math.sin(angle + 0.4))
      ctx.closePath()
      ctx.fill()
    }
  }

  // Scale ruler overlay
  drawScaleRuler(ctx, scale)
}

export function WorldCanvas({
  world, recorder, interaction,
  scale = DEFAULT_SCALE,
  simSpeed = 1,
  onBodySelect,
  eventBus,
  gridEnabled = false,
  snapEnabled = false,
}: Props) {
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const scaleRef       = useRef<PhysicsScale>(scale)
  const simSpeedRef    = useRef<number>(simSpeed)
  const gridEnabledRef = useRef<boolean>(gridEnabled)
  const snapEnabledRef = useRef<boolean>(snapEnabled)

  // Flash map: bodyIndex → performance.now() when flash started (KAN-95)
  const flashMapRef = useRef<Map<number, number>>(new Map())

  scaleRef.current       = scale        // always up-to-date inside the rAF loop
  simSpeedRef.current    = simSpeed     // updated via ref — never restarts the loop [KAN-92]
  gridEnabledRef.current = gridEnabled  // ref-tracked so rAF loop sees latest value
  snapEnabledRef.current = snapEnabled

  // Subscribe to physics events for flash highlight (KAN-95)
  useEffect(() => {
    if (!eventBus) return

    const triggerFlash = (bodyIndex: number) => {
      flashMapRef.current.set(bodyIndex, performance.now())
    }

    const onFloorBounce = (e: { bodyIndex: number }) => triggerFlash(e.bodyIndex)
    const onWallBounce  = (e: { bodyIndex: number }) => triggerFlash(e.bodyIndex)
    const onCollision   = (e: { bodyIndex: number; bodyIndexB?: number }) => {
      triggerFlash(e.bodyIndex)
      if (e.bodyIndexB !== undefined) triggerFlash(e.bodyIndexB)
    }

    eventBus.on('floor-bounce', onFloorBounce)
    eventBus.on('wall-bounce',  onWallBounce)
    eventBus.on('collision',    onCollision)

    return () => {
      eventBus.off('floor-bounce', onFloorBounce)
      eventBus.off('wall-bounce',  onWallBounce)
      eventBus.off('collision',    onCollision)
    }
  }, [eventBus])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let rafId: number
    let lastTime = performance.now()

    const loop = (now: number) => {
      // Clamp raw dt to 32 ms (≈ 30 fps min) to avoid instability on tab focus
      const rawDt  = Math.min((now - lastTime) / 1000, 0.032)
      lastTime = now

      if (!interaction.isPaused() && !interaction.isDragging()) {
        // Multi-step: decompose total sim dt into ≤16 ms sub-steps so World's
        // internal MAX_DT never clips and simSpeed > 1× actually runs faster.
        // simSpeed = 0.5 → one step of 8 ms   (slow motion works unchanged)
        // simSpeed = 2   → two steps of ~16 ms (2× real-time)
        // simSpeed = 4   → four steps of ~16 ms
        const totalSimDt = rawDt * simSpeedRef.current
        const steps      = Math.max(1, Math.ceil(totalSimDt / 0.016))
        const stepDt     = totalSimDt / steps
        for (let s = 0; s < steps; s++) {
          world.step(stepDt)
        }
        const b = world.bodies[0]
        // Physical coordinate convention: floor = y=0, upward = positive.
        // Transform: y_phys = FLOOR_Y − canvas_y, vy_phys = −vy, ay_phys = −ay
        if (b) recorder.record(world.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
      }

      drawWorld(canvas, world, scaleRef.current, flashMapRef.current, gridEnabledRef.current)
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)

    // Snap a coordinate to the nearest grid line
    const snap = (v: number) =>
      snapEnabledRef.current ? Math.round(v / GRID_SIZE) * GRID_SIZE : v

    // Mouse events
    const onDown = (e: MouseEvent) => {
      const x = e.offsetX, y = e.offsetY
      const b = world.bodies.find(b => Math.hypot(b.x - x, b.y - y) < BALL_RADIUS + 5)
      if (b) {
        interaction.startDrag(b)
        onBodySelect?.(world.bodies.indexOf(b))
      } else {
        // Background click: deselect only — do NOT silently wipe the recording.
        // Users reset data intentionally via the Reset button in SimControlBar.
        onBodySelect?.(null)
      }
    }
    const onMove = (e: MouseEvent) => interaction.updateDrag(snap(e.offsetX), snap(e.offsetY))
    const onUp = () => interaction.endDrag()

    canvas.addEventListener('mousedown', onDown)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseup', onUp)

    return () => {
      cancelAnimationFrame(rafId)
      canvas.removeEventListener('mousedown', onDown)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseup', onUp)
    }
  }, [world, recorder, interaction])

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ border: '1px solid #ddd', borderRadius: 8, cursor: 'crosshair' }}
    />
  )
}
