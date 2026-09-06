/* HV-36 — the Bulletin Board (classic-script page, no hook).
 * A. Constants board-at-3 / seed 5; the board3 goal stands; a fridge
 *    at two camps has no board and seeds 3.
 * B. THE SEAM at camp three: the fresh camp seeds 3 (the board goes
 *    up only after the third camp is counted... or with it?) —
 *    asserted exactly: the seed uses the LIVE camp count, so camp
 *    three (counted before seeding) earns the board and seeds 5.
 * C. The goal completes at three camps.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvboard-init')) {
      sessionStorage.setItem('hvboard-init', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-letter');
      localStorage.removeItem('hv-history');
      localStorage.removeItem('hv-thermos');
      localStorage.setItem('hv-fridge', JSON.stringify({ built: true, camps: 1 }));
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — the boot seam counted camp two and seeded 3
  const fresh = await t(() => ({
    at: FRIDGE_BOARD_AT, seed2: FRIDGE_SEED2,
    goal: GOALS.some(g => g.id === 'board3'),
    camps: loadFridge().camps,
    board: fridgeHasBoard(),
    seedNow: fridgeSeedNow(),
  }));
  ok(fresh.at === 3 && fresh.seed2 === 5 && fresh.goal,
    'the board goes up at three camps and seeds 5 — the board3 goal stands');
  ok(fresh.camps === 2 && !fresh.board && fresh.seedNow === 3,
    'camp two formed under a bare fridge — it seeded 3');

  // B — the seam at camp three earns the board and seeds 5
  await page.evaluate(() => {
    const real = Storage.prototype.setItem.bind(localStorage);
    localStorage.removeItem('homeless_village_v1');
    Storage.prototype.setItem = function (k, v) { if (k === 'homeless_village_v1') return; real(k, v); };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const third = await t(() => ({
    camps: loadFridge().camps,
    board: fridgeHasBoard(),
    goodwill: G.goodwill,
  }));
  ok(third.camps === 3 && third.board,
    'camp three raises the count to 3 — the bulletin board goes up with it');
  ok(third.goodwill >= 5,
    `camp three starts 5 goodwill known (${third.goodwill})`);

  // C — the goal
  const goal = await t(() => {
    const g = GOALS.find(x => x.id === 'board3');
    return { v: g.value(), target: g.target };
  });
  ok(goal.v === 3 && goal.v >= goal.target, 'three camps complete the board3 goal');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
