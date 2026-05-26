# 🔬 KinLab — Interactive Physics Simulation

Browser-based kinematics lab. Drop a ball, record motion data, analyze graphs in real time.

**Stack:** React 18 · TypeScript 5 · Vite 5 · Vitest 2 · HTML5 Canvas

---

## Quick Start

```bash
npm install
npm run dev        # → localhost:5173
npm test           # watch mode
npm run test:run   # single run (386 tests)
npm run build      # production → dist/
```

---

## Architecture

```
World.step() → DataRecorder.record() → getSeries() → GraphEngine.draw() → React UI
```

Physics is the **source of truth** — always runs in pixels internally. The UI is a pure display layer.

---

## Daily Progress

### Day 1 — Scaffold & Core Engine
> Physics engine, canvas loop, data recorder, graph renderer, control bar

- `Body.ts` — data model (x, y, vx, vy, ax, ay)
- `World.ts` — Euler integration, gravity, floor collision (DAMPING = 0.7)
- `InteractionLayer.ts` — drag & pause/resume
- `DataRecorder.ts` — in-memory time-series recorder
- `GraphEngine.ts` — canvas graph (grid, axes, data line)
- `WorldCanvas.tsx` — 60 FPS `requestAnimationFrame` loop
- `GraphCanvas.tsx` — 30 FPS graph refresh
- `ControlBar.tsx` — Play / Pause / Stop / Reset
- `AxisSelector.tsx` — X/Y axis dropdowns

---

### Day 2 — Full Kinematics Pipeline
> Completed 7-series recording, architecture fixes, load tests

- Extended `DataRecorder` to 7 series: `time, x, y, vx, vy, ax, ay`
- `constants.ts` — single source of truth for `FLOOR_Y`, `CANVAS_W`, `BALL_RADIUS`, `GRAVITY`
- Play now resets ball position to origin (not just the recorder)
- `GraphEngine` — switched to `reduce` (prevents stack overflow past 65k points)
- `GraphCanvas` — polling skips frames with no new data (dirty-flag)
- `recorder.start()` moved from module load to user interaction (Play)
- Physical coordinate convention: `y_phys = FLOOR_Y − canvas_y` (floor = 0, up = +)
- Y-direction toggle on graph (↑ physical / ↓ canvas)
- 14 load tests — engine throughput, recorder capacity, graph render performance

---

### Day 3 — Collisions, Export & UI
> Wall collisions, live data table, CSV export, gravity control, popup graph

- **Wall collisions** — left/right bounds (`WALL_L = 20px`, `WALL_R = 580px`), `WALL_DAMPING = 0.8`
- **Recording indicator** — live `● REC` / `‖ PAUSED` / `IDLE` badge in control bar
- **DataTable** — scrollable live table, last 150 rows, collapsible
- **CSV export** — 7-column download with 6-decimal precision
- **GravitySlider** — real-time gravity control with planet presets (🌙 Moon / 🌍 Earth / 🪐 Jupiter)
- **Popup graph** — detached browser window via `BroadcastChannel` sync (`?popup=true`)
- Day 3 demo panel — wall-bounce visualization with bounce counters and mini-graphs
- 49 readiness stress tests — multi-body, energy invariants, 200k-sample memory, CSV at scale

---

### Day 4 — Determinism & Phase 2 Validation
> Pure test sprint — no new features, full engine verification

- `determinism.test.ts` — expanded to 21 scenarios: basic, wall bounces, multi-body, gravity switches, InteractionLayer, 10k/36k-step large-scale
- `day4.test.ts` — new file, 64 tests across 10 categories:
  - Engine barrel exports · Body fields · Euler math · Gravity (0/negative/clamp) · Floor & wall collisions · Velocity clamping · InteractionLayer API · Multi-body · Engine+Recorder pipeline

---

### Unit Calibration (pre-Day 5)
> Physical measurement system — px / cm / m / custom

- `PhysicsScale.ts` — unit layer: `pxToUnit`, `unitToPx`, axis labels, gravity converters
- `ScaleControl.tsx` — selector bar with inline custom PPU input
- Graph axes show physical units with min/max tick annotations
- DataTable & CSV export values converted to chosen unit
- GravitySlider range scales automatically (px → 0–30, cm → 0–3000)
- WorldCanvas draws a scale ruler overlay (hidden in px mode)
- Switching scale preserves physical gravity in SI (9.8 m/s² stays Earth regardless of unit)

