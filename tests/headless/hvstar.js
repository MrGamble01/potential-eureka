/* HV-38 — the Chalk Star (classic-script page, no hook).
 * A. Constants hv-plaque/3/+3 food; the star3 goal stands; a wiped
 *    wall wears no star.
 * B. THE SEAM: with 3 beaten holds standing, the next beaten hold
 *    feeds the camp — beats 4, cheers 1, +3 food on the spot.
 * C. A starless wall (1 beat standing) rings dry — beats 2, no
 *    cheer, no groceries.
 * D. Three cheers complete the star3 goal.
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
    if (!sessionStorage.getItem('hvstar-init')) {
      sessionStorage.setItem('hvstar-init', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-plaque');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — the constants and the bare wall
  const fresh = await t(() => ({
    key: HVSTAR_KEY, at: HVSTAR_AT, food: HVSTAR_FOOD,
    goal: GOALS.some(g => g.id === 'star3'),
    star: wallHasStar(),
  }));
  ok(fresh.key === 'hv-plaque' && fresh.at === 3 && fresh.food === 3 && fresh.goal,
    'hv-plaque at 3 holds / +3 food — the star3 goal stands');
  ok(!fresh.star, 'a wiped wall wears no chalk star');

  // B — the seam: the story feeds the camp (atomic evaluate)
  const fed = await t(() => {
    saveHvRec({ days: 5, beats: 3 });
    saveHvStar({ cheers: 0 });
    hvRecMark = null; hvRecRung = false;
    G.food = 10;
    recordDays(6);
    return { beats: loadHvRec().beats, cheers: loadHvStar().cheers, food: G.food };
  });
  ok(fed.beats === 4 && fed.cheers === 1,
    `the beaten hold under the star tallies a cheer (beats ${fed.beats}, cheers ${fed.cheers})`);
  ok(fed.food === 13, `neighbors leave groceries: +3 food on the spot (${fed.food})`);

  // C — the starless wall rings dry
  const dry = await t(() => {
    saveHvRec({ days: 8, beats: 1 });
    saveHvStar({ cheers: 0 });
    hvRecMark = null; hvRecRung = false;
    G.food = 10;
    recordDays(9);
    return { beats: loadHvRec().beats, cheers: loadHvStar().cheers, food: G.food };
  });
  ok(dry.beats === 2 && dry.cheers === 0 && dry.food === 10,
    `a starless wall rings the record dry — no cheer, no groceries (${dry.food})`);

  // D — the goal completes
  const goal = await t(() => {
    const g = GOALS.find(x => x.id === 'star3');
    const before = g.value() >= g.target;
    saveHvStar({ cheers: 3 });
    return { before, after: g.value() >= g.target, target: g.target };
  });
  ok(!goal.before && goal.after && goal.target === 3, 'three cheers complete the star3 goal');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
