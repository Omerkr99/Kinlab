# KinLab — Changelog & Patch Notes

> פרויקט סימולציית פיזיקה אינטראקטיבית — React 18 + TypeScript + Vite + Vitest
> Repository: https://github.com/Omerkr99/Kinlab

---

## [v0.4.0] — PhysicsScale (Unit System)
**commit `70787b5`** | גרסה לפני Day 4

### פיצ'רים חדשים
- **`src/units/PhysicsScale.ts`** — שכבת מידה פיזיקלית (display-only):
  - יחידות: `px` (1:1), `cm` (10px=1cm), `m` (100px=1m), `custom`
  - פונקציות: `pxToUnit`, `unitToPx`, `axisLabel`, `dropdownLabel`, `fmtUnit`
  - המרת כבידה: `gravityMs2ToEngine`, `gravityEngineToDisplay`, `gravitySliderMax/Step`
  - פריסטים כוכביים: 🚀 Zero / 🌙 Moon 1.6 / 🌍 Earth 9.8 / 🪐 Jupiter 24.8 m/s²
- **`ScaleControl.tsx`** — בורר יחידות בממשק: px / cm / m / custom… עם שדות מותאמים אישית
- **GraphEngine** — ציר X/Y עם תוויות יחידה + ערכי min/max, המרה אוטומטית
- **GravitySlider** — מוצג ביחידות הפיזיקליות הנוכחיות (m/s² / cm/s²)
- **WorldCanvas** — סרגל מידה על הקנבס (מוסתר במצב px)
- **DataTable** — כותרות עמודות דינמיות (`x (m)`, `vx (m/s)`…) + המרת ערכים
- **CsvExportButton** — כותרת CSV עם יחידות, ערכים מומרים
- **AxisSelector** — תוויות drop-down מותאמות לסקאלה הנוכחית
- **App.tsx** — `scale` state + `ScaleControl` בממשק + שמירת כבידה ב-SI בעת החלפת סקאלה

### בדיקות שנוספו
- `src/units/PhysicsScale.test.ts` — 25 בדיקות: presets, round-trips, labels, gravity math, calibration

### תיקונים
- test: תיקון assertion שגוי בבדיקת cross-scale (0.1m ≠ 1m — סקאלות שונות הן עולמות פיזיקליים שונים)
- test: עדכון header של CSV לפורמט עם יחידות

---

## [v0.3.1] — Day 4 Readiness (Stress Tests)
**commit `9b085af`** | מצב: Pre-Day-4

### בדיקות שנוספו — `src/readiness.test.ts` (49 בדיקות, 9 קטגוריות)
| קטגוריה | מה נבדק |
|---|---|
| Multi-body wall stress | 20 גופים×5k steps, 50 גופים ללא NaN, עצמאות גופים |
| Energy bookkeeping | DAMPING=0.7, WALL_DAMPING=0.8, KE→0 |
| Long session / memory | 36k steps ללא NaN, 200k samples, 500 reset cycles |
| CSV at scale | 10k–50k שורות, ללא NaN/Infinity, זמן מונוטוני |
| BroadcastChannel payload | structuredClone 7×100k arrays |
| Gravity extremes | g=30/0/-9.8, 100 החלפות מהירות |
| Wall damping invariants | vx=5000, guard כפל-flip, דטרמיניזם |
| Multi-recorder pipeline | 5 גופים×5 recorders, CSV integrity |
| Day-4 API surface | addBody mid-sim, empty world, stop() freezes |

---

## [v0.3.0] — Day 3 Complete (KAN-41..45)
**commit `2afc508`** | 131 בדיקות ✅

### פיצ'רים חדשים
- **KAN-41** — `ControlBar` — מחוון הקלטה חי: `● REC` (אדום) / `‖ PAUSED` (כחול) / `IDLE` (אפור)
- **KAN-42** — **Wall collisions** — כדור ניתר משמאל/ימין:
  - גבולות: `WALL_L = BALL_RADIUS (20px)`, `WALL_R = CANVAS_W - BALL_RADIUS (580px)`
  - `WALL_DAMPING = 0.8` (שמירת אנרגיה לכל ניתור)
  - guard: מניעת היפוך כפול (רק אם הכדור נע לכיוון הקיר)
