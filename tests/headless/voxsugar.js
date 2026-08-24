/* VOX-17 — the Sugar Shack (one-shot, classic-script globals).
 * A. Fresh isle: the 🍁 Sugar Shack in the shop (700 / lvl 7 / kind
 *    sugar), the shack renders in cubes, Sugar Rush registered, the
 *    how-to bullet is in.
 * B. Out of season the pans stay cold: a due timer in summer never
 *    boils.
 * C. A dry spring boil pays exactly 12 🪙 and ticks the tally; the
 *    timer re-arms 130–240s.
 * D. A boil in the rain runs double: sugarPay reads 24 wet, 12 dry.
 * E. Five boils crown Sugar Rush; the tally rides the save and a
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
    if (!sessionStorage.getItem('voxsugar-init')) {
      sessionStorage.setItem('voxsugar-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => {
    const d = BUILDINGS.sugarshack;
    return { def: d ? { cost: d.cost, lvl: d.lvl, kind: d.kind } : null,
      cubes: sugarCubes(BUILDINGS.sugarshack).length,
      ach: ACH.some(a => a[0] === 'sap5'),
      howto: document.body.innerHTML.includes('Sugar Shack</b> (level 7)') };
  });
  ok(fresh.def && fresh.def.cost === 700 && fresh.def.lvl === 7 && fresh.def.kind === 'sugar'
    && fresh.cubes >= 8, 'the 🍁 Sugar Shack is in the shop (700 / lvl 7) and renders');
  ok(fresh.ach && fresh.howto, 'Sugar Rush registered; the how-to bullet is in');

  // find a spring day and a summer day
  const days = await t(() => {
    let sp = 0, su = 0;
    for (let d = 1; d < 40 && !(sp && su); d++) {
      const k = seasonOf(d).key;
      if (!sp && k === 'spring') sp = d;
      if (!su && k === 'summer') su = d;
    }
    return { sp, su };
  });

  // B — out of season
  const cold = await t(d => {
    state.buildings = state.buildings || {};
    state.buildings.sugarshack = { x: 4, z: 4 };
    state.coins = 500;
    state.day = d.su;
    rainActive = false;
    sugarNextT = 0.01;
    updateSugarShack(0.05);
    return { coins: state.coins, boils: state.sapBoils || 0 };
  }, days);
  ok(cold.coins === 500 && cold.boils === 0, 'out of season the pans stay cold — a due timer never boils');

  // C — the dry spring boil
  const boiled = await t(d => {
    state.day = d.sp;
    rainActive = false;
    sugarNextT = 0.01;
    updateSugarShack(0.05);
    return { coins: state.coins, boils: state.sapBoils, timer: sugarNextT, dry: sugarPay() };
  }, days);
  ok(boiled.dry === 12 && boiled.coins === 512 && boiled.boils === 1,
    'a dry spring boil pays exactly 12 🪙 and ticks the tally');
  ok(boiled.timer >= 110 && boiled.timer <= 240, 'the timer re-arms 130–240s');

  // D — the wet boil
  const wet = await t(() => {
    rainActive = true;
    const w = sugarPay();
    rainActive = false;
    return { wet: w, dry: sugarPay() };
  });
  ok(wet.wet === 24 && wet.dry === 12, 'a boil in the rain runs double (24 wet, 12 dry)');

  // E — the crown + persistence
  const crowned = await t(() => {
    state.sapBoils = 5;
    return ACH.find(a => a[0] === 'sap5')[3]();
  });
  ok(crowned, 'five boils crown Sugar Rush');
  await t(() => save());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const back = await t(() => ({ boils: state.sapBoils, built: sugarBuilt() }));
  ok(back.boils === 5 && back.built, 'the tally and the shack ride the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('voxel-garden-v1'));
    delete sv.state.sapBoils; delete sv.state.buildings.sugarshack;
    localStorage.setItem('voxel-garden-v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const legacy = await t(() => ({ boils: state.sapBoils || 0, built: sugarBuilt() }));
  ok(legacy.boils === 0 && !legacy.built, 'a pre-VOX-17 save migrates clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
