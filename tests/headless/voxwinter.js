/* VOX-14 — the Winter Market (one-shot, classic-script globals).
 * A. Fresh isle: the market in the shop at 900/lvl 8, the stall
 *    renders, Lantern-Lit registered, the how-to knows it.
 * B. No market → the clock never runs.
 * C. Built but out of season: the stalls stand dark in summer.
 * D. In winter a party skates in: pays exactly 12 + 3 per villager,
 *    tallies the night, rearms 150–250s.
 * E. Five nights crown Lantern-Lit; everything rides the save.
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
    if (!sessionStorage.getItem('voxwinter-init')) {
      sessionStorage.setItem('voxwinter-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => {
    const d = BUILDINGS.wintermarket;
    return { def: d ? { cost: d.cost, lvl: d.lvl, kind: d.kind } : null,
      cubes: wmarketCubes(d).length, built: wintermarketBuilt(),
      ach: ACH.some(a => a[0] === 'wm5'),
      howto: document.body.innerHTML.includes('Winter Market') };
  });
  ok(fresh.def && fresh.def.cost === 900 && fresh.def.lvl === 8 && fresh.def.kind === 'wmarket',
    'the market is in the shop at 900 coins, level 8');
  ok(fresh.cubes >= 8 && !fresh.built && fresh.ach && fresh.howto,
    `the stall renders (${fresh.cubes} cubes); Lantern-Lit registered; the how-to knows it`);

  // B — no market, no clock
  const idle = await t(() => {
    wmNextT = 40;
    updateWinterMarket(10);
    return { t: wmNextT, sales: state.wmSales || 0 };
  });
  ok(idle.t === 40 && idle.sales === 0, 'no market — the clock never runs');

  // C — dark in summer
  const dark = await t(() => {
    state.buildings = state.buildings || {};
    state.buildings.wintermarket = { x: 8, z: 8 };
    let d = state.day;
    while (seasonOf(d).key === 'winter') d++;
    state.day = d;
    wmNextT = 40;
    updateWinterMarket(10);
    return { t: wmNextT, built: wintermarketBuilt(), season: seasonOf(state.day).key };
  });
  ok(dark.built && dark.t === 40 && dark.season !== 'winter',
    `the stalls stand dark out of season (${dark.season})`);

  // D — a winter night
  const night = await t(() => {
    let d = state.day;
    while (seasonOf(d).key !== 'winter') d++;
    state.day = d;
    const pay = wmPay(), crew = W.workers.length;
    const coins = state.coins;
    wmNextT = 0.01;
    updateWinterMarket(0.1);
    return { pay, crew, gained: state.coins - coins, sales: state.wmSales,
      rearmed: wmNextT >= 149 && wmNextT <= 250 };
  });
  ok(night.pay === 12 + 3 * night.crew && night.gained === night.pay,
    `a party skates in for exactly 12 + 3×${night.crew} = ${night.pay} 🪙`);
  ok(night.sales === 1 && night.rearmed, 'the night tallies and the clock rearms 150–250s');

  // E — the crown + persistence
  await t(() => { state.wmSales = 5; checkAch(); save(); });
  const crowned = await t(() => !!(state.ach && state.ach.wm5));
  ok(crowned, 'five nights crown Lantern-Lit');
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const back = await t(() => ({ sales: state.wmSales, built: wintermarketBuilt(),
    ach: !!(state.ach && state.ach.wm5) }));
  ok(back.sales === 5 && back.built && back.ach, 'the tally, the market and the crown ride the save');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
