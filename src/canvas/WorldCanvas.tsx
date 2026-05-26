import { useRef, useEffect } from 'react'
import { World } from '../engine'
import { DataRecorder } from '../recorder'
import { InteractionLayer } from '../engine'
import { FLOOR_Y, CANVAS_W, CANVAS_H, BALL_RADIUS } from '../constants'
import { PhysicsScale, DEFAULT_SCALE } from '../units/PhysicsScale'

interface Props {
  world:       World
  recorder:    DataRecorder
  interaction: InteractionLayer
  scale?:      PhysicsScale
}

const VEL_SCALE = 5

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
    // E.g. if scale is huge, show half a unit
    rulerPx    = pixelsPerUnit / 2
    rulerUnits = 0.5
  } else if (rulerPx < 20) {
    // E.g. very small unit — show 10 units
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

function drawWorld(canvas: HTMLCanvasElement, world: World, scale: PhysicsScale): void {
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Background
  ctx.fillStyle = '#f8f9fa'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

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

  // Bodies
  for (const b of world.bodies) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)'
    ctx.beginPath()
    ctx.ellipse(b.x, FLOOR_Y, BALL_RADIUS * 0.8, 6, 0, 0, Math.PI * 2)
    ctx.fill()

    // Ball
    const gradient = ctx.createRadialGradient(b.x - 6, b.y - 6, 2, b.x, b.y, BALL_RADIUS)
    gradient.addColorStop(0, '#74b3f0')
    gradient.addColorStop(1, '#2574c4')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2)
    ctx.fill()

    // Velocity vector (FR-21)
    const vLen = Math.hypot(b.vx, b.vy)
    if (vLen > 0.1) {
      ctx.strokeStyle = '#E24A4A'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(b.x, b.y)
      ctx.lineTo(b.x + b.vx * VEL_SCALE, b.y + b.vy * VEL_SCALE)
      ctx.stroke()
      // Arrowhead
      const angle = Math.atan2(b.vy, b.vx)
      const tipX = b.x + b.vx * VEL_SCALE
      const tipY = b.y + b.vy * VEL_SCALE
      ctx.fillStyle = '#E24A4A'
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

export function WorldCanvas({ world, recorder, interaction, scale = DEFAULT_SCALE }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scaleRef  = useRef<PhysicsScale>(scale)
  scaleRef.current = scale  // always up-to-date inside the rAF loop

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let rafId: number
    let lastTime = performance.now()

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.016)
      lastTime = now

      if (!interaction.isPaused() && !interaction.isDragging()) {
        world.step(dt)
        const b = world.bodies[0]
        // Physical coordinate convention: floor = y=0, upward = positive.
        // Transform: y_phys = FLOOR_Y − canvas_y, vy_phys = −vy, ay_phys = −ay
        if (b) recorder.record(world.time, b.x, FLOOR_Y - b.y, b.vx, -b.vy, b.ax, -b.ay)
      }

      drawWorld(canvas, world, scaleRef.current)
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)

    // Mouse events
    const onDown = (e: MouseEvent) => {
      const x = e.offsetX, y = e.offsetY
      const b = world.bodies.find(b => Math.hypot(b.x - x, b.y - y) < BALL_RADIUS + 5)
      if (b) {
        interaction.startDrag(b)
      } else {
        recorder.reset()
        recorder.start()
      }
    }
    const onMove = (e: MouseEvent) => interaction.updateDrag(e.offsetX, e.offsetY)
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
