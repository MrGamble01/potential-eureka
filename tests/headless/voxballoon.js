/* VOX-12 — Balloon Tours (one-shot, classic-script globals).
 * A. Fresh isle: the balloon in the shop at 1800/lvl 10, the canopy
 *    renders, Head in the Clouds registered, the how-to knows it.
 * B. No balloon → the tour clock never runs.
 * C. Moored but grounded: rain and winter both lash the basket down.
 * D. A clear day lifts a tour: tips = 10 + 3 per building standing,
 *    the tally counts, the clock rearms to 180–300s.
 * E. Five tours crown Head in the Clouds; everything rides the save.
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
    if (!sessionStorage.getItem('voxballoon-init')) {
      sessionStorage.setItem('voxballoon-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => {
    const d = BUILDINGS.balloon;
    return { def: d ? { cost: d.cost, lvl: d.lvl, kind: d.kind } : null,
      cubes: balloonCubes(d).length, built: balloonBuilt(), pay: tourPay(),
      ach: ACH.some(a => a[0] === 'tours5'),
      howto: document.body.innerHTML.includes('Balloon Tours') };
  });
  ok(fresh.def && fresh.def.cost === 1800 && fresh.def.lvl === 10 && fresh.def.kind === 'balloon',
    'the balloon is in the shop at 1800 coins, level 10');
  ok(fresh.cubes >= 7 && !fresh.built && fresh.ach && fresh.howto,
    `the canopy renders (${fresh.cubes} cubes); Head in the Clouds registered; the how-to knows it`);
  ok(fresh.pay === 10, 'an empty isle tips the base 10');

  // B — no balloon, no clock
  const idle = await t(() => {
    tourNextT = 50;
    updateTours(10);
    return { t: tourNextT, tours: state.tours || 0 };
  });
  ok(idle.t === 50 && idle.tours === 0, 'no balloon — the tour clock never runs');

  // C — moored but grounded
  const grounded = await t(() => {
    state.buildings = state.buildings || {};
    state.buildings.balloon = { x: 8, z: 8 };
    let d = state.day;
    while (seasonOf(d).key === 'winter') d++;
    state.day = d;
    tourNextT = 50;
    rainActive = true;
    updateTours(10);
    const rain = tourNextT;
    rainActive = false;
    let wd = state.day;
    while (seasonOf(wd).key !== 'winter') wd++;
    state.day = wd;
    updateTours(10);
    const winter = tourNextT;
    while (seasonOf(state.day).key === 'winter') state.day++;
    return { rain, winter, built: balloonBuilt() };
  });
  ok(grounded.built && grounded.rain === 50 && grounded.winter === 50,
    'rain and winter both lash the basket down');

  // D — a clear day lifts a tour
  const flew = await t(() => {
    state.buildings.vane = { x: 4, z: 4 };   // something to see
    const pay = tourPay();
    const coins = state.coins;
    tourNextT = 0.01;
    updateTours(0.1);
    return { pay, gained: state.coins - coins, tours: state.tours,
      rearmed: tourNextT >= 179 && tourNextT <= 300 };
  });
  ok(flew.pay === 16 && flew.gained === 16,
    'tips = 10 + 3 per building standing (16 with balloon + vane)');
  ok(flew.tours === 1 && flew.rearmed, 'the tally counts and the clock rearms to 180–300s');

  // E — the crown + persistence
  await t(() => { state.tours = 5; checkAch(); save(); });
  const crowned = await t(() => !!(state.ach && state.ach.tours5));
  ok(crowned, 'five tours crown Head in the Clouds');
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const back = await t(() => ({ tours: state.tours, built: balloonBuilt(),
    ach: !!(state.ach && state.ach.tours5) }));
  ok(back.tours === 5 && back.built && back.ach, 'the tally, the balloon and the crown ride the save');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
