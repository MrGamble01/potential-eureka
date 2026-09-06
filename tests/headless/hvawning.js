/* HV-26 — the Awning (one-shot, classic-script globals).
 * A. The ⛱️ recipe on the bench (scraps 4 + cans 2), the goal on the
 *    ladder, AWNING_DRY = 2, no awning yet.
 * B. Pinned rain-day panhandle: bare corner misses (.55×.5 = .275
 *    under a .4 roll); under the awning the same roll lands
 *    (.55×.5×2 = .55) and the tally ticks.
 * C. A clear day under the awning: success but NO tally — the awning
 *    only counts rain.
 * D. Cold keeps its bite: .55×.75 = .4125 misses a .45 roll with or
 *    without the awning.
 * E. Five rainy coins clear the goal value; the awning and the tally
 *    ride the save; a legacy save migrates clean.
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
    if (!sessionStorage.getItem('hvawning-init')) {
      sessionStorage.setItem('hvawning-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => {
    const r = RECIPES.find(x => x.id === 'awning');
    return { rec: r ? { s: r.cost.scraps, c: r.cost.cans, req: r.requires } : null,
      goal: GOALS.some(g => g.id === 'awning5'),
      dry: AWNING_DRY, built: !!G.structures.awning };
  });
  ok(fresh.rec && fresh.rec.s === 4 && fresh.rec.c === 2 && fresh.rec.req === 'workbench',
    'the ⛱️ Awning is on the bench — scraps 4 + cans 2');
  ok(fresh.goal && fresh.dry === 2 && !fresh.built, 'the goal is on the ladder; ×2 on the sheet');

  // helper: one pinned panhandle
  const pan = (weather, roll, awning) => t(new Function(`
    const real = Math.random;
    let first = true;
    Math.random = () => { if (first) { first = false; return ${roll}; } return 0.5; };
    G.weather = '${weather}'; G.structures.awning = ${awning};
    G.dog = 0; G.rep = 0; G.mural = 0; G.snapUntil = null;
    const g0 = G.goodwill, s0 = G.awningSaves || 0;
    finishAction({ id: 'panhandle' });
    Math.random = real;
    return { gave: G.goodwill > g0, saves: (G.awningSaves || 0) - s0 };
  `));

  // B — the rain flip
  const bareRain = await pan('rain', 0.4, false);
  const dryRain = await pan('rain', 0.4, true);
  ok(!bareRain.gave && bareRain.saves === 0, 'rain closes the bare corner (.275 misses the .4 roll)');
  ok(dryRain.gave && dryRain.saves === 1,
    'under the awning the same roll lands (.55) and the tally ticks');

  // C — clear day, no tally
  const clearDay = await pan('clear', 0.4, true);
  ok(clearDay.gave && clearDay.saves === 0, 'a clear-day coin never counts as an awning save');

  // D — cold keeps its bite
  const bareCold = await pan('cold', 0.45, false);
  const awnCold = await pan('cold', 0.45, true);
  ok(!bareCold.gave && !awnCold.gave, 'cold keeps its bite — the awning is rain cover, not a heater');

  // E — the goal + persistence
  await t(() => { G.awningSaves = 5; G.structures.awning = true; saveGame(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const back = await t(() => ({ saves: G.awningSaves, built: G.structures.awning,
    goal: GOALS.find(g => g.id === 'awning5').value() }));
  ok(back.saves === 5 && back.built && back.goal === 5,
    'five rainy coins clear the goal value; the awning and the tally ride the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete sv.awningSaves; delete sv.structures.awning;
    localStorage.setItem('homeless_village_v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const legacy = await t(() => ({ saves: G.awningSaves, built: G.structures.awning }));
  ok(legacy.saves === 0 && legacy.built === false, 'a pre-HV-26 save migrates clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
