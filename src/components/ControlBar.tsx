import { World } from '../engine'
import { DataRecorder } from '../recorder'
import { InteractionLayer } from '../engine'

interface Props {
  world: World
  recorder: DataRecorder
  interaction: InteractionLayer
}

const START_X = 300
const START_Y = 50

const btnStyle: React.CSSProperties = {
  padding: '8px 18px',
  fontSize: 14,
  fontWeight: 600,
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  transition: 'opacity 0.15s',
}

function resetBall(world: World): void {
  world.time = 0
  const b = world.bodies[0]
  if (b) { b.x = START_X; b.y = START_Y; b.vx = 0; b.vy = 0; b.ax = 0; b.ay = 0 }
}

export function ControlBar({ world, recorder, interaction }: Props) {
  const handlePlay = () => {
    resetBall(world)          // KAN-33: reset ball position before recording
    recorder.reset()
    recorder.start()
    interaction.resume()
  }

  const handlePause = () => {
    interaction.pause()
  }

  const handleReset = () => {
    interaction.pause()
    recorder.reset()
    resetBall(world)
  }

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
      <button style={{ ...btnStyle, background: '#4A90E2', color: '#fff' }} onClick={handlePlay}>
        ▶ Play
      </button>
      <button style={{ ...btnStyle, background: '#f0f0f0', color: '#333' }} onClick={handlePause}>
        ⏸ Pause
      </button>
      <button style={{ ...btnStyle, background: '#f0f0f0', color: '#333' }} onClick={handleReset}>
        ⏹ Reset
      </button>
    </div>
  )
}
