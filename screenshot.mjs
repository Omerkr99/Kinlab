import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 800 });

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

// Screenshot 1 — initial state
await page.screenshot({ path: 'screenshot-initial.png', fullPage: false });

// Click Play
await page.click('button:has-text("Play")');
await page.waitForTimeout(2500);

// Screenshot 2 — simulation running with data
await page.screenshot({ path: 'screenshot-running.png', fullPage: false });

// Change Y axis to vy
await page.selectOption('select >> nth=1', 'vy');
await page.waitForTimeout(800);

// Screenshot 3 — vy graph
await page.screenshot({ path: 'screenshot-vy.png', fullPage: false });

await browser.close();
console.log('done');