---

### Day 5 — Architectural Infrastructure & System Tests
> Shared types, physics event bus, math helpers, FPS meter, recorder integration

- `src/types/index.ts` — shared type registry (`PlayState`, `SimulationConfig`, `BodySnapshot`, `SeriesKey`, `RecorderSnapshot`, `AxisDescriptor`)
- `src/engine/PhysicsEvents.ts` — `PhysicsEventBus` pub/sub for `floor-bounce`, `wall-bounce`, `rest`, `step` events
- `src/utils/math.ts` — pure physics math helpers: `clamp`, `lerp`, `roundTo`, `kineticEnergy`, `potentialEnergy`, `mechanicalEnergy`, `mapRange`
- `src/utils/fps.ts` — `FpsMeter` rolling-average FPS counter (configurable window, min/max, reset)
- `src/recorder/integration.test.ts` — KAN-13 T5.3: 15 integration tests (step↔length parity, time monotonicity, NaN guard, stop gate, multi-body)
- `src/day5.test.ts` — 67 readiness tests covering all new infrastructure + cross-module integration

---

## Test Coverage

| Suite | Tests | Focus |
|---|---|---|
| `engine/Body.test.ts` | 2 | Body defaults & init |
| `engine/World.test.ts` | 5 | Euler, floor collision, dt clamp |
| `engine/InteractionLayer.test.ts` | 4 | Drag & pause API |
| `engine/determinism.test.ts` | 21 | Engine determinism — 6 scenarios |
| `recorder/DataRecorder.test.ts` | 10 | Record, getSeries, stop, reset |
| `graph/GraphEngine.test.ts` | 4 | Draw, flipY, guard |
| `integration.test.ts` | 5 | Full pipeline smoke tests |
| `day2.test.ts` | 28 | Day 2 kinematics & fixes |
| `day3.test.ts` | 28 | Wall collisions, CSV, table, slider |
| `day4.test.ts` | 64 | Phase 2 complete verification |
| `units/PhysicsScale.test.ts` | 25 | Unit conversions & gravity math |
| `load.test.ts` | 14 | Throughput & render performance |
| `stress-reliability.test.ts` | 41 | Stress, invariants, determinism × 10 |
| `readiness.test.ts` | 49 | Day-4 prep — multi-body, memory, CSV |
| `recorder/integration.test.ts` | 15 | T5.3 — step↔recorder pipeline integrity |
| `day5.test.ts` | 67 | Day 5 infra — types, events, math, FPS |
| `day5-load.test.ts` | 31 | Day 5 load — EventBus throughput, FPS precision, math batch, full pipeline |

**Total: 386 / 386 ✅**

---

## Project Structure

```
src/
├── engine/
│   ├── Body.ts                 ← physics data model
│   ├── World.ts                ← Euler integration + collisions
│   ├── InteractionLayer.ts     ← drag + pause/resume
│   └── index.ts                ← barrel export
├── recorder/
│   └── DataRecorder.ts         ← 7-series time-series recorder
├── graph/
│   └── GraphEngine.ts          ← canvas graph renderer
├── canvas/
│   ├── WorldCanvas.tsx         ← 60fps simulation loop
│   └── GraphCanvas.tsx         ← graph canvas + pop-out
├── components/
│   ├── ControlBar.tsx          ← Play / Pause / Stop / Reset
│   ├── AxisSelector.tsx        ← X/Y axis dropdowns
│   ├── GravitySlider.tsx       ← gravity control + planet presets
│   ├── DataTable.tsx           ← live scrollable data table
│   ├── CsvExportButton.tsx     ← CSV download
│   ├── ScaleControl.tsx        ← unit selector (px/cm/m/custom)
│   ├── Day3Panel.tsx           ← wall-bounce demo panel
│   └── GraphPopup.tsx          ← detached graph window
├── units/
│   └── PhysicsScale.ts         ← unit calibration layer
├── types/
│   └── index.ts                ← shared type definitions
├── utils/
│   ├── math.ts                 ← clamp, lerp, energy helpers
│   └── fps.ts                  ← FpsMeter rolling FPS counter
├── constants.ts                ← shared physics & canvas constants
└── App.tsx
```
