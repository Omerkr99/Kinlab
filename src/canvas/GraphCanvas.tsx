import { useRef, useEffect } from 'react'
import { DataRecorder, SeriesKey } from '../recorder'
import { GraphEngine } from '../graph/GraphEngine'

interface Props {
  recorder: DataRecorder
  xKey: SeriesKey
  yKey: SeriesKey
  flipY?: boolean   // negate Y series for display (canvas ↓+ convention)
}

export function GraphCanvas({ recorder, xKey, yKey, flipY = false }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const engineRef   = useRef<GraphEngine | null>(null)
  const lastLenRef  = useRef<number>(-1)   // KAN-36: dirty flag — skip redraw when no new data

  useEffect(() => {
    if (!canvasRef.current) return
    engineRef.current = new GraphEngine(canvasRef.current)
    lastLenRef.current = -1  // force redraw on mount
  }, [])

  // reset dirty flag when axes or flip direction change so graph redraws immediately
  useEffect(() => { lastLenRef.current = -1 }, [xKey, yKey, flipY])

  useEffect(() => {
    const id = setInterval(() => {
      const currentLen = recorder.getLength()
      if (currentLen === lastLenRef.current) return  // no new data — skip
      lastLenRef.current = currentLen
      engineRef.current?.draw(recorder, xKey, yKey, flipY)
    }, 32)
    return () => clearInterval(id)
  }, [recorder, xKey, yKey, flipY])

  return (
    <canvas
      ref={canvasRef}
      width={500}
      height={400}
      style={{ border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}
    />
  )
}
