/**
 * KinLab Comprehensive UI Audit — Playwright
 * node scripts/ui-audit.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:5173';
const OUT  = 'screenshots/audit';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx     = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page    = await ctx.newPage();

let n = 0;
const shot = async (label) => {
  const file = `${OUT}/${String(++n).padStart(2,'0')}-${label}.png`;
  await page.screenshot({ path: file });
  console.log(`📸  ${file}`);
};
const wait = (ms) => new Promise(r => setTimeout(r, ms));
// Force-click (bypasses pointer-event interceptors)
const forceClick = (sel, opts = {}) =>
  page.locator(sel).first().click({ force: true, ...opts });

// ────────────────────────────────────────────────────────────────
// 1. Initial state
// ────────────────────────────────────────────────────────────────
await page.goto(BASE, { waitUntil: 'networkidle' });
await wait(600);
await shot('01-initial-load');
console.log('  DOM canvases:', await page.$$eval('canvas', cs => cs.map(c => `${c.width}×${c.height}`)));

// ────────────────────────────────────────────────────────────────
// 2. Identify the simulation canvas (the big one = CANVAS_W × CANVAS_H)
// ────────────────────────────────────────────────────────────────
const simCanvas = page.locator('canvas').filter({ /* biggest */ }).nth(0);
// Find the large canvas by size
const canvasInfo = await page.$$eval('canvas', cs =>
  cs.map((c, i) => ({ i, w: c.width, h: c.height, rect: JSON.stringify(c.getBoundingClientRect()) }))
);
console.log('  Canvas list:', JSON.stringify(canvasInfo, null, 2));

// The sim canvas will be 600×520 (CANVAS_W × CANVAS_H from constants)
const simIdx = canvasInfo.findIndex(c => c.w === 600);
console.log('  Sim canvas index:', simIdx);
const simCanvasSel = `canvas:nth-of-type(${simIdx + 1})`;

// ────────────────────────────────────────────────────────────────
// 3. Start simulation
// ────────────────────────────────────────────────────────────────
await page.click('button:has-text("Start")');
await wait(1500);
await shot('02-simulation-running');

// ────────────────────────────────────────────────────────────────
// 4. Pause
// ────────────────────────────────────────────────────────────────
await page.click('button:has-text("Pause")');
await wait(300);
await shot('03-paused-time-visible');

// ────────────────────────────────────────────────────────────────
// 5. Tools toolbar — cycle through each tool
// ────────────────────────────────────────────────────────────────
for (const tool of ['Move', 'Force', 'Delete', 'Select']) {
  await page.locator(`button:has-text("${tool}")`).first().click();
  await wait(150);
}
await shot('04-tools-all-present');

// ────────────────────────────────────────────────────────────────
// 6. Click body on sim canvas to open Object Properties
// ────────────────────────────────────────────────────────────────
// Body starts at ~(300, 50) canvas coords → find its page position
const canvasRect = await page.$$eval('canvas', cs => {
  const big = cs.find(c => c.width === 600);
  if (!big) return null;
  const r = big.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
});
console.log('  Sim canvas page rect:', canvasRect);

if (canvasRect) {
  // Body 0 starts at x=300, y=50 in canvas coords
  const clickX = canvasRect.left + 300;
  const clickY = canvasRect.top  + 50;
  await page.mouse.click(clickX, clickY);
  await wait(500);
  await shot('05-body-selected-properties-panel');
} else {
  console.warn('  ⚠️  Could not locate sim canvas rect — skipping body click');
  await shot('05-body-click-skipped');
}

// ────────────────────────────────────────────────────────────────
// 7. Object Properties Panel — check all fields visible
// ────────────────────────────────────────────────────────────────
const propsPanel = page.locator('aside[aria-label="Object Properties"]');
const panelVisible = await propsPanel.count() > 0;
console.log('  Object Properties panel visible:', panelVisible);

if (panelVisible) {
  // Scroll down to see all sections
  await propsPanel.evaluate(el => el.querySelector('div[style*="overflow"]')?.scrollTo(0, 300) || (el.scrollTop = 300));
  await wait(200);
  await shot('06-props-panel-lower-sections');
  await propsPanel.evaluate(el => el.querySelector('div[style*="overflow"]')?.scrollTo(0, 0) || (el.scrollTop = 0));
}

