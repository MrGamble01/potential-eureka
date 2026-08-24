/* VOX-21 — the Corn Crib (one-shot, classic-script globals).
 * A. The 🌽 crib in the shop (680 / lvl 8 / kind crib), the crib
 *    renders (stilts, corn, the well-fed crow), Corn Diplomacy
 *    registered, the how-to bullet is in, constants 0.15/0.35.
 * B. No crib: a finished peck takes exactly grow×0.35 and the meal
 *    ledger stays empty.
 * C. Crib built: the same peck takes exactly grow×0.15 and the ledger
 *    ticks — architecture, everywhere on the isle.
 * D. Ten meals crown Corn Diplomacy; the ledger and the crib ride the
 *    save; a legacy save migrates clean.
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
    if (!sessionStorage.getItem('voxcrib-init')) {
      sessionStorage.setItem('voxcrib-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => {
    const d = BUILDINGS.corncrib;
    return { def: d ? { cost: d.cost, lvl: d.lvl, kind: d.kind } : null,
      cubes: cribCubes(BUILDINGS.corncrib).length,
      ach: ACH.some(a => a[0] === 'crib10'),
      howto: document.body.innerHTML.includes('Corn Crib</b> (level 8)'),
      bites: { crib: CRIB_BITE, crow: CROW_BITE } };
  });
  ok(fresh.def && fresh.def.cost === 680 && fresh.def.lvl === 8 && fresh.def.kind === 'crib'
    && fresh.cubes >= 12, 'the 🌽 Corn Crib is in the shop (680 / lvl 8) and renders full');
  ok(fresh.ach && fresh.howto && fresh.bites.crib === 0.15 && fresh.bites.crow === 0.35,
    'Corn Diplomacy registered; the how-to bullet is in; 0.15/0.35 on the sheet');

  // helper: run one full peck against a fresh sunflower via the real crow loop
  const peck = (withCrib) => t(new Function(`
    state.buildings = state.buildings || {};
    ${'' /* toggle the crib */}
    if (${withCrib}) state.buildings.corncrib = { x: 5, z: 5 }; else delete state.buildings.corncrib;
    ${'' /* a fresh crop, half grown */}
    const def = PLANTS.sunflower;
    const p = { type: 'sunflower', x: 1, y: 1, z: 1, stage: 1, prog: def.grow * 0.9 };
    W.plants.set(k3(1, 1, 1), p);
    if (crow) { scene.remove(crow.mesh); crow = null; }
    crow = { p, mesh: buildCrowMesh(), t: CROW_SIT + 1, state: 'sit', vx: 0, vz: 0 };
    scene.add(crow.mesh);
    const before = p.prog, m0 = state.cribMeals || 0;
    updateCrow(0.01);
    const lost = before - p.prog;
    W.plants.delete(k3(1, 1, 1));
    if (crow) { scene.remove(crow.mesh); crow = null; }
    return { lost, grow: def.grow, meals: (state.cribMeals || 0) - m0 };
  `));

  // B — the bare peck
  const bare = await peck(false);
  ok(Math.abs(bare.lost - bare.grow * 0.35) < 1e-9 && bare.meals === 0,
    `no crib — a finished peck takes exactly grow×0.35 (${bare.lost.toFixed(2)})`);

  // C — the softened peck
  const fed = await peck(true);
  ok(Math.abs(fed.lost - fed.grow * 0.15) < 1e-9 && fed.meals === 1,
    `crib built — the same peck takes exactly grow×0.15 (${fed.lost.toFixed(2)}) and the ledger ticks`);

  // D — the crown + persistence
  const crowned = await t(() => {
    state.cribMeals = 10;
    return ACH.find(a => a[0] === 'crib10')[3]();
  });
  ok(crowned, 'ten meals crown Corn Diplomacy');
  await t(() => save());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const back = await t(() => ({ meals: state.cribMeals, built: cribBuilt() }));
  ok(back.meals === 10 && back.built, 'the ledger and the crib ride the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('voxel-garden-v1'));
    delete sv.state.cribMeals; delete sv.state.buildings.corncrib;
    localStorage.setItem('voxel-garden-v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const legacy = await t(() => ({ meals: state.cribMeals || 0, built: cribBuilt() }));
  ok(legacy.meals === 0 && !legacy.built, 'a pre-VOX-21 save migrates clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
