# 🔬 KinLab — Interactive Physics Simulation

Browser-based physics lab. Drop a ball, record data, analyze graphs.

## Quick Start

```bash
npm install
npm run dev        # → localhost:5173
```

## Commands

```bash
npm test           # run all tests (watch mode)
npm run test:run   # run tests once
npm run build      # production build → dist/
```

---

## 🗓 Workflow

### ✅ Day 1 — Core Engine & Pipeline (DONE)

| # | Item | File(s) | Status |
|---|------|---------|--------|
| 1 | Physics data model | `engine/Body.ts` | ✅ |
| 2 | Euler integration + floor collision + damping | `engine/World.ts` | ✅ |
| 3 | Drag + pause/resume | `engine/InteractionLayer.ts` | ✅ |
| 4 | In-memory time-series recorder (time, x, vx, ax) | `recorder/DataRecorder.ts` | ✅ |
| 5 | Canvas graph renderer (grid, axes, data line) | `graph/GraphEngine.ts` | ✅ |
| 6 | 60fps rAF simulation loop + mouse events | `canvas/WorldCanvas.tsx` | ✅ |
| 7 | 30fps graph refresh | `canvas/GraphCanvas.tsx` | ✅ |
| 8 | Play / Pause / Reset buttons | `components/ControlBar.tsx` | ✅ |
| 9 | X/Y axis dropdowns | `components/AxisSelector.tsx` | ✅ |
| 10 | Integration tests + unit tests (23 tests) | `*.test.ts` | ✅ |

**Known gaps carried into Day 2:**
- Recorder tracks only `x, vx, ax` — `y, vy, ay` are missing
- `Play` resets the recorder but does not return the ball to start position
- No visual indicator that recording is active

---

## 🔍 Code Review — 2026-05-25

> Full audit run after Day 1 completion. All findings resolved before Day 2 begins.

### Pipeline Status

```
[AUDIT] 2026-05-25 13:39 — 25 tests across 7 files
[BEFORE FIX]  21 passed / 4 FAILED
[AFTER  FIX]  25 passed / 0 failed  ✅
```

### Bugs Found & Fixed

| # | Severity | File | Bug | Fix |
|---|----------|------|-----|-----|
| B-1 | 🔴 Critical | `engine/World.ts` | `VELOCITY_CLAMP=0.1` < `GRAVITY×MAX_DT=0.157` → ball at rest never stops bouncing | Raised to `0.2` |
| B-2 | 🔴 Critical | `engine/World.test.ts` | Bounce test: `y=490,vy=50` — ball travels only 0.8px/step, never reaches floor | Changed initial state to `y=500,vy=5` (starts at floor) |
| B-3 | 🟡 Medium | `graph/GraphEngine.ts` | `canvas.getContext('2d')!` returns `null` in jsdom → crash on `clearRect` | Added `if (!this.ctx) return` guard; changed type to `| null` |
| B-4 | 🟡 Medium | `graph/GraphEngine.test.ts` `integration.test.ts` | No canvas mock in test env → all GraphEngine tests fail | Created `src/test-setup.ts` with full `CanvasRenderingContext2D` mock + added `setupFiles` to `vite.config.ts` |

### Design Observations (carry to Day 2)

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| D-1 | 🟡 Medium | `World.ts` + `WorldCanvas.tsx` | `FLOOR_Y=500` duplicated in two files — shared constant needed |
| D-2 | 🟡 Medium | `DataRecorder.ts` | Only records `x,vx,ax` — `y,vy,ay` absent from pipeline |
| D-3 | 🟡 Medium | `ControlBar.tsx` | `handlePlay` resets recorder but not ball position |
| D-4 | 🟢 Low | `GraphEngine.ts` | `Math.min(...xs)` spread can stack-overflow on very long sessions (>65k pts) |
| D-5 | 🟢 Low | `App.tsx` | `recorder.start()` fires at module load — recording begins before user interaction |
| D-6 | 🟢 Low | `GraphCanvas.tsx` | `setInterval` polls at 32ms even when no new data — no dirty flag |

---

### 🔲 Day 2 — Full Kinematics + Polish

| # | Item | File(s) | Priority |
|---|------|---------|----------|
| 1 | Add `y`, `vy`, `ay` to `SeriesKey` + `DataRecorder` | `recorder/DataRecorder.ts` | 🔴 High |
| 2 | Record `b.y`, `b.vy`, `b.ay` in the rAF loop | `canvas/WorldCanvas.tsx` | 🔴 High |
| 3 | Add `y`, `vy`, `ay` options to `AxisSelector` | `components/AxisSelector.tsx` | 🔴 High |
| 4 | Fix `Play` to reset ball position to (300, 50) | `components/ControlBar.tsx` | 🔴 High |
| 5 | Recording indicator (pulsing dot while active) | `canvas/WorldCanvas.tsx` | 🟡 Medium |
| 6 | Left/right wall collisions | `engine/World.ts` | 🟡 Medium |
| 7 | Data table panel (last 10 rows, live update) | `components/DataTable.tsx` (new) | 🟡 Medium |
| 8 | Export to CSV button | `components/ControlBar.tsx` | 🟢 Low |
| 9 | Gravity slider (1–20 m/s²) | `components/PhysicsControls.tsx` (new) | 🟢 Low |
| 10 | Tests for all Day 2 additions | `*.test.ts` | 🔴 High |

---

## Architecture

```
World.step() → recorder.record() → getSeries() → GraphEngine.draw() → React UI
```

Physics is the **source of truth**. UI never drives simulation.

## Structure

```
src/
  engine/
    Body.ts              ← physics data model
    World.ts             ← Euler integration + collision
    InteractionLayer.ts  ← drag + pause/resume
  recorder/
    DataRecorder.ts      ← in-memory time-series
  graph/
    GraphEngine.ts       ← canvas graph renderer
  canvas/
    WorldCanvas.tsx      ← 60fps rAF loop
    GraphCanvas.tsx      ← 30fps graph refresh
  components/
    ControlBar.tsx       ← Play/Pause/Reset
    AxisSelector.tsx     ← X/Y axis dropdowns
  App.tsx
  integration.test.ts
```

## Use Cases

| UC | Action | Day |
|----|--------|-----|
| UC-1 | Ball drops + bounces under gravity | Day 1 ✅ |
| UC-2 | Pause/Resume simulation | Day 1 ✅ |
| UC-3 | Drag ball to new position | Day 1 ✅ |
| UC-4 | Click canvas to start recording | Day 1 ✅ |
| UC-5 | Switch graph axes (time, x, vx, ax) | Day 1 ✅ |
| UC-6 | Graph y, vy, ay axes | Day 2 🔲 |
| UC-7 | Play resets ball to start position | Day 2 🔲 |
| UC-8 | Export recorded data to CSV | Day 2 🔲 |
