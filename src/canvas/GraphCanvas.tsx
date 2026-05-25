import { useRef, useEffect } from 'react'
import { DataRecorder, SeriesKey } from '../recorder'
import { GraphEngine } from '../graph/GraphEngine'

interface Props {
  recorder: DataRecorder
  xKey: SeriesKey
  yKey: SeriesKey
}

export function GraphCanvas({ recorder, xKey, yKey }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GraphEngine | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    engineRef.current = new GraphEngine(canvasRef.current)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      engineRef.current?.draw(recorder, xKey, yKey)
    }, 32)
    return () => clearInterval(id)
  }, [recorder, xKey, yKey])

  return (
    <canvas
      ref={canvasRef}
      width={500}
      height={400}
      style={{ border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}
    />
  )
}
