/* VOX-10 — the Observatory (one-shot, classic-script globals).
 * A. Fresh isle: the Observatory in the shop at 1500/lvl 9, the dome
 *    renders, Star Charts registered.
 * B. Daylight: no shards fall, dome or not.
 * C. At night the scope finds stardust twice as fast (timer decay 2×).
 * D. A wish under the dome surges crops 40% instead of 20% and stamps
 *    the star-charts flag (exact prog math on a seeded plant).
 * E. Star Charts is earned; the dome and the flag ride the save.
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
    if (!sessionStorage.getItem('voxobs-init')) {
      sessionStorage.setItem('voxobs-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => {
    const d = BUILDINGS.observatory;
    return { def: d ? { cost: d.cost, lvl: d.lvl, kind: d.kind } : null,
      cubes: obsCubes(d).length, built: observatoryBuilt(),
      ach: ACH.some(a => a[0] === 'charted') };
  });
  ok(fresh.def && fresh.def.cost === 1500 && fresh.def.lvl === 9 && fresh.def.kind === 'obs',
    'the Observatory is in the shop at 1500 coins, level 9');
  ok(fresh.cubes >= 8 && !fresh.built && fresh.ach,
    `the dome renders (${fresh.cubes} cubes); Star Charts registered`);

  // B — daylight
  const day = await t(() => {
    state.time = 0;   // morning
    if (shard) removeShard();
    shardNextT = 50;
    updateShard(5);
    return shardNextT;
  });
  ok(day === 50, 'daylight: the timer never runs, dome or not');

  // C — the scope finds them first
  const night = await t(() => {
    state.time = CYCLE * NIGHT_AT + 1;   // under the stars
    if (shard) removeShard();
    shardNextT = 50;
    updateShard(1);
    const bare = 50 - shardNextT;
    state.buildings = state.buildings || {};
    state.buildings.observatory = true;
    shardNextT = 50;
    updateShard(1);
    const domed = 50 - shardNextT;
    shardNextT = 999;
    state.time = 0;
    return { bare, domed };
  });
  ok(Math.abs(night.bare - 1) < 1e-9 && Math.abs(night.domed - 2) < 1e-9,
    `at night the scope finds stardust twice as fast (decay ${night.bare} vs ${night.domed})`);

  // D — a wish under the dome (seeded plant, atomic)
  const wished = await t(() => {
    const key = '__voxobs_test';
    const mk = () => ({ type: 'sunflower', stage: 0, prog: 0, x: 0, y: 0, z: 0 });
    let p = mk();
    W.plants.set(key, p);
    state.stardust = 3;
    wishGranted();                       // under the dome
    const domed = p.prog;
    const flag = state.achFlags.obsWish;
    state.buildings.observatory = false;
    p = mk(); W.plants.set(key, p);
    state.stardust = 3;
    wishGranted();                       // bare sky
    const bare = p.prog;
    W.plants.delete(key);
    state.buildings.observatory = true;
    return { domed, bare, grow: PLANTS.sunflower.grow, flag: !!flag, wishes: state.wishes };
  });
  ok(Math.abs(wished.domed - wished.grow * 0.40) < 1e-9 && Math.abs(wished.bare - wished.grow * 0.20) < 1e-9,
    `a wish surges 40% under the dome, 20% bare (${wished.domed} vs ${wished.bare})`);
  ok(wished.flag && wished.wishes >= 2, 'the star-charts flag is stamped and the wishes tally counts');

  // E — the crown + persistence
  await t(() => { checkAch(); save(); });
  const earned = await t(() => !!(state.ach && state.ach.charted));
  ok(earned, 'Star Charts is earned');
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const back = await t(() => ({ built: observatoryBuilt(), flag: !!state.achFlags.obsWish,
    ach: !!(state.ach && state.ach.charted) }));
  ok(back.built && back.flag && back.ach, 'the dome, the flag and the crown ride the save');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
