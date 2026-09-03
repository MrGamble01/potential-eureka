/* INSIGHTS-1 — a hidden tab is not time played.
 *
 * Telemetry.flush() banks the open session's seconds and then restarts its
 * clock (`current.startedAt = Date.now()`). It runs on view switches AND on
 * `visibilitychange` → hidden, which is right — but nothing restarted the
 * clock on the way back, so the whole stretch the tab spent hidden was still
 * on the meter and got banked by the next flush. Open Snake, switch tabs for
 * an hour, come back: the arcade credited an hour of Snake it never saw, and
 * "played", the favourite game, the busiest day and the day streak all moved.
 *
 *  A. Playing with the tab visible accrues, as it always did.
 *  B. Time up to the moment of the hide is banked (flush still runs on hide).
 *  C. Time spent hidden is NOT banked — neither into the game's seconds nor
 *     into today's total, which is what the day streak reads.
 *  D. The clock restarts rather than stopping: play after coming back counts.
 *  E. Zero page errors.
 *
 * Headless Chromium reports every page as visible, so the tab-hide is driven
 * by the two things the module actually reads — document.visibilityState and
 * the visibilitychange event. Nothing is stubbed inside the product.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const setHidden = (page, hidden) => page.evaluate(h => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);
const stats = page => page.evaluate(() => JSON.parse(localStorage.getItem('eureka-stats') || '{}'));
const go = async (page, hash) => {
  await page.evaluate(h => { location.hash = h; }, hash);
  await page.waitForTimeout(500);
};

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await (await browser.newContext()).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));

  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  const today = await page.evaluate(() => Utils.todayKey());

  // ---- A/B. two seconds of real play, then the tab goes away.
  await go(page, '#snake');
  await page.waitForTimeout(2000);
  await setHidden(page, true);
  await page.waitForTimeout(200);

  const atHide = await stats(page);
  const playedSecs = atHide.seconds.snake || 0;
  ok(playedSecs >= 2 && playedSecs <= 4, `the visible seconds are banked on the hide (${playedSecs}s)`);
  ok((atHide.days[today] || 0) === playedSecs, `today's total matches (${atHide.days[today]}s)`);

  // ---- C. six seconds with the tab hidden, then back and on to the hub.
  await page.waitForTimeout(6000);
  await setHidden(page, false);
  await page.waitForTimeout(200);
  await go(page, '#arcade');

  const after = await stats(page);
  ok((after.seconds.snake || 0) === playedSecs,
    `the hidden stretch is not time played (${playedSecs}s before, ${after.seconds.snake || 0}s after 6s hidden)`);
  ok((after.days[today] || 0) === playedSecs,
    `and it does not land in today's total either (${after.days[today]}s)`);

  // ---- D. the clock restarted — it was not stopped for good.
  await go(page, '#tetris');
  await page.waitForTimeout(2500);
  await go(page, '#arcade');
  const resumed = await stats(page);
  ok((resumed.seconds.tetris || 0) >= 2,
    `play after coming back still counts (${resumed.seconds.tetris || 0}s of Tetris)`);
  ok((resumed.days[today] || 0) >= playedSecs + 2,
    `and reaches today's total (${resumed.days[today]}s)`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
