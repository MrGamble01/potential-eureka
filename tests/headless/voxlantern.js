/* VOX-26 — the Stone Lantern (classic-script page, no hook needed).
 * A. Constants 150/vox-lantern; Keeper of the Shore registered; the
 *    lanternHud chip exists; nothing lit.
 * B. The chip hides until the isle has earned 150 — then shows.
 * C. Short coins refuse; a funded lighting costs exactly 150, stands
 *    in its own key, and a second lighting is refused.
 * D. THE LEGACY: the isle's save wiped — the lantern stays lit. The
 *    fresh isle rises with three ripe sunflowers on the starter plots
 *    and the isle counter ticks.
 * E. Two greeted isles crown Keeper of the Shore.
 * F. A shore with no lantern rises bare — zero plants.
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
    if (!sessionStorage.getItem('voxlantern-init')) {
      sessionStorage.setItem('voxlantern-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-lantern');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => ({
    cost: LANTERN_COST, key: LANTERN_KEY,
    achReg: ACH.some(a => a[0] === 'lantern2'),
    chip: !!document.getElementById('lanternHud'),
    lit: loadLantern().lit,
  }));
  ok(fresh.cost === 150 && fresh.key === 'vox-lantern' && fresh.achReg,
    '150 🪙, vox-lantern — Keeper of the Shore is registered');
  ok(fresh.chip && !fresh.lit, 'the lanternHud chip stands; nothing lit');

  // B — the reveal
  const reveal = await t(() => {
    state.totalEarned = 0; refreshLanternHud();
    const hidden = document.getElementById('lanternHud').style.display === 'none';
    state.totalEarned = 200; refreshLanternHud();
    const shown = document.getElementById('lanternHud').style.display !== 'none';
    return { hidden, shown };
  });
  ok(reveal.hidden && reveal.shown, 'the chip hides until the isle has earned 150 — then shows');

  // C — the lighting
  const lit = await t(() => {
    state.coins = 50;
    lightLantern();
    const broke = { lit: loadLantern().lit, coins: state.coins };
    state.coins = 500;
    lightLantern();
    const done = { spent: 500 - state.coins, l: loadLantern(),
      txt: document.getElementById('lanternTxt').textContent };
    const c1 = state.coins;
    lightLantern();
    return { broke, done, doubled: c1 - state.coins };
  });
  ok(!lit.broke.lit && lit.broke.coins === 50, 'short coins refuse the lighting');
  ok(lit.done.spent === 150 && lit.done.l.lit && lit.done.l.isles === 0
    && lit.done.txt.includes('lit'),
    'a funded lighting costs exactly 150 and stands in its own key');
  ok(lit.doubled === 0, 'a second lighting is refused — one lantern, one shore');

  // D — the legacy across a lost isle
  await page.evaluate(() => {
    const real = Storage.prototype.setItem.bind(localStorage);
    localStorage.removeItem('voxel-garden-v1');
    Storage.prototype.setItem = function (k, v) { if (k === 'voxel-garden-v1') return; real(k, v); };
  });
  await page.reload({ waitUntil: 'load' });
  // Wait for the thing this assertion is about rather than for a fixed
  // number of milliseconds. Booting a three.js scene and seeding the
  // fresh isle takes however long the machine takes, and a flat 3500ms
  // was long enough alone and NOT long enough under a full battery —
  // which is a fragile test, not a fragile lantern.
  await page.waitForFunction(
    () => typeof W !== 'undefined' && W.plants
      && [...W.plants.values()].filter(p => p.type === 'sunflower').length >= 3,
    null, { timeout: 30000 });
  const reborn = await t(() => {
    const ripe = [...W.plants.values()].filter(p => p.type === 'sunflower' && p.stage === 2);
    return { isles: loadLantern().isles, ripe: ripe.length, total: W.plants.size };
  });
  ok(reborn.isles === 1 && reborn.ripe === 3,
    'the lantern outlives the isle — the fresh shore rises with three ripe sunflowers, the counter ticks');

  // E — the crown
  const crowned = await t(() => {
    const row = ACH.find(a => a[0] === 'lantern2');
    const before = row[3]();
    saveLantern({ lit: true, isles: 2 });
    return { before, after: row[3]() };
  });
  ok(!crowned.before && crowned.after, 'two greeted isles crown Keeper of the Shore');

  // F — the bare shore
  await page.evaluate(() => {
    const real = Storage.prototype.setItem.bind(localStorage);
    localStorage.removeItem('voxel-garden-v1');
    localStorage.removeItem('vox-lantern');
    Storage.prototype.setItem = function (k, v) { if (k === 'voxel-garden-v1' || k === 'vox-lantern') return; real(k, v); };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const bare = await t(() => ({ lit: loadLantern().lit, total: W.plants.size,
    isles: loadLantern().isles }));
  ok(!bare.lit && bare.total === 0 && bare.isles === 0,
    'a shore that never lit one rises bare');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
