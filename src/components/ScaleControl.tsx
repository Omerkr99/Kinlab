/**
 * ScaleControl — unit calibration selector
 *
 * Lets the user choose px / cm / m or define a custom scale.
 * Changing the scale only affects display and export — the physics engine
 * continues to operate in pixels internally.
 */
import { useState } from 'react'
import {
  PhysicsScale, SCALE_PRESETS, makeCustomScale, DEFAULT_SCALE,
} from '../units/PhysicsScale'
import { CANVAS_W, CANVAS_H } from '../constants'

interface Props {
  scale:    PhysicsScale
  onChange: (s: PhysicsScale) => void
}

const BUILT_IN: Array<{ id: 'px' | 'cm' | 'm'; label: string; desc: string }> = [
  { id: 'px', label: 'px',  desc: '1 px = 1 px' },
  { id: 'cm', label: 'cm',  desc: '10 px = 1 cm'  },
  { id: 'm',  label: 'm',   desc: '100 px = 1 m'  },
]

export function ScaleControl({ scale, onChange }: Props) {
  const [customPpu, setCustomPpu]     = useState(50)
  const [customSym, setCustomSym]     = useState('u')
  const [showCustom, setShowCustom]   = useState(false)

  const btn = (active: boolean): React.CSSProperties => ({
    padding: '3px 10px', fontSize: 12, fontWeight: active ? 700 : 400,
    border: `1px solid ${active ? '#4A90E2' : '#ccc'}`,
    borderRadius: 5,
    background: active ? '#e8f0fb' : '#f9f9f9',
    color: active ? '#2060c0' : '#555',
    cursor: 'pointer', transition: 'all 0.12s',
  })

  const applyCustom = () => {
    const s = makeCustomScale(customPpu, customSym || 'u')
    onChange(s)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      padding: '8px 12px', background: '#f8f9fa',
      borderRadius: 8, border: '1px solid #e0e0e0',
    }}>
      {/* Label */}
      <span style={{ fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, whiteSpace: 'nowrap' }}>
        📐 Scale
      </span>

      {/* Built-in presets */}
      {BUILT_IN.map(p => (
        <button
          key={p.id}
          style={btn(scale.id === p.id)}
          title={p.desc}
          onClick={() => { onChange(SCALE_PRESETS[p.id]); setShowCustom(false) }}
        >
          {p.label}
        </button>
      ))}

      {/* Custom toggle */}
      <button
        style={btn(scale.id === 'custom')}
        onClick={() => setShowCustom(v => !v)}
        title="Define a custom pixel-to-unit ratio"
      >
        custom…
      </button>

      {/* Custom inputs */}
      {showCustom && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 4 }}>
          <input
            type="number" min={0.001} step={1} value={customPpu}
            onChange={e => setCustomPpu(Math.max(0.001, Number(e.target.value)))}
            style={{ width: 60, padding: '2px 5px', fontSize: 12, border: '1px solid #ccc', borderRadius: 4 }}
            title="Pixels per unit"
          />
          <span style={{ fontSize: 12, color: '#666' }}>px =</span>
          <span style={{ fontSize: 12, color: '#666' }}>1</span>
          <input
            type="text" value={customSym} maxLength={6}
            onChange={e => setCustomSym(e.target.value)}
            placeholder="unit"
            style={{ width: 44, padding: '2px 5px', fontSize: 12, border: '1px solid #ccc', borderRadius: 4 }}
            title="Unit symbol (e.g. ft, in, m)"
          />
          <button
            onClick={applyCustom}
            style={{ padding: '2px 8px', fontSize: 12, background: '#4A90E2', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            ✓
          </button>
        </div>
      )}

      {/* Current calibration summary */}
      <span style={{ fontSize: 10, color: '#aaa', marginLeft: 4, whiteSpace: 'nowrap' }}>
        {scale.id === 'px'
          ? `canvas: ${CANVAS_W} × ${CANVAS_H} px`
          : `canvas: ${(CANVAS_W / scale.pixelsPerUnit).toFixed(1)} × ${(CANVAS_H / scale.pixelsPerUnit).toFixed(1)} ${scale.unitSymbol}`}
      </span>

      {/* Reset to default */}
      {scale.id !== 'px' && (
        <button
          onClick={() => { onChange(DEFAULT_SCALE); setShowCustom(false) }}
          style={{ fontSize: 10, padding: '2px 6px', border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#888' }}
          title="Reset to pixel units"
        >
          ↺
        </button>
      )}
    </div>
  )
}
