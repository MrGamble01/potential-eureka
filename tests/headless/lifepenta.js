/*
 * Game of Life — Pentadecathlon preset (re-runnable, no hooks).
 * The preset used to be dead code (never wired to a button) and, even
 * loaded directly, wasn't the real period-15 oscillator — it grew
 * without bound instead of returning to its start. This checks the
 * fixed pattern through a real UI flow:
 *  A. the "Pentadecathlon" button exists and loads a 12-cell pattern.
 *  B. stepping 15 generations returns the exact same population.
 *  C. an intermediate generation (8) differs — it isn't a no-op/still life.
 *  D. zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

const popOf = page => page.evaluate(() => +document.getElementById('life-pop').textContent);
const genOf = page => page.evaluate(() => +document.getElementById('life-gen').textContent);

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/index.html#life', { waitUntil: 'load' });
  await page.waitForTimeout(800);

  const presetBtn = page.locator('.life-presets button', { hasText: 'Pentadecathlon' });
  ok(await presetBtn.count() === 1, 'a Pentadecathlon preset button exists');
  await presetBtn.click();
  await page.waitForTimeout(200);

  const pop0 = await popOf(page);
  ok(pop0 === 12, `preset loads its 12 cells (population: ${pop0})`);
  ok(await genOf(page) === 0, 'generation resets to 0 on load');

  const stepBtn = page.locator('.game-controls button', { hasText: 'Step' });
  for (let i = 0; i < 8; i++) { await stepBtn.click(); await page.waitForTimeout(30); }
  const popMid = await popOf(page);
  ok(popMid !== pop0, `generation 8 differs from the start (${popMid} vs ${pop0}) — not a still life`);

  for (let i = 0; i < 7; i++) { await stepBtn.click(); await page.waitForTimeout(30); }
  ok(await genOf(page) === 15, 'reached generation 15');
  ok(await popOf(page) === pop0, `generation 15 restores the starting population (${pop0}) — period-15 oscillator`);

  ok(errs.length === 0, `zero page errors (${errs.length})`);

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
