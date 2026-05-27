# 🔬 KinLab — Interactive Physics Simulation Lab

> A browser-based kinematics simulator. Drop objects, record motion data, analyze graphs in real time.

**Stack:** React 18 · TypeScript 5 · Vite 5 · Vitest 2 · HTML5 Canvas

[![Tests](https://img.shields.io/badge/tests-547%20passing-brightgreen)](#test-coverage)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](tsconfig.json)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

---

## Quick Start

```bash
npm install
npm run dev        # → http://localhost:5173
npm test           # watch mode
npm run test:run   # single pass  (547 tests)
npm run build      # production → dist/
```

---

## ✅ Live Features

### 🧲 Physics Engine
| Feature | Details |
|---------|---------|
| **Euler integration** | `World.step(dt)` — gravity, velocity, position updated every frame |
| **Floor & wall collisions** | Configurable restitution (bounciness) and floor friction |
| **Environment toggles** | Floor on/off · walls on/off — bodies fall through or escape |
| **Multi-body simulation** | Add up to N bodies; circle-circle collision detection (opt-in) |
| **Force pipeline** | Pluggable `IForce` strategy pattern (GravityForce, DragForce, SpringForce) |
| **Constraints** | `DistanceConstraint`, `PinJoint` — iterative position correction |
| **Angular physics** | `omega`, `alpha`, `torque`, `inertia` — rotation with Day 10 torque forces |
| **Sim speed** | 0.5× slow-motion → 4× fast-forward via multi-sub-step decomposition |

### 🎨 Canvas & Rendering
| Feature | Details |
|---------|---------|
| **60 FPS rAF loop** | `WorldCanvas` — smooth physics + render in one loop |
| **Multi-body palette** | Per-body radial-gradient colours (blue/green/red/purple/amber) |
| **Rectangle bodies** | Box shape with linear gradient + `ctx.rotate(b.angle)` — respects angular physics |
| **User-set colour** | `<input type="color">` in Object Properties → `b.color` → canvas fill |
| **Velocity arrows** | Per-body velocity vector overlaid on each body |
| **Collision flash** | 400 ms glowing ring on floor-bounce / wall-bounce / body-body collision |
| **Scale ruler** | Bottom-left overlay (hidden in px mode) showing real-world unit tick |
| **Grid overlay** | Optional dot-grid with snap-to-grid dragging |
| **Dark mode** | Full canvas dark theme via `ThemeContext`; `CanvasTheme` token system |

### 🛠 Tools Toolbar
| Tool | Shortcut | Behaviour |
|------|----------|-----------|
| **Select** | S | Click body → open Object Properties; click background → deselect |
| **Move** | M | Drag a body with the mouse; snap-to-grid optional |
| **Force** | F | Drag from a body → release applies impulse proportional to drag vector |
| **Delete** | D | Click a body to remove it from the simulation |

### 📊 Data & Graphs
| Feature | Details |
|---------|---------|
| **7-series recorder** | `time, x, y, vx, vy, ax, ay` recorded every simulation step |
| **Multi-body recording** | Records the *selected* body; falls back to body 0 |
| **Live graph** | Configurable X/Y axes, flip-Y, auto-scale, real-time update |
| **Pop-out graph** | Detachable graph window synced via `BroadcastChannel` |
| **DataTable** | Live scrollable table — last 150 rows, smart auto-scroll |
| **↓ Live chip** | Pauses auto-scroll when user scrolls up; blue pill button snaps back |
| **CSV Export** | Download `time_s, x_px, y_px, vx, vy, ax, ay` with one click |
| **Unit display** | All data shown in the active physics scale (px / cm / m / custom) |

### ⚙️ Object Properties Panel
| Feature | Details |
|---------|---------|
| **Live polling** | Position, velocity, acceleration update at 80 ms |
| **Editable fields** | x, y, vx, vy, mass — click any field and type to change |
| **Dynamic units** | Labels (m, m/s, m/s²) follow the active PhysicsScale |
| **Type label** | Reads `b.type` — shows "Circle", "Rectangle", or any future type |
| **Color picker** | `<input type="color">` — change instantly, canvas updates next frame |
| **Live Values** | Time · FPS · Object count · Momentum |
| **Recording badge** | Pulsing ● indicator + point count when recorder is active |
| **Delete button** | Removes body, clears selection, updates collision detection |

### 🌍 Environment Settings
| Control | Range | Default |
|---------|-------|---------|
| Floor enabled | on / off | on |
| Walls enabled | on / off | on |
| Restitution | 0–1 | 0.80 |
| Friction | 0–1 | 0.20 |

### 📐 Unit System
| Scale | Conversion | Gravity (Earth) |
|-------|-----------|----------------|
| `px` | 1:1 identity — cartoon physics | 9.8 px/s² |
| `cm` | 10 px = 1 cm | 980 cm/s² |
| `m` | 100 px = 1 m | 9.8 m/s² (→ 980 px/s²) |
| `custom` | User-defined px/unit | auto-converted |

Scale switching preserves physical gravity (9.8 m/s² stays Earth regardless of unit).

### 💾 Persistence & Sharing
| Feature | Details |
|---------|---------|
| **Save** | Serialises all bodies + physics settings to `localStorage` |
| **Load** | Restores bodies, gravity, environment; syncs React state |
| **Export CSV** | Downloads recorder data as `kinlab-data-<timestamp>.csv` |
| **Help modal** | Keyboard shortcuts, tool descriptions, environment & units guide |

### 🌙 UI Shell
| Feature | Details |
|---------|---------|
| **Dark / Light mode** | Persisted to `localStorage`; OS preference auto-detected |
| **Responsive layout** | Sidebar auto-collapses below 900 px; re-expands on widen |
| **Tab navigation** | Simulation · Objects · Forces · Graphs · Data Monitor · Settings |
| **Toast notifications** | Floor bounce · wall bounce · rest · collision events |
| **Gravity presets** | 🚀 Zero · 🌙 Moon · 🔴 Mars · 🌍 Earth · 🪐 Jupiter |

---

## 🗺 Roadmap — Coming Next

### High Priority
- [ ] **KAN-113 — Undo / Redo** — action stack for body add/delete/property changes
- [ ] **KAN-114 — Spring visual** — render spring coil between pinned anchor and body
- [ ] **KAN-115 — Polygon bodies** — convex polygon shape + SAT collision detection
- [ ] **KAN-116 — Fixed-point anchor** — pin a body to a fixed canvas coordinate

### Medium Priority
- [ ] **KAN-117 — Multi-body CSV export** — export data for all bodies simultaneously
- [ ] **KAN-118 — Scenario presets** — one-click load of Projectile / Pendulum / Spring scenarios
- [ ] **KAN-119 — Body inspector graph** — mini inline graph directly in the right sidebar
- [ ] **KAN-120 — Zoom & pan** — viewport zoom with middle-mouse scroll + drag-to-pan

### Future / Research
- [ ] **KAN-121 — Fluid drag toggle** — add `DragForce` to the environment settings panel
- [ ] **KAN-122 — JSON scene export** — full scene (bodies + forces + constraints) as portable JSON
- [ ] **KAN-123 — Replay mode** — step through recorded data frame-by-frame
- [ ] **KAN-124 — Friction model refinement** — Coulomb friction with rest detection per-body

---

## Architecture

```
World.step() → DataRecorder.record() → getSeries() → GraphEngine.draw() → React UI
```

Physics is the **source of truth** — runs entirely in pixels internally. Every UI element is a pure display adapter over the engine state.

```
src/
├── engine/
│   ├── Body.ts                 ← physics data model (x,y,vx,vy,ax,ay,angle,omega,color,type)
│   ├── World.ts                ← Euler integration, gravity, floor/wall, force pipeline, constraints
│   ├── BodyFactory.ts          ← circle(), rectangle(), fromType(), heavy(), light(), launched()
│   ├── InteractionLayer.ts     ← drag + pause/resume
│   ├── PhysicsEvents.ts        ← pub/sub bus (floor-bounce, wall-bounce, rest, collision, step)
│   ├── forces/                 ← GravityForce, DragForce, SpringForce, TorqueForce (IForce pattern)
│   ├── constraints/            ← DistanceConstraint, PinJoint (IConstraint pattern)
│   └── collisions/             ← CircleCollision, CollisionResolver, CollisionManifold
├── recorder/
│   └── DataRecorder.ts         ← 7-series (time, x, y, vx, vy, ax, ay) in-memory recorder
├── graph/
│   └── GraphEngine.ts          ← canvas graph: grid, axes, unit labels, auto-scale, flipY
├── canvas/
│   ├── WorldCanvas.tsx         ← 60 fps rAF loop; tool dispatch; dark mode; collision flash
│   └── GraphCanvas.tsx         ← 30 fps graph refresh; pop-out via BroadcastChannel
├── shell/
│   ├── KinLabShell.tsx         ← root shell — layout, state orchestration, all callbacks
│   ├── NavBar.tsx              ← tab strip + dark toggle + Save/Load/Export/Help actions
│   ├── LeftSidebar.tsx         ← tools + add-object + environment settings
│   ├── ObjectPropertiesPanel.tsx ← right panel — live body state, color picker, delete
│   ├── SimControlBar.tsx       ← Play / Pause / Reset / speed / grid / snap
│   └── BottomPanels.tsx        ← graph + data table tabs
├── components/
│   ├── HelpModal.tsx           ← keyboard shortcuts + feature guide (portal)
│   ├── DataTable.tsx           ← smart auto-scroll, ↓ Live chip, unit-aware
│   ├── GravitySlider.tsx       ← slider + planet presets, unit-aware range
│   └── ScaleControl.tsx        ← unit picker (px/cm/m/custom PPU)
├── persistence/
│   └── persistence.ts          ← saveWorld, loadWorld, hasSave, exportCSV
├── context/
│   ├── ThemeContext.tsx         ← light/dark provider + useTheme hook
│   └── ToastContext.tsx         ← toast notification provider
└── units/
    └── PhysicsScale.ts         ← pxToUnit, axisLabel, gravityMs2ToEngine, presets
```

---

## Test Coverage

| Suite | Tests | Focus |
|-------|-------|-------|
| `engine/Body.test.ts` | 2 | Body defaults & init |
| `engine/World.test.ts` | 5 | Euler, floor, dt clamp |
| `engine/InteractionLayer.test.ts` | 3 | Drag & pause API |
| `engine/determinism.test.ts` | 14 | Determinism — multi-body, gravity switches |
| `recorder/DataRecorder.test.ts` | 5 | Record, getSeries, stop, reset |
| `graph/GraphEngine.test.ts` | 2 | Draw guard, no throw |
| `integration.test.ts` | 8 | Full pipeline smoke |
| `data-integrity.test.ts` | 22 | Direction, bounce, rest correctness |
| `day3.test.ts` | 28 | Wall collisions, CSV, table, slider |
| `day4.test.ts` | 51 | Phase 2 complete verification |
| `units/PhysicsScale.test.ts` | 29 | Unit conversions & gravity math |
| `load.test.ts` | 14 | Throughput & render performance |
| `stress-reliability.test.ts` | 41 | Stress, invariants, determinism ×10 |
| `readiness.test.ts` | 49 | Multi-body, memory, CSV at scale |
| `recorder/integration.test.ts` | 15 | step↔recorder pipeline integrity |
| `day5.test.ts` | 67 | Types, events, math helpers, FPS meter |
| `day5-load.test.ts` | 31 | EventBus throughput, FPS precision, batch math |
| `day6.test.ts` | 33 | dt cap, coord transform, draw guards, arch |
| `day6-load.test.ts` | 15 | 36k frames NaN-free, gravity switch mid-loop |
| `day7.test.ts` | 42 | GraphEngine API, guards, flipY, scale, dirty-flag |
| `day7-load.test.ts` | 18 | Graph throughput, scale conversion, flipY |
| `day8.test.ts` | 43 | UC-1..4 + mouse/drag/recording contracts |
| `day8-load.test.ts` | 15 | Drag throughput, pause cycles, UC pipeline |

**Total: 547 / 547 ✅**

---

## License

MIT © Omer Kramer
