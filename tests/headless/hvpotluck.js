/* HV-37 — the Potluck (classic-script page, no hook).
 * A. Constants hv-festival/+4/+5; the potluck3 goal stands.
 * B. THE SEAM below the board: a fresh camp at two camps opens
 *    quiet — no potluck, the tally stays.
 * C. THE SEAM at the board: the fresh camp opens to the potluck —
 *    the day tallied, +4 food and +5 morale on the fresh camp.
 * D. Three potlucks complete the goal (tally seeded, next seam
 *    completes).
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
    if (!sessionStorage.getItem('hvpotluck-init')) {
      sessionStorage.setItem('hvpotluck-init', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-letter');
      localStorage.removeItem('hv-history');
      localStorage.removeItem('hv-thermos');
      localStorage.removeItem('hv-festival');
      localStorage.setItem('hv-fridge', JSON.stringify({ built: true, camps: 1 }));
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A + B — camp two: below the board, quiet
  const below = await t(() => ({
    key: POTLUCK_KEY, food: POTLUCK_FOOD, morale: POTLUCK_MORALE,
    goal: GOALS.some(g => g.id === 'potluck3'),
    camps: loadFridge().camps, board: fridgeHasBoard(),
    days: loadPotluck().days, gFood: G.food, gMorale: G.morale,
  }));
  ok(below.key === 'hv-festival' && below.food === 4 && below.morale === 5 && below.goal,
    'hv-festival at +4 food / +5 morale — the potluck3 goal stands');
  ok(below.camps === 2 && !below.board && below.days === 0,
    'a fresh camp below the board opens quiet — the tally stays');

  // C — the seam at the board
  await page.evaluate(() => {
    const real = Storage.prototype.setItem.bind(localStorage);
    localStorage.removeItem('homeless_village_v1');
    Storage.prototype.setItem = function (k, v) { if (k === 'homeless_village_v1') return; real(k, v); };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const potluck = await t(() => ({
    camps: loadFridge().camps, board: fridgeHasBoard(),
    days: loadPotluck().days, food: G.food, morale: G.morale,
  }));
  ok(potluck.camps === 3 && potluck.board && potluck.days === 1,
    'the fresh camp at the board opens to the potluck — the day tallied');
  ok(potluck.food - below.gFood >= 4 && potluck.morale - below.gMorale >= 4,
    `the potluck feeds the fresh camp (+${potluck.food - below.gFood} food, +${potluck.morale - below.gMorale} morale over the quiet boot)`);

  // D — the goal at the next seam
  await page.evaluate(() => {
    savePotluck({ days: 2 });
    localStorage.removeItem('homeless_village_v1');
    const real = Storage.prototype.setItem.bind(localStorage);
    Storage.prototype.setItem = function (k, v) { if (k === 'homeless_village_v1') return; real(k, v); };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const goal = await t(() => {
    const g = GOALS.find(x => x.id === 'potluck3');
    return { days: loadPotluck().days, v: g.value(), target: g.target };
  });
  ok(goal.days === 3 && goal.v >= goal.target, 'the third potluck completes the goal');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
