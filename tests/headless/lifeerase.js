/*
 * QA — Game of Life right-click erase (re-runnable, no hooks).
 *  A. Left-click paints a cell alive.
 *  B. Right-click on that same cell erases it back to empty.
 *  C. Left-drag paints a run of cells; a right-drag over part of that
 *     run erases just those cells, leaving the rest alive.
 *  D. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

const CELL = 12;

// Sample the fill color at the center of grid cell (r, c), relative to the
// canvas's own backing store (device pixels), so it's correct under any DPR.
const cellColor = (page, r, c) => page.evaluate(([r, c, CELL]) => {
  const canvas = document.getElementById('life-canvas');
  const x = canvas.getContext('2d');
  const COLS = 60; // must match life.js
  const dpr = canvas.width / (COLS * CELL);
  const px = Math.round((c * CELL + CELL / 2) * dpr);
  const py = Math.round((r * CELL + CELL / 2) * dpr);
  const d = x.getImageData(px, py, 1, 1).data;
  return [d[0], d[1], d[2]];
}, [r, c, CELL]);

const isBackground = ([r, g, b]) => r < 40 && g < 40 && b < 45; // '#0d1117' plus grid-line antialiasing
const isAlive = ([r, g, b]) => !isBackground([r, g, b]);

async function clickCell(page, r, c, button) {
  const rect = await page.evaluate(() => {
    const el = document.getElementById('life-canvas');
    const b = el.getBoundingClientRect();
    return { left: b.left, top: b.top };
  });
  const x = rect.left + c * CELL + CELL / 2;
  const y = rect.top + r * CELL + CELL / 2;
  await page.mouse.move(x, y);
  await page.mouse.down({ button });
  await page.mouse.up({ button });
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/index.html#life', { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  // A. left-click paints
  await clickCell(page, 10, 10, 'left');
  await page.waitForTimeout(150);
  ok(isAlive(await cellColor(page, 10, 10)), 'left-click paints a live cell');

  // B. right-click erases the same cell
  await clickCell(page, 10, 10, 'right');
  await page.waitForTimeout(150);
  ok(isBackground(await cellColor(page, 10, 10)), 'right-click erases that cell');

  // C. paint a short run, then erase part of it with a right-drag
  await clickCell(page, 20, 20, 'left');
  await clickCell(page, 20, 21, 'left');
  await clickCell(page, 20, 22, 'left');
  await page.waitForTimeout(150);
  ok(
    isAlive(await cellColor(page, 20, 20)) &&
    isAlive(await cellColor(page, 20, 21)) &&
    isAlive(await cellColor(page, 20, 22)),
    'left-clicks paint a 3-cell run'
  );
  await clickCell(page, 20, 21, 'right');
  await page.waitForTimeout(150);
  const left = await cellColor(page, 20, 20);
  const mid = await cellColor(page, 20, 21);
  const right = await cellColor(page, 20, 22);
  ok(isAlive(left) && isBackground(mid) && isAlive(right), 'right-click erases only the targeted cell, leaving neighbors alive');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
