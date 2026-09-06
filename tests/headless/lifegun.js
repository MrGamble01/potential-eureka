/* LIFE-2 — the Gosper Gun fires; it does not eat itself.
 *
 * countNeighbors() wrapped with `% ROWS` / `% COLS`, so the 60×40
 * board was a torus. A SE-bound glider from the Gosper Gun comes
 * back around and tears the gun apart around generation 180 — the
 * left 2×2 block (the gun's still-life) goes from 4 live cells to 0.
 * The finite-board rule lets those gliders leave instead.
 *
 *  A. Gosper Gun loads at the textbook 36 cells.
 *  B. After two periods (60 gens) it has produced two gliders (pop 46)
 *     and the left 2×2 block is still intact.
 *  C. After 210 gens — past the torus kill — the same block is still
 *     there. A wrap would have zeroed it by gen 210.
 *  D. A glider drawn into the SE corner dies at the edge instead of
 *     reappearing in the NW (the wrap tell). A fix that only *moved*
 *     the gun would pass C and fail this.
 *  E. Blinker still period-2 (the rule itself is still Conway).
 *  Z. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const CELL = 12;
const COLS = 60;

// Sample the fill at the centre of grid cell (r, c) in backing-store pixels.
const cellColor = (page, r, c) => page.evaluate(([r, c, CELL, COLS]) => {
  const canvas = document.getElementById('life-canvas');
  const x = canvas.getContext('2d');
  const dpr = canvas.width / (COLS * CELL);
  const px = Math.round((c * CELL + CELL / 2) * dpr);
  const py = Math.round((r * CELL + CELL / 2) * dpr);
  const d = x.getImageData(px, py, 1, 1).data;
  return [d[0], d[1], d[2]];
}, [r, c, CELL, COLS]);

const isBackground = ([r, g, b]) => r < 40 && g < 40 && b < 45;
const isAlive = (rgb) => !isBackground(rgb);

const pop = (page) => page.evaluate(() =>
  parseInt(document.getElementById('life-pop').textContent, 10));

const stepN = (page, n) => page.evaluate((n) => {
  for (let i = 0; i < n; i++) LifeGame.step();
}, n);

// The gun's left 2×2 still-life, after loadPreset's (+5, +2) offset.
const GUN_BLOCK = [[9, 2], [9, 3], [10, 2], [10, 3]];

const blockLive = async (page) => {
  let n = 0;
  for (const [r, c] of GUN_BLOCK) if (isAlive(await cellColor(page, r, c))) n++;
  return n;
};

async function clickCell(page, r, c) {
  const rect = await page.evaluate(() => {
    const el = document.getElementById('life-canvas');
    const b = el.getBoundingClientRect();
    return { left: b.left, top: b.top, w: b.width, h: b.height };
  });
  const x = rect.left + (c + 0.5) * (rect.w / COLS);
  const y = rect.top + (r + 0.5) * (rect.h / 40);
  await page.mouse.click(x, y);
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.goto(BASE + '/index.html#life', { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  // ---- A. textbook gun ----
  await page.evaluate(() => LifeGame.loadPreset('gliderGun'));
  const p0 = await pop(page);
  ok(p0 === 36, `Gosper Gun loads at 36 cells (got ${p0})`);

  // ---- B. two periods, two gliders, block intact ----
  await stepN(page, 60);
  const p60 = await pop(page);
  const b60 = await blockLive(page);
  ok(p60 === 46, `after 60 gens the gun has produced two gliders (pop ${p60})`);
  ok(b60 === 4, `and the left 2×2 block is still intact (${b60}/4)`);

  // ---- C. past the torus kill ----
  await stepN(page, 150);   // total 210
  const p210 = await pop(page);
  const b210 = await blockLive(page);
  ok(b210 === 4,
    `at gen 210 the gun's still-life is still there (${b210}/4) — wrap would have zeroed it`);
  ok(p210 >= 40 && p210 <= 70,
    `and population is still a living gun, not a wreck (got ${p210})`);

  // ---- D. a glider at the SE corner does not wrap to the NW ----
  await page.evaluate(() => LifeGame.clear());
  // Classic SE glider, parked against the far corner.
  const glider = [[37, 58], [38, 59], [39, 57], [39, 58], [39, 59]];
  for (const [r, c] of glider) await clickCell(page, r, c);
  ok((await pop(page)) === 5, 'SE-corner glider painted (5 cells)');
  await stepN(page, 12);
  let nw = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (isAlive(await cellColor(page, r, c))) nw++;
  ok(nw === 0,
    `SE glider dies at the edge instead of wrapping into the NW (nw occupied ${nw})`);

  // ---- E. blinker still period-2 ----
  await page.evaluate(() => LifeGame.loadPreset('blinker'));
  const blink0 = isAlive(await cellColor(page, 20, 30))
    && isAlive(await cellColor(page, 20, 31))
    && isAlive(await cellColor(page, 20, 32));
  await stepN(page, 1);
  const blink1 = isAlive(await cellColor(page, 19, 31))
    && isAlive(await cellColor(page, 20, 31))
    && isAlive(await cellColor(page, 21, 31));
  await stepN(page, 1);
  const blink2 = isAlive(await cellColor(page, 20, 30))
    && isAlive(await cellColor(page, 20, 31))
    && isAlive(await cellColor(page, 20, 32));
  ok(blink0 && blink1 && blink2,
    'blinker still oscillates period-2 (Conway rules unchanged)');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
