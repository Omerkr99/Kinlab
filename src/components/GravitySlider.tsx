import {
  PhysicsScale, DEFAULT_SCALE,
  GRAVITY_PRESETS_MS2,
  gravityMs2ToEngine,
  gravityEngineToDisplay,
  gravitySliderMax,
  gravitySliderStep,
  accelUnit,
} from '../units/PhysicsScale'

interface Props {
  /** Engine value in px/s² */
  value:    number
  onChange: (enginePxS2: number) => void
  scale?:   PhysicsScale
}

export function GravitySlider({ value, onChange, scale = DEFAULT_SCALE }: Props) {
  const displayVal = gravityEngineToDisplay(value, scale)
  const sliderMax  = gravitySliderMax(scale)
  const sliderStep = gravitySliderStep(scale)
  const unit       = accelUnit(scale)

  // Convert display value (in current scale units/s²) → engine px/s²
  const displayToEngine = (d: number) => d * scale.pixelsPerUnit

  // Compute display value of a preset (originally in m/s²)
  const presetDisplay = (ms2: number): number =>
    gravityEngineToDisplay(gravityMs2ToEngine(ms2, scale), scale)

  // Earth reference for reset button
  const earthEngine  = gravityMs2ToEngine(9.8, scale)
  const earthDisplay = presetDisplay(9.8)
  const isEarth      = Math.abs(displayVal - earthDisplay) < sliderStep * 0.6

  const presetBtn = (active: boolean): React.CSSProperties => ({
    padding:      '2px 7px',
    fontSize:     11,
    fontWeight:   active ? 700 : 400,
    border:       `1px solid ${active ? '#4A90E2' : '#ddd'}`,
    borderRadius: 4,
    background:   active ? '#e8f0fb' : '#f5f5f5',
    color:        active ? '#2060c0' : '#555',
    cursor:       'pointer',
  })

  // Slider tick labels: show a few meaningful values in display units
  const moonDisplay    = presetDisplay(1.6)
  const jupiterDisplay = presetDisplay(24.8)

  return (
    <div style={{
      marginTop:  10,
      padding:    '10px 14px',
      background: '#f8f9fa',
      borderRadius: 8,
      border:     '1px solid #e0e0e0',
      width:      'fit-content',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Gravity
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', minWidth: 90 }}>
          {displayVal.toFixed(scale.id === 'px' ? 1 : (sliderMax > 100 ? 0 : 1))} {unit}
        </span>

        {/* Planet presets */}
        <div style={{ display: 'flex', gap: 4 }}>
          {GRAVITY_PRESETS_MS2.map(p => {
            const pd   = presetDisplay(p.ms2)
            const active = Math.abs(displayVal - pd) < sliderStep * 0.6
            return (
              <button
                key={p.label}
                style={presetBtn(active)}
                title={p.title}
                onClick={() => onChange(gravityMs2ToEngine(p.ms2, scale))}
              >
                {p.icon} {p.label}
              </button>
            )
          })}
        </div>

        {/* Reset to Earth */}
        {!isEarth && (
          <button
            style={{ fontSize: 11, padding: '2px 7px', border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#888' }}
            onClick={() => onChange(earthEngine)}
            title={`Reset to Earth gravity (${earthDisplay.toFixed(1)} ${unit})`}
          >
            ↺ reset
          </button>
        )}
      </div>

      {/* Slider */}
      <input
        type="range"
        min={0}
        max={sliderMax}
        step={sliderStep}
        value={displayVal}
        onChange={e => onChange(displayToEngine(parseFloat(e.target.value)))}
        style={{ width: 300, accentColor: '#4A90E2', cursor: 'pointer' }}
      />

      {/* Tick labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa', marginTop: 2, width: 300 }}>
        <span>0</span>
        <span>Moon {moonDisplay.toFixed(moonDisplay < 10 ? 1 : 0)}</span>
        <span>Earth {earthDisplay.toFixed(earthDisplay < 10 ? 1 : 0)}</span>
        <span>{sliderMax.toFixed(sliderMax < 100 ? 0 : 0)}</span>
      </div>
    </div>
  )
}
