/* VOX-18 — the Isle Museum (one-shot, classic-script globals).
 * A. The 🏛️ museum in the shop (800 / lvl 9 / kind museum), the hall
 *    renders, Curator registered, the how-to bullet is in.
 * B. No museum: a first-of-its-kind catch pays list only — nothing
 *    is mounted.
 * C. Museum up: the first Perch mounts for exactly list + 30; a
 *    second Perch pays list only (one mount per species).
 * D. The winter table counts: an Arctic Char through the jig hole
 *    mounts for exactly 34 + 30.
 * E. Five mounts crown Curator; the cabinet rides the save and a
 *    legacy save migrates clean.
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
    if (!sessionStorage.getItem('voxmuseum-init')) {
      sessionStorage.setItem('voxmuseum-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => {
    const d = BUILDINGS.museum;
    return { def: d ? { cost: d.cost, lvl: d.lvl, kind: d.kind } : null,
      cubes: museumCubes(BUILDINGS.museum).length,
      ach: ACH.some(a => a[0] === 'mount5'),
      howto: document.body.innerHTML.includes('Isle Museum</b> (level 9)') };
  });
  ok(fresh.def && fresh.def.cost === 800 && fresh.def.lvl === 9 && fresh.def.kind === 'museum'
    && fresh.cubes >= 7, 'the 🏛️ Isle Museum is in the shop (800 / lvl 9) and renders');
  ok(fresh.ach && fresh.howto, 'Curator registered; the how-to bullet is in');

  // find a non-winter day
  const day = await t(() => {
    for (let d = 1; d < 40; d++) if (seasonOf(d).key !== 'winter') return d;
  });

  // B — no museum: nothing mounts
  await t(d => {
    state.day = d;
    state.buildings = state.buildings || {};
    delete state.buildings.museum;
    state.coins = 1000;
    fishingT = 0;
    Math.random = () => 0.01;   // → Perch on the pond table
    goFishing(10, 10);
  }, day);
  await page.waitForTimeout(1100);
  const bare = await t(() => ({ coins: state.coins, mounted: state.mounted }));
  ok(bare.coins === 1014 && !bare.mounted, 'no museum — the first Perch pays list only, nothing mounts');

  // C — the first mount + the one-per-species rule
  await t(() => {
    state.buildings.museum = { x: 6, z: 6 };
    state.coins = 1000;
    fishingT = 0;
    goFishing(10, 10);
  });
  await page.waitForTimeout(1100);
  const mounted = await t(() => ({ coins: state.coins, m: state.mounted && state.mounted.perch }));
  ok(mounted.coins === 1044 && mounted.m === 1,
    'the first Perch mounts — exactly 14 list + 30 bounty');
  await t(() => { state.coins = 1000; fishingT = 0; goFishing(10, 10); });
  await page.waitForTimeout(1100);
  const second = await t(() => ({ coins: state.coins, keys: Object.keys(state.mounted).length }));
  ok(second.coins === 1014 && second.keys === 1, 'a second Perch pays list only — one mount a species');

  // D — the winter table counts
  const winterDay = await t(() => {
    for (let d = 1; d < 40; d++) if (seasonOf(d).key === 'winter') return d;
  });
  await t(d => {
    state.day = d;
    state.buildings.icehut = { x: 8, z: 8 };
    state.coins = 1000;
    fishingT = 0;
    Math.random = () => 0.01;   // → Arctic Char on the ice table
    goFishing(10, 10);
  }, winterDay);
  await page.waitForTimeout(1100);
  const char = await t(() => ({ coins: state.coins, m: state.mounted.char }));
  ok(char.coins === 1064 && char.m === 1, 'an Arctic Char mounts through the jig hole — 34 + 30');

  // E — the crown + persistence
  const crowned = await t(() => {
    state.mounted = { perch: 1, char: 1, crab: 1, puffer: 1, tropic: 1 };
    return ACH.find(a => a[0] === 'mount5')[3]();
  });
  ok(crowned, 'five mounts crown Curator');
  await t(() => save());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const back = await t(() => ({ keys: Object.keys(state.mounted || {}).length, built: museumBuilt() }));
  ok(back.keys === 5 && back.built, 'the cabinet rides the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('voxel-garden-v1'));
    delete sv.state.mounted; delete sv.state.buildings.museum;
    localStorage.setItem('voxel-garden-v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const legacy = await t(() => ({ m: state.mounted, built: museumBuilt() }));
  ok(!legacy.m && !legacy.built, 'a pre-VOX-18 save migrates clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
