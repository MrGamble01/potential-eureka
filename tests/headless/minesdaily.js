/*
 * MINE-1 — Minefield's daily verdict must not outlive its board.
 *
 * The daily result line lands in the HUD (#mines-status), not in the
 * game-over overlay every other game uses, so nothing retires it on its
 * own. Before the fix it was written once on a daily win and never
 * cleared: New Game, a difficulty switch, even leaving and returning to
 * the view all kept a finished run's clear time glowing beside a board
 * that had nothing to do with it.
 *
 *  A. A fresh visit shows no status line.
 *  B. New Game (the face button) clears a standing result line.
 *  C. A difficulty switch clears it too.
 *  D. Leaving and returning, then starting a new board, clears it.
 *  E. Zero page errors.
 *
 * checkWin()'s write is simulated rather than earned: winning a real
 * board headlessly means solving one, and the clearing contract is what
 * regressed. The simulated text is exactly what checkWin() writes.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

const statusOf = page => page.evaluate(() => {
  const el = document.getElementById('mines-status');
  return el ? el.textContent.trim() : '(missing)';
});
// Stand in for a finished daily run: the same string checkWin() writes.
const fakeWin = page => page.evaluate(() => {
  document.getElementById('mines-status').textContent = "📅 Daily: 12 — new best for today!";
});

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/index.html#minesweeper', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // A. clean slate
  ok(await statusOf(page) === '', 'a fresh visit shows no status line');

  // B. New Game clears a standing result
  await fakeWin(page);
  ok(await statusOf(page) !== '', 'setup: a result line is showing');
  await page.click('#mines-face');
  await page.waitForTimeout(300);
  ok(await statusOf(page) === '', 'New Game clears the daily result line');

  // C. difficulty switch clears it
  await fakeWin(page);
  await page.click('.mines-diff-btn[data-diff="intermediate"]');
  await page.waitForTimeout(300);
  ok(await statusOf(page) === '', 'a difficulty switch clears the daily result line');

  // D. leave, return, new board
  await fakeWin(page);
  await page.evaluate(() => { location.hash = '#arcade'; });
  await page.waitForTimeout(500);
  await page.evaluate(() => { location.hash = '#minesweeper'; });
  await page.waitForTimeout(500);
  await page.click('#mines-face');
  await page.waitForTimeout(300);
  ok(await statusOf(page) === '', 'returning and starting a new board clears it');

  // Housekeeping: leave the difficulty as we found it.
  await page.click('.mines-diff-btn[data-diff="beginner"]');
  await page.waitForTimeout(200);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
