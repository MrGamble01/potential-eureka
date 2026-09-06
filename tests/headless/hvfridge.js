/* HV-31 — the Corner Fridge (classic-script page, no hook needed).
 * A. Constants 15/3/hv-fridge; the 🧊 action row and the fridge2 goal
 *    stand; a fresh camp is counted (flag true) but not seeded.
 * B. Short goodwill refuses — nothing spent, nothing standing.
 * C. A funded build costs exactly 15 goodwill and stands in its own
 *    key; a second build is refused.
 * D. THE LEGACY: Start Over wipes the camp save — the fridge stays.
 *    The fresh camp starts 3 goodwill known, the camp counter ticks,
 *    and a plain reload of the same camp is NOT counted again.
 * E. Two welcomed camps complete the fridge2 goal.
 * F. A corner with no fridge starts bare — nothing granted.
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
    if (!sessionStorage.getItem('hvfridge-init')) {
      sessionStorage.setItem('hvfridge-init', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-fridge');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => ({
    cost: FRIDGE_COST, seed: FRIDGE_SEED, key: FRIDGE_KEY,
    row: ACTIONS.some(a => a.id === 'fridge'),
    goal: GOALS.some(g => g.id === 'fridge2'),
    counted: G.fridgeSeeded === true,
    goodwill: G.goodwill, stored: localStorage.getItem('hv-fridge'),
  }));
  ok(fresh.cost === 15 && fresh.seed === 3 && fresh.key === 'hv-fridge'
    && fresh.row && fresh.goal,
    '15 goodwill, 3 seeded, hv-fridge — the 🧊 row and the fridge2 goal stand');
  ok(fresh.counted && fresh.goodwill === 0 && !fresh.stored,
    'a fresh camp is counted but not seeded — no fridge hums yet');

  // B — the refusal
  const broke = await t(() => {
    G.goodwill = 5;
    finishAction({ id: 'fridge' });
    return { goodwill: G.goodwill, stored: localStorage.getItem('hv-fridge') };
  });
  ok(broke.goodwill === 5 && !broke.stored, 'short goodwill refuses — nothing spent');

  // C — the build
  const built = await t(() => {
    G.goodwill = 20;
    finishAction({ id: 'fridge' });
    const one = { goodwill: G.goodwill, f: loadFridge() };
    finishAction({ id: 'fridge' });
    return { one, doubled: G.goodwill };
  });
  ok(built.one.goodwill === 5 && built.one.f.built && built.one.f.camps === 0,
    'a funded build costs exactly 15 goodwill and stands in its own key');
  ok(built.doubled === 5, 'a second build is refused — the corner needs one');

  // D — the legacy across Start Over
  await page.evaluate(() => {
    const real = Storage.prototype.setItem.bind(localStorage);
    localStorage.removeItem('homeless_village_v1');
    Storage.prototype.setItem = function (k, v) { if (k === 'homeless_village_v1') return; real(k, v); };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const reborn = await t(() => ({
    days: G.days, goodwill: G.goodwill, counted: G.fridgeSeeded === true,
    camps: loadFridge().camps,
  }));
  ok(reborn.days === 0 && reborn.goodwill === 3 && reborn.counted && reborn.camps === 1,
    'Start Over cannot unplug it — the fresh camp starts 3 goodwill known, the counter ticks');
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const again = await t(() => ({ goodwill: G.goodwill, camps: loadFridge().camps }));
  ok(again.goodwill === 3 && again.camps === 1,
    'a plain reload of the same camp is not counted again');

  // E — the goal
  const goal = await t(() => {
    saveFridge({ built: true, camps: 2 });
    const g = GOALS.find(x => x.id === 'fridge2');
    return { v: g.value(), target: g.target };
  });
  ok(goal.v === 2 && goal.v >= goal.target, 'two welcomed camps complete the fridge2 goal');

  // F — the bare corner
  await page.evaluate(() => {
    const real = Storage.prototype.setItem.bind(localStorage);
    localStorage.removeItem('homeless_village_v1');
    localStorage.removeItem('hv-fridge');
    Storage.prototype.setItem = function (k, v) { if (k === 'homeless_village_v1' || k === 'hv-fridge') return; real(k, v); };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const bare = await t(() => ({
    goodwill: G.goodwill, f: loadFridge(), counted: G.fridgeSeeded === true,
  }));
  ok(bare.goodwill === 0 && !bare.f.built && bare.f.camps === 0 && bare.counted,
    'a corner that never got one starts bare');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
