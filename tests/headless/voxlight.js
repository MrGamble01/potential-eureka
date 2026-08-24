/* VOX-9 — the Lighthouse (one-shot, classic-script globals).
 * A. Fresh isle: lighthouse in the shop at 1200/lvl 8, tower cubes render,
 *    Harbormaster registered; without the light, ships never come.
 * B. With the lighthouse up, the timer drops a cargo crate on the pond.
 * C. A crate already afloat makes the freighter wait (re-arm 30s).
 * D. Prying cargo pays exactly 3× the pinned flotsam roll and always
 *    lands a good; both tallies count.
 * E. Winter ices the lanes shut.
 * F. The cargo tally rides the save; the third crate crowns Harbormaster.
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
    if (!sessionStorage.getItem('voxlight-init')) {
      sessionStorage.setItem('voxlight-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => {
    const d = BUILDINGS.lighthouse;
    shipNextT = 5;
    updateShips(1);
    return { def: d ? { cost: d.cost, lvl: d.lvl, kind: d.kind } : null,
      cubes: lightCubes(d).length, built: lighthouseBuilt(),
      idle: shipNextT === 5,
      ach: ACH.some(a => a[0] === 'cargo3') };
  });
  ok(fresh.def && fresh.def.cost === 1200 && fresh.def.lvl === 8 && fresh.def.kind === 'light',
    'the lighthouse is in the shop at 1200 coins, level 8');
  ok(fresh.cubes >= 8, `the tower renders (${fresh.cubes} cubes)`);
  ok(!fresh.built && fresh.idle, 'without the light, ships never come');
  ok(fresh.ach, 'Harbormaster is registered');

  // B — the first freighter
  const dropped = await t(() => {
    state.buildings = state.buildings || {};
    state.buildings.lighthouse = true;
    let d = state.day;
    while (seasonOf(d).key === 'winter') d++;
    state.day = d;                      // open water
    if (flotsam) removeFlotsam();
    shipNextT = 0.1;
    updateShips(0.2);
    return { crate: !!flotsam, cargo: flotsam && flotsam.cargo,
      mesh: flotsam && !!flotsam.mesh, rearm: shipNextT > 100 };
  });
  ok(dropped.crate && dropped.cargo && dropped.mesh && dropped.rearm,
    'the beam brings a freighter — cargo crate on the pond, timer re-armed');

  // C — one crate at a time
  const waited = await t(() => {
    shipNextT = 0.1;
    updateShips(0.2);
    return { rearm: shipNextT === 30, stillCargo: flotsam && flotsam.cargo };
  });
  ok(waited.rearm && waited.stillCargo, 'a crate already afloat makes the next freighter wait 30s');

  // D — freight pays like freight (pinned roll, measured atomically)
  const paid = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    const c0 = state.coins, g0 = Object.values(state.goods || {}).reduce((a, b) => a + b, 0);
    openFlotsam();
    Math.random = real;
    const g1 = Object.values(state.goods || {}).reduce((a, b) => a + b, 0);
    return { coins: state.coins - c0, want: (25 + Math.floor(0.5 * 36)) * 3,
      goods: g1 - g0, cargo: state.cargoOpened, flot: state.flotsamOpened, gone: !flotsam };
  });
  ok(paid.coins === paid.want && paid.gone,
    `cargo pays exactly 3× the roll (+${paid.coins} 🪙)`);
  ok(paid.goods === 1 && paid.cargo === 1 && paid.flot >= 1,
    'a good always rides along; both tallies count');

  // E — winter
  const iced = await t(() => {
    let d = state.day;
    while (seasonOf(d).key !== 'winter') d++;
    const saveDay = state.day;
    state.day = d;
    shipNextT = 0.1;
    updateShips(5);
    const held = shipNextT === 0.1 && !flotsam;
    state.day = saveDay;
    shipNextT = 999;
    return held;
  });
  ok(iced, 'winter ices the lanes shut — the timer never runs');

  // F — persistence + the crown
  await t(() => { state.cargoOpened = 2; save(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const crowned = await t(() => {
    const rode = state.cargoOpened === 2 && lighthouseBuilt();
    let d = state.day;
    while (seasonOf(d).key === 'winter') d++;
    state.day = d;
    if (flotsam) removeFlotsam();
    shipNextT = 0.1; updateShips(0.2);
    if (!flotsam) { shipNextT = 0.1; updateShips(0.2); }
    const real = Math.random; Math.random = () => 0.5;
    openFlotsam();
    Math.random = real;
    shipNextT = 999;
    return { rode, n: state.cargoOpened, ach: !!(state.ach && state.ach.cargo3) };
  });
  ok(crowned.rode, 'the cargo tally and the lighthouse ride the save');
  ok(crowned.n === 3 && crowned.ach, 'the third crate crowns the Harbormaster');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
