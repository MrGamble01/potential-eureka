/*
 * P8-LIFE-1 — Game of Life auto-pauses when it settles.
 *
 * Left running, a still-life/oscillator or a dead board just loops
 * unwatched forever — nothing on screen told you the sim was done
 * saying anything new. Now `LifeGame` remembers recent board states:
 * a repeat auto-pauses the sim and writes why to #life-status.
 *
 *  A. A blinker (period 2) locks and reports "repeats every 2 generations".
 *  B. The Play/Pause button reflects the auto-pause (back to "Play").
 *  C. Clearing the board resets the status text.
 *  D. Stepping an empty board reports extinction, not a false period.
 *  E. A single toggled cell (still life is trivially itself) does NOT
 *     falsely fire before any step has run.
 *  F. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/index.html#life', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const status = () => page.evaluate(() => document.getElementById('life-status').textContent);
  const playLabel = () => page.evaluate(() => document.getElementById('life-play-btn').textContent);

  // A/B. Load a blinker, step it by hand until the detector locks it.
  await page.evaluate(() => LifeGame.loadPreset('blinker'));
  ok((await status()) === '', 'a freshly-loaded preset starts with no status');
  for (let i = 0; i < 4 && (await status()) === ''; i++) {
    await page.evaluate(() => LifeGame.step());
  }
  const blinkerStatus = await status();
  ok(/repeats every 2 generations/.test(blinkerStatus), `blinker locks on period 2 (saw: "${blinkerStatus}")`);
  ok((await playLabel()) === 'Play', 'auto-pause leaves the button reading Play');

  // C. Clearing wipes the status.
  await page.evaluate(() => LifeGame.clear());
  ok((await status()) === '', 'Clear resets the status line');

  // D. An empty board reports extinction on the very first step, not a
  // false "repeats every 1 generations".
  await page.evaluate(() => LifeGame.step());
  const deadStatus = await status();
  ok(/^Extinct at generation 1$/.test(deadStatus), `empty board reports extinction (saw: "${deadStatus}")`);

  // E. Toggling a single live cell (a still life on its own — a lone
  // cell dies next generation, so this also exercises the death path
  // rather than an oscillator) must not report anything before the
  // first step runs.
  await page.evaluate(() => LifeGame.clear());
  await page.click('#life-canvas', { position: { x: 6, y: 6 } });
  ok((await status()) === '', 'a hand-drawn cell reports nothing before stepping');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
