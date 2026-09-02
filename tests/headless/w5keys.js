/*
 * W5-1 — Word Five keeps its physical keyboard after you leave the view.
 *
 * The shell calls init() once per view but destroy() every time you
 * navigate away, and Word Five's destroy() used to unbind its document
 * keydown handler. Nothing re-bound it, so the first trip out of Word
 * Five left the physical keyboard dead for the rest of the session —
 * the on-screen keys kept working, which made it read as the game
 * ignoring you rather than as a missing listener.
 *
 *  A. Typing works on the first visit.
 *  B. Typing still works after leaving to another view and returning.
 *  C. It survives a second round trip (not just a one-off re-bind).
 *  D. The handler stays inert off-view: letters typed while another
 *     game is on screen never reach Word Five's grid.
 *  E. Zero page errors.
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

  // The letters sitting in the first guess row, uppercased by the tiles.
  // No guess in this suite is ever accepted, so row 0 stays the open row.
  const row0 = () => page.evaluate(() =>
    (document.querySelectorAll('#word5-grid .w5-row')[0] || {}).textContent || '');
  const goto = async name => {
    await page.evaluate(v => { location.hash = v; }, name);
    await page.waitForTimeout(600);
  };
  const activeView = () => page.evaluate(() =>
    (document.querySelector('.view.active') || {}).id || '');

  await page.goto(BASE + '/index.html#word5', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  ok(await activeView() === 'view-word5', 'Word Five is the active view');

  // A — first visit
  await page.keyboard.type('cr', { delay: 40 });
  await page.waitForTimeout(200);
  ok(await row0() === 'CR', `first visit: typing fills the row (got "${await row0()}")`);

  // D — off-view keys must not reach the grid
  await goto('snake');
  ok(await activeView() === 'view-snake', 'navigated away to Snake');
  await page.keyboard.type('xyz', { delay: 40 });
  await page.waitForTimeout(200);

  // B — back again, physical keyboard still live
  await goto('word5');
  ok(await activeView() === 'view-word5', 'navigated back to Word Five');
  ok(await row0() === 'CR', 'letters typed on another view never reached the grid');
  await page.keyboard.type('ane', { delay: 40 });
  await page.waitForTimeout(250);
  ok(await row0() === 'CRANE', `after returning: typing still fills the row (got "${await row0()}")`);

  // Backspace and Enter are on the same handler — prove the whole thing lives.
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(200);
  ok(await row0() === 'CRAN', 'Backspace still works after returning');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const msgTxt = await page.evaluate(() => document.getElementById('word5-msg').textContent);
  ok(/not enough letters/i.test(msgTxt), `Enter still reaches submit() (msg: "${msgTxt}")`);

  // C — a second round trip
  await goto('tetris');
  await goto('word5');
  await page.keyboard.type('e', { delay: 40 });
  await page.waitForTimeout(250);
  ok(await row0() === 'CRANE', `second round trip: typing still works (got "${await row0()}")`);

  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' | ') : ''}`);

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