// ────────────────────────────────────────────────────────────────
// 8. Color picker — change color
// ────────────────────────────────────────────────────────────────
const colorPicker = page.locator('aside[aria-label="Object Properties"] input[type="color"]');
if (await colorPicker.count() > 0) {
  await colorPicker.evaluate(el => {
    el.value = '#FF0000';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await wait(400);
  await shot('07-body-color-red');
  // Restore blue
  await colorPicker.evaluate(el => {
    el.value = '#2563EB';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await wait(200);
} else {
  console.warn('  ⚠️  Color picker NOT found in Object Properties');
  await shot('07-color-picker-missing');
}

// ────────────────────────────────────────────────────────────────
// 9. Edit a field (x position)
// ────────────────────────────────────────────────────────────────
const xInput = page.locator('#prop-x');
if (await xInput.count() > 0) {
  await xInput.click();
  await wait(100);
  await xInput.fill('200');
  await xInput.press('Enter');
  await wait(300);
  await shot('08-x-position-edited');
} else {
  console.warn('  ⚠️  #prop-x input not found');
  await shot('08-prop-x-missing');
}

// ────────────────────────────────────────────────────────────────
// 10. Scale selector — cycle through all units
// ────────────────────────────────────────────────────────────────
await page.click('button:has-text("cm")').catch(() => console.warn('  ⚠️  cm button not found'));
await wait(300);
await shot('09-scale-cm');
await page.click('button:has-text("m")').catch(() => console.warn('  ⚠️  m button not found'));
await wait(300);
await shot('10-scale-m');
await page.click('button:has-text("px")').catch(() => console.warn('  ⚠️  px button not found'));
await wait(200);

// ────────────────────────────────────────────────────────────────
// 11. Gravity slider + presets
// ────────────────────────────────────────────────────────────────
await page.click('button:has-text("Moon")').catch(() => console.warn('  ⚠️  Moon preset not found'));
await wait(300);
await shot('11-gravity-moon');
await page.click('button:has-text("Jupiter")').catch(() => console.warn('  ⚠️  Jupiter preset not found'));
await wait(300);
await shot('12-gravity-jupiter');
await page.click('button:has-text("Earth")').catch(() => console.warn('  ⚠️  Earth preset not found'));
await wait(200);

// ────────────────────────────────────────────────────────────────
// 12. Environment settings in left sidebar
// ────────────────────────────────────────────────────────────────
// Switch to Add Object tab first to see if env is there, then Tools
await page.locator('button:has-text("Tools")').first().click().catch(() => {});
await wait(200);

// Find restitution slider
const restitutionSliders = await page.locator('input[type="range"]').all();
console.log('  Range sliders found:', restitutionSliders.length);

// Look for floor toggle specifically
const allLabels = await page.locator('label').allTextContents();
console.log('  Labels in page:', allLabels.filter(t => t.trim()).join(' | '));
await shot('13-environment-settings-visible');

// ────────────────────────────────────────────────────────────────
// 13. Add Object tab — add a rectangle
// ────────────────────────────────────────────────────────────────
await page.locator('button:has-text("Add Object")').first().click().catch(() => {});
await wait(300);
await shot('14-add-object-tab');

// Click Rectangle
await page.locator('text=Rectangle').first().click().catch(async () => {
  console.warn('  ⚠️  Rectangle button not found by text, trying aria-label');
  await page.locator('[aria-label*="Rectangle"]').first().click().catch(() => console.warn('  ⚠️  Rectangle not found'));
});
await wait(500);
await shot('15-rectangle-added');

// ────────────────────────────────────────────────────────────────
// 14. Check body count
// ────────────────────────────────────────────────────────────────
const bodyCountEl = page.locator('text=/Objects\s*\d/').first();
const bodyCount = await bodyCountEl.textContent().catch(() => 'n/a');
console.log('  Body count label:', bodyCount);

// ────────────────────────────────────────────────────────────────
// 15. Play with 2 bodies, record data
// ────────────────────────────────────────────────────────────────
await page.click('button:has-text("Start")').catch(() => {});
await wait(2000);
await shot('16-two-bodies-running');
await page.click('button:has-text("Pause")').catch(() => {});
await wait(300);

// ────────────────────────────────────────────────────────────────
// 16. NavBar tabs — Simulation is default, test all others
// ────────────────────────────────────────────────────────────────
const navTabs = ['Objects', 'Forces', 'Graphs', 'Data Monitor', 'Settings'];
for (const tab of navTabs) {
  const tabBtn = page.locator('header nav button, header button[role="tab"]').filter({ hasText: tab });
  const cnt = await tabBtn.count();
  if (cnt > 0) {
    await tabBtn.first().click();
    await wait(500);
    await shot(`17-nav-${tab.toLowerCase().replace(' ', '-')}`);
  } else {
    console.warn(`  ⚠️  Nav tab "${tab}" not found`);
    await shot(`17-nav-${tab.toLowerCase().replace(' ', '-')}-missing`);
  }
}

// Back to Simulation
const simTab = page.locator('header nav button, header button[role="tab"]').filter({ hasText: 'Simulation' });
if (await simTab.count()) { await simTab.first().click(); await wait(300); }
await shot('18-simulation-tab-restored');

// ────────────────────────────────────────────────────────────────
// 17. Data Monitor bottom panel with data
// ────────────────────────────────────────────────────────────────
await shot('19-data-monitor-with-data');

// Scroll data table up to test ↓ Live chip
const dataTableContainer = page.locator('div').filter({ hasText: /DATA TABLE/ }).locator('div[style*="overflow"]').first();
if (await dataTableContainer.count() > 0) {
  await dataTableContainer.evaluate(el => el.scrollTop = 0);
  await wait(300);
  await shot('20-data-table-scrolled-up-live-chip');
  // Click ↓ Live chip
  const liveChip = page.locator('button:has-text("↓ Live"), button:has-text("Live")');
  if (await liveChip.count() > 0) {
    await liveChip.first().click();
    await wait(200);
    await shot('21-live-chip-clicked');
  } else {
    console.warn('  ⚠️  ↓ Live chip not visible (maybe no data yet)');
  }
}

// ────────────────────────────────────────────────────────────────
// 18. Export CSV
// ────────────────────────────────────────────────────────────────
await page.locator('button[aria-label="Export"], button[title="Export"]').first().click().catch(
  async () => page.locator('header button').filter({ hasText: 'Export' }).first().click().catch(() => console.warn('  ⚠️  Export not found'))
);
await wait(600);
await shot('22-export-csv-toast');

// ────────────────────────────────────────────────────────────────
// 19. Save
// ────────────────────────────────────────────────────────────────
await page.locator('button[aria-label="Save"], button[title="Save"]').first().click().catch(
  async () => page.locator('header button').filter({ hasText: 'Save' }).first().click().catch(() => console.warn('  ⚠️  Save not found'))
);
await wait(600);
await shot('23-save-toast');

// ────────────────────────────────────────────────────────────────
// 20. Load
// ────────────────────────────────────────────────────────────────
await page.locator('button[aria-label="Load"], button[title="Load"]').first().click().catch(
  async () => page.locator('header button').filter({ hasText: 'Load' }).first().click().catch(() => console.warn('  ⚠️  Load not found'))
);
await wait(600);
await shot('24-load-toast');

// ────────────────────────────────────────────────────────────────
// 21. Help modal
// ────────────────────────────────────────────────────────────────
await page.locator('button[aria-label="Help"], button[title="Help"]').first().click().catch(
  async () => page.locator('header button').filter({ hasText: 'Help' }).first().click().catch(() => console.warn('  ⚠️  Help not found'))
);
await wait(400);
await shot('25-help-modal-open');
const modalVisible = await page.locator('[role="dialog"]').count() > 0;
console.log('  Help modal visible:', modalVisible);
await page.keyboard.press('Escape');
await wait(200);
await shot('26-help-modal-closed');

// ────────────────────────────────────────────────────────────────
// 22. Dark mode toggle
// ────────────────────────────────────────────────────────────────
await page.locator('button[aria-label="Toggle dark mode"]').first().click().catch(
  async () => page.locator('header button').filter({ hasText: /dark|light/i }).first().click().catch(() => console.warn('  ⚠️  Dark mode toggle not found'))
);
await wait(400);
await shot('27-dark-mode-toggled');
// Toggle back
await page.locator('button[aria-label="Toggle dark mode"]').first().click().catch(() => {});
await wait(300);

// ────────────────────────────────────────────────────────────────
// 23. Delete body via delete tool, verify count drops
// ────────────────────────────────────────────────────────────────
// Switch to Tools sub-tab first (Delete tool lives there)
await page.locator('button[role="tab"]:has-text("Tools")').first().click().catch(() =>
  console.warn('  ⚠️  Could not switch to Tools sub-tab')
);
await wait(200);
// Now click the Delete tool button
const deleteToolBtn = page.locator('button[title="Delete"], button:has-text("Delete")');
const deleteBtnCount = await deleteToolBtn.count();
console.log('  Delete buttons found:', deleteBtnCount);
if (deleteBtnCount > 0) {
  await deleteToolBtn.first().click({ force: true }).catch(() => console.warn('  ⚠️  Delete tool click failed'));
  await wait(200);
  if (canvasRect) {
    await page.mouse.click(canvasRect.left + 300, canvasRect.top + 50);
    await wait(400);
  }
} else {
  console.warn('  ⚠️  No Delete button found — skipping');
}
await shot('28-delete-tool-body-removed');

// ────────────────────────────────────────────────────────────────
// 24. Reset
// ────────────────────────────────────────────────────────────────
await page.click('button:has-text("Reset")').catch(() => {});
await wait(300);
await shot('29-after-reset');

// ────────────────────────────────────────────────────────────────
// 25. Sidebar collapse
// ────────────────────────────────────────────────────────────────
const collapseBtn = page.locator('[aria-label="Collapse sidebar"], [aria-label="Expand sidebar"], [aria-label*="Collapse"], button:has-text("‹"), button:has-text("›")').first();
if (await collapseBtn.count()) {
  await collapseBtn.click();
  await wait(300);
  await shot('30-sidebar-collapsed');
  await collapseBtn.click();
  await wait(200);
}

await browser.close();
console.log('\n✅  Audit complete — screenshots in', OUT);
