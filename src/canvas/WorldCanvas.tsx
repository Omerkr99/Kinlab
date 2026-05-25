import { useRef, useEffect } from 'react'
import { World } from '../engine'
import { DataRecorder } from '../recorder'
import { InteractionLayer } from '../engine'
import { FLOOR_Y, CANVAS_W, CANVAS_H, BALL_RADIUS } from '../constants'

interface Props {
  world: World
  recorder: DataRecorder
  interaction: InteractionLayer
}

const VEL_SCALE = 5

function drawWorld(canvas: HTMLCanvasElement, world: World): void {
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
}

export function WorldCanvas({ world, recorder, interaction }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

      drawWorld(canvas, world)
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
