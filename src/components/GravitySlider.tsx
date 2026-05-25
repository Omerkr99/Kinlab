import { GRAVITY } from '../constants'

interface Props {
  value:    number
  onChange: (g: number) => void
}

export function GravitySlider({ value, onChange }: Props) {
  const presets = [
    { label: '0',    g: 0,    title: 'Zero gravity' },
    { label: '1.6',  g: 1.6,  title: 'Moon (1.6 m/s²)' },
    { label: '9.8',  g: 9.8,  title: 'Earth (9.8 m/s²)' },
    { label: '24.8', g: 24.8, title: 'Jupiter (24.8 m/s²)' },
  ]

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
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', minWidth: 60 }}>
          {value.toFixed(1)} px/s²
        </span>
        {/* Presets */}
        <div style={{ display: 'flex', gap: 4 }}>
          {presets.map(p => (
            <button key={p.g} style={presetBtn(Math.abs(value - p.g) < 0.05)}
              title={p.title} onClick={() => onChange(p.g)}>
              {p.label}
            </button>
          ))}
        </div>
        {/* Reset to Earth */}
        {Math.abs(value - GRAVITY) > 0.05 && (
          <button
            style={{ fontSize: 11, padding: '2px 7px', border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#888' }}
            onClick={() => onChange(GRAVITY)}
            title="Reset to Earth gravity">
            ↺ reset
          </button>
        )}
      </div>
      {/* Slider */}
      <input
        type="range" min={0} max={30} step={0.1}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: 300, accentColor: '#4A90E2', cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa', marginTop: 2, width: 300 }}>
        <span>0</span><span>Moon 1.6</span><span>Earth 9.8</span><span>30</span>
      </div>
    </div>
  )
}