- **KAN-43** — `DataTable.tsx` — טבלת נתונים חיה עם scroll, מתקפלת (150 שורות אחרונות)
- **KAN-44** — `CsvExportButton.tsx` — ייצוא נתונים ל-CSV (7 עמודות, 6 ספרות עשרוניות)
- **KAN-45** — `GravitySlider.tsx` — סליידר כבידה 0–30 px/s² + כפתורי כוכבי לכת
- **Day3Panel.tsx** — פאנל דמו המציג ניתורי קיר, מיני-גרפים, מונה bounces
- **GraphPopup.tsx** — חלון גרף נפרד (`?popup=true`) עם BroadcastChannel sync
- **GraphCanvas** — כפתור "⤢ Pop out" לפתיחת גרף בחלון עצמאי

### תיקוני Day 3
- test: גבולות loop הורחבו ל-4000 steps לאחר גילוי שבאוס ראשון מגיע ב-step ~599
- test: `vx: -100` (לא +100) לבדיקת ניתור קיר שמאלי
- load test: threshold "30 frames" הועלה מ-30ms ל-60ms (CPU contention בריצה מקבילית)

---

## [v0.2.2] — Stress & Reliability Suite
**commit `7c54495`** | 103 בדיקות ✅

### תיקוני engine
- **`[KAN-38]`** `World.ts`: `dt<0` לא התקבל — תוקן: `Math.min(Math.max(dt,0), MAX_DT)`
- **`[KAN-39]`** `World.ts`: rest-skip עם `b.y >= FLOOR_Y` לכד גופים מתחת לרצפה — תוקן ל-`b.y === FLOOR_Y`

### בדיקות שנוספו — `src/stress-reliability.test.ts` (41 בדיקות)
פיזיקה בקנה מידה גדול, invariants, דטרמיניזם ×10, bouncing stability

---

## [v0.2.1] — Data Integrity (Physical Coordinates)
**commit `a5fb005` / `be32fb3`** | 103 בדיקות ✅

### שינויים מרכזיים
- **מוסכמת קואורדינטות פיזיקלית**: `y_phys = FLOOR_Y − canvas_y` (רצפה=0, למעלה=חיובי)
  - `vy_phys = −vy_canvas`, `ay_phys = −ay_canvas`
  - `DataRecorder` מקבל ערכים פיזיקליים (לא canvas coords)
- **Y-flip toggle** על הגרף: כפתורי ↑/↓ להחלפת מוסכמת הצגה
- חיצי כיוון Y הועברו ל-overlay על הגרף עצמו (לא מחוץ לו)
- 22 בדיקות כיווניות חדשות

### בדיקות שנוספו
- בדיקות ל-`vy`, `ay` (כיוון פיזיקלי נכון), הקלטה מלאה של 7 series

---

## [v0.2.0] — Day 2 Complete (KAN-31..36)
**commit `d4cdc9e`** | 40 בדיקות ✅

### פיצ'רים חדשים
- **`[KAN-31]`** `constants.ts` — קובץ קבועים משותף (`FLOOR_Y`, `CANVAS_W`, `BALL_RADIUS`, `GRAVITY`, `WALL_L`, `WALL_R`, `WALL_DAMPING`)
- **`[KAN-32]`** `DataRecorder` — הורחב ל-7 series: `time, x, y, vx, vy, ax, ay`
- **`[KAN-33]`** `ControlBar` — Play מאפס גם את מיקום הכדור (לא רק את ה-recorder)
- **`[KAN-34]`** `GraphEngine` — `reduce` במקום `spread` (מניעת stack overflow מעל 65k נקודות)
- **`[KAN-35]`** `App.tsx` — `recorder.start()` הוסר מרמת ה-module (לא מתחיל לפני לחיצת Play)
- **`[KAN-36]`** `GraphCanvas` — polling רק כשיש שינוי בנתונים (השוואת `lastLenRef`)
- **`DemoPanel.tsx`** (Day 2) — פאנל דמו המציג את כל פיצ'רי Day 2

### Load Tests — `src/load.test.ts` (14 בדיקות)
| בדיקה | תוצאה |
|---|---|
| 1 body × 10k steps | 2.72ms (budget 50ms) |
| 10 bodies × 10k | 4.61ms (budget 200ms) |
| throughput | 57.8M steps/sec |
| 100k samples record | 10.46ms |
| getSeries × 7 on 100k | 5.98ms |
| draw 10k pts | 8.82ms |

