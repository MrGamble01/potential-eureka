/* VOX-16 — the Ferry Landing (one-shot, classic-script globals).
 * A. Fresh isle: the ⛴️ Ferry Landing in the shop (650 / lvl 6 / kind
 *    ferry), the jetty renders in cubes, Day-Trippers registered, the
 *    how-to bullet is in.
 * B. Winter freezes the crossing: a due timer never docks.
 * C. A green-season docking on a bare isle tips exactly 8 🪙 and
 *    ticks the tally; the timer re-arms 120–240s.
 * D. The tips scale with the decor — 5 pieces tip 18, a gallery caps
 *    at 40.
 * E. Five crossings crown Day-Trippers; the tally rides the save and
 *    a legacy save migrates clean.
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
    if (!sessionStorage.getItem('voxferry-init')) {
      sessionStorage.setItem('voxferry-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => {
    const d = BUILDINGS.ferry;
    return { def: d ? { cost: d.cost, lvl: d.lvl, kind: d.kind } : null,
      cubes: ferryCubes(BUILDINGS.ferry).length,
      ach: ACH.some(a => a[0] === 'ferry5'),
      howto: document.body.innerHTML.includes('Ferry Landing</b> (level 6)') };
  });
  ok(fresh.def && fresh.def.cost === 650 && fresh.def.lvl === 6 && fresh.def.kind === 'ferry'
    && fresh.cubes >= 9, 'the ⛴️ Ferry Landing is in the shop (650 / lvl 6) and the jetty renders');
  ok(fresh.ach && fresh.howto, 'Day-Trippers registered; the how-to bullet is in');

  // find a winter day and a summer day
  const days = await t(() => {
    let w = 0, s = 0;
    for (let d = 1; d < 40 && !(w && s); d++) {
      const k = seasonOf(d).key;
      if (!w && k === 'winter') w = d;
      if (!s && k === 'summer') s = d;
    }
    return { w, s };
  });

  // B — winter freezes the crossing
  const frozen = await t(d => {
    state.buildings = state.buildings || {};
    state.buildings.ferry = { x: 5, z: 5 };
    state.coins = 500;
    state.day = d.w;
    ferryNextT = 0.01;
    updateFerry(0.05);
    return { coins: state.coins, visits: state.ferryVisits || 0, timer: ferryNextT };
  }, days);
  ok(frozen.coins === 500 && frozen.visits === 0, 'winter freezes the crossing — a due timer never docks');

  // C — the bare-isle docking
  const docked = await t(d => {
    state.day = d.s;
    ferryNextT = 0.01;
    updateFerry(0.05);
    return { coins: state.coins, visits: state.ferryVisits, timer: ferryNextT, pay0: ferryPay() };
  }, days);
  ok(docked.pay0 === 8 && docked.coins === 508 && docked.visits === 1,
    'a green-season docking on a bare isle tips exactly 8 🪙');
  ok(docked.timer >= 100 && docked.timer <= 240, 'the timer re-arms 120–240s');

  // D — the tips scale with the decor
  const scaled = await t(() => {
    const real = decorCount;
    decorCount = () => 5;
    const five = ferryPay();
    decorCount = () => 99;
    const gallery = ferryPay();
    decorCount = real;
    return { five, gallery };
  });
  ok(scaled.five === 18 && scaled.gallery === 40, '5 pieces tip 18; a gallery caps at 40');

  // E — the crown + persistence
  const crowned = await t(() => {
    state.ferryVisits = 5;
    return ACH.find(a => a[0] === 'ferry5')[3]();
  });
  ok(crowned, 'five crossings crown Day-Trippers');
  await t(() => save());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const back = await t(() => ({ visits: state.ferryVisits, built: ferryBuilt() }));
  ok(back.visits === 5 && back.built, 'the tally and the jetty ride the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('voxel-garden-v1'));
    delete sv.state.ferryVisits; delete sv.state.buildings.ferry;
    localStorage.setItem('voxel-garden-v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const legacy = await t(() => ({ visits: state.ferryVisits || 0, built: ferryBuilt() }));
  ok(legacy.visits === 0 && !legacy.built, 'a pre-VOX-16 save migrates clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
