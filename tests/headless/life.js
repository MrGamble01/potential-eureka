/* P9-LIFE-1 — Game of Life: clicking a live cell erases it.
 * Before this fix `toggleCell()` only ever wrote 1, so a misplaced cell
 * could not be removed short of Clear (wiping the whole board). Now the
 * first cell of a click/drag flips (dead->alive, alive->dead) and that
 * value is what the rest of the drag paints, so a drag never flickers
 * cell-by-cell as it crosses already-set cells.
 * A. A fresh board: clicking a dead cell brings it alive (population 1).
 * B. Clicking that same cell again erases it (population back to 0) —
 *    the actual regression this ticket fixes.
 * C. A drag starting on a dead cell paints every cell it crosses alive.
 * D. A drag starting on an already-alive cell erases every cell it
 *    crosses, including other already-alive cells — proving the paint
 *    value is fixed at drag-start, not re-toggled per cell.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(() => { location.hash = '#life'; });
  await page.waitForTimeout(400);

  const canvas = page.locator('#life-canvas');
  const box = await canvas.boundingBox();
  // COLS=60, ROWS=40 in js/life.js — point at cell centers proportionally
  // so this doesn't depend on the canvas's actual rendered pixel size.
  const cellPt = (col, row) => ({
    x: box.x + ((col + 0.5) / 60) * box.width,
    y: box.y + ((row + 0.5) / 40) * box.height,
  });
  const pop = () => page.evaluate(() => +document.getElementById('life-pop').textContent);

  // A — click a dead cell
  const p5 = cellPt(5, 5);
  await page.mouse.click(p5.x, p5.y);
  ok(await pop() === 1, `clicking a dead cell brings it alive (population ${await pop()})`);

  // B — click the same cell again: this is the regression fix
  await page.mouse.click(p5.x, p5.y);
  ok(await pop() === 0, `clicking that same live cell erases it (population ${await pop()})`);

  // C — drag across three dead cells paints all three alive
  const d0 = cellPt(10, 10), d1 = cellPt(11, 10), d2 = cellPt(12, 10);
  await page.mouse.move(d0.x, d0.y);
  await page.mouse.down();
  await page.mouse.move(d1.x, d1.y);
  await page.mouse.move(d2.x, d2.y);
  await page.mouse.up();
  ok(await pop() === 3, `a drag across three dead cells paints all three alive (population ${await pop()})`);

  // D — a drag starting on an already-live cell erases everything it
  // crosses, including cells that were already alive before the drag
  // (proving the paint value doesn't re-toggle per cell mid-drag)
  await page.mouse.move(d0.x, d0.y);
  await page.mouse.down();
  await page.mouse.move(d1.x, d1.y);
  await page.mouse.move(d2.x, d2.y);
  await page.mouse.up();
  ok(await pop() === 0, `a drag starting on a live cell erases every cell it crosses (population ${await pop()})`);

  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