---

## [v0.1.0] — Day 1 Complete (Scaffold)
**commit `f009035`** | 11 בדיקות ✅

### תשתית
- **Vite 5 + React 18 + TypeScript 5** — סביבת פיתוח
- **Vitest 2 + jsdom** — סביבת בדיקות עם canvas mock
- מבנה תיקיות: `src/engine`, `src/recorder`, `src/graph`, `src/canvas`, `src/components`
- `tsconfig.json` — strict mode (noImplicitAny, strictNullChecks)

### מנוע פיזיקה (`src/engine/`)
- **`Body.ts`** — BodyState interface + Body class (x, y, vx, vy, ax, ay)
- **`World.ts`** — Euler integration + gravity + floor collision + DAMPING=0.7 + FRICTION=0.85
- **`InteractionLayer.ts`** — drag (startDrag/updateDrag/endDrag) + pause/resume
- **`index.ts`** — barrel export

### ממשק (`src/canvas/`, `src/components/`)
- **`WorldCanvas.tsx`** — לולאת `requestAnimationFrame` 60FPS + ציור כדור + וקטור מהירות
- **`GraphEngine.ts`** — ציור גרף על canvas (grid, axes, data)
- **`GraphCanvas.tsx`** — wrapper ל-GraphEngine עם polling 32ms
- **`ControlBar.tsx`** — כפתורי Play / Pause / Stop / Reset
- **`AxisSelector.tsx`** — בחירת ציר X/Y לגרף
- **`App.tsx`** — הרכבה ראשית של כל הרכיבים

### DataRecorder (`src/recorder/`)
- **`DataRecorder.ts`** — הקלטת time-series: start/stop/reset/record/getSeries

---

## [v0.4.1] — Day 4 Complete (KAN-12)
**commit `0ded395`** | 273 בדיקות ✅

### מה נעשה
KAN-12 "Day 4 – Determinism test + Phase 2 complete" — עבר ל-Done בג'ירה.

> **Day 4 היה שלב בדיקות טהור** — לא נוספו פיצ'רים חדשים, המטרה הייתה אימות מלא שמנוע הפיזיקה דטרמיניסטי, יציב, ו-Phase 2 מוכן.

### בדיקות שנוספו/שודרגו

**`src/engine/determinism.test.ts`** — שודרג מ-1 ל-21 בדיקות:

| קטגוריה | בדיקות |
|---|---|
| Basic | 200-step, 1000-step, time precision |
| Wall bounces | vx=300, vx=5000 קיצוני, כדור בקצה |
| Multi-body | 5 גופים, 10 גופים עם כבידת ירח |
| Gravity switches | החלפה live ב-step 100, g=0→9.8 |
| InteractionLayer | pause/resume, drag state |
| Large-scale | 10,000 steps, drift-check 36,000 steps |

**`src/day4.test.ts`** — קובץ חדש, 64 בדיקות:

| קטגוריה | נושא |
|---|---|
| Barrel (T4.2) | `Body`, `World`, `InteractionLayer` מיוצאים מ-`engine/index` |
| Body | defaults, partial init, 6 fields |
| Euler math | vy=g×dt, ax תורם, זמן מצטבר |
| Gravity | ברירת מחדל, g=0, writable, כוכבי לכת, dt=0/שלילי/clamp |
| Floor collision | נפילה חופשית, bounce, DAMPING=0.7, מנוחה, rest-skip guard |
| Wall collision | ניתור שמאל/ימין, guard כפל-flip, גבולות x, WALL_DAMPING |
| Velocity clamp | vy קטן → אפס, KE=0 במנוחה |
| InteractionLayer | pause/resume, drag API, no-op |
| Multi-body | עצמאות, addBody mid-sim, 10 גופים ללא NaN |
| Pipeline | series length, זמן מונוטוני, y≥0, x בגבולות, reset, gate |

---

## סטטוס נוכחי

| מדד | ערך |
|---|---|
| 🧪 בדיקות | **273 / 273** ✅ |
| 📁 קבצי test | 14 קבצים |
| 🏷️ גרסה | v0.4.1 |
| 🔗 GitHub | `main` branch — commit `0ded395` |
| 📋 Jira | KAN-12 Done · KAN-41..45 Done |
