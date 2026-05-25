# 🔬 KinLab — Interactive Physics Simulation

> **Version:** `v0.1.0` — Day 1 Release  
> **Status:** ✅ Stable · 25/25 tests passing  
> **Stack:** React 18 · TypeScript 5 · Vite 5 · Vitest 2

---

## What is KinLab?

KinLab is a browser-based interactive physics laboratory.  
Drop a ball, watch it fall and bounce, record kinematics data in real time, and analyze it on a live graph — all without leaving the browser.

---

## Current Features — v0.1.0

| Feature | Description |
|---------|-------------|
| 🎱 **Physics Engine** | Euler integration with gravity (9.8), floor collision, damping (0.7), velocity clamping |
| 🎮 **Interaction** | Drag ball to any position, Play / Pause / Reset simulation |
| 📊 **Live Graph** | Canvas-rendered graph with configurable X/Y axes, 30fps refresh |
| 🎯 **Axis Selection** | Plot any pair of: `time`, `x position`, `vx velocity`, `ax acceleration` |
| ⏺ **Data Recorder** | In-memory time-series capture synced to simulation loop (60fps) |
| 🧪 **Full Test Suite** | 25 unit + integration tests across 7 modules |

---

## Architecture

```
World.step() → DataRecorder.record() → getSeries() → GraphEngine.draw() → React UI
```

Physics is the **single source of truth**. UI reads state; never drives it.

---

## Module Map

| Module | File | Responsibility |
|--------|------|----------------|
| Engine | `src/engine/Body.ts` | Position, velocity, acceleration state |
| Engine | `src/engine/World.ts` | Euler step, gravity, floor bounce, clamping |
| Engine | `src/engine/InteractionLayer.ts` | Drag, pause/resume |
| Recorder | `src/recorder/DataRecorder.ts` | Time-series: time, x, vx, ax |
| Graph | `src/graph/GraphEngine.ts` | Canvas renderer — grid, axes, data line |
| Canvas | `src/canvas/WorldCanvas.tsx` | 60fps rAF loop + mouse events |
| Canvas | `src/canvas/GraphCanvas.tsx` | 30fps graph refresh |
| UI | `src/components/ControlBar.tsx` | Play / Pause / Reset |
| UI | `src/components/AxisSelector.tsx` | X/Y axis dropdowns |

---

## Roadmap — Day 2

- [ ] Full y-axis kinematics: `y`, `vy`, `ay` in recorder + graph
- [ ] Fix Play to reset ball to start position `(300, 50)`
- [ ] Left/right wall collisions
- [ ] Recording indicator (live pulse)
- [ ] Data table panel (last 10 rows)
- [ ] Export to CSV
- [ ] Gravity slider (1–20 m/s²)

---

## Getting Started

```bash
npm install
npm run dev        # → http://localhost:5173
npm run test:run   # run test suite
npm run build      # production build → dist/
```

---

*Built with ❤️ for physics education.*
