/* HV-25 — the Compost Bin (one-shot, classic-script globals).
 * A. The ♻️ recipe on the bench (scraps 3 + food 2), the goal on the
 *    ladder, no bin yet.
 * B. A clear garden day: without the bin the pinned roll yields 2;
 *    with the bin the same roll yields 3 and the tally ticks.
 * C. Frost: without the bin the beds give nothing; with the bin one
 *    bed lives — exactly +1 food and the tally ticks.
 * D. No garden: the bin alone feeds nothing.
 * E. Eight fed days clear the goal value; the bin and the tally ride
 *    the save; a legacy save migrates clean.
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
    if (!sessionStorage.getItem('hvcompost-init')) {
      sessionStorage.setItem('hvcompost-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => {
    const r = RECIPES.find(x => x.id === 'compost');
    return { rec: r ? { s: r.cost.scraps, f: r.cost.food, req: r.requires } : null,
      goal: GOALS.some(g => g.id === 'compost8'),
      built: !!G.structures.compost };
  });
  ok(fresh.rec && fresh.rec.s === 3 && fresh.rec.f === 2 && fresh.rec.req === 'workbench',
    'the ♻️ Compost Bin is on the bench — scraps 3 + food 2');
  ok(fresh.goal && !fresh.built, 'the goal is on the ladder');

  // helper: a controlled dawn
  const dawn = (weather) => t(new Function(`
    const real = Math.random;
    Math.random = () => 0.5;                 // rand(1,3) → 2, no events
    G.population = 1; G.dog = 0; G.structures.tent = false;
    G.workers.scrapper = null; G.workers.cook = null;
    G.structures.workbench = false; G.structures.toolbox = false;
    G.rep = 0; G.snapUntil = null; G.days = 1; G.warmth = 90;
    G.forecast = '${weather}'; G.lastEventDay = G.days + 5;
    G.food = 20;
    onNewDay();
    Math.random = real;
    return { food: G.food, days: G.compostDays || 0 };
  `));

  // B — the clear day
  await t(() => { G.structures.garden = true; G.structures.compost = false; G.compostDays = 0; });
  const bare = await dawn('clear');
  await t(() => { G.structures.compost = true; });
  const fed = await dawn('clear');
  ok(fed.days === 1 && fed.food - bare.food === 1,
    `the bin adds exactly +1 on a clear garden day (${bare.food} vs ${fed.food}) and the tally ticks`);

  // C — the frost
  await t(() => { G.structures.compost = false; G.compostDays = 0; });
  const frostBare = await dawn('cold');
  await t(() => { G.structures.compost = true; });
  const frostFed = await dawn('cold');
  ok(frostFed.days === 1 && frostFed.food - frostBare.food === 1,
    `frost: one bed lives with the bin — exactly +1 (${frostBare.food} vs ${frostFed.food})`);

  // D — no garden
  await t(() => { G.structures.garden = false; G.compostDays = 0; });
  const gardenless = await dawn('clear');
  ok(gardenless.days === 0, 'no garden — the bin alone feeds nothing');

  // E — persistence
  await t(() => { G.compostDays = 8; G.structures.compost = true; saveGame(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const back = await t(() => ({ days: G.compostDays, built: G.structures.compost,
    goal: GOALS.find(g => g.id === 'compost8').value() }));
  ok(back.days === 8 && back.built && back.goal === 8,
    'eight fed days clear the goal value; the bin and the tally ride the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete sv.compostDays; delete sv.structures.compost;
    localStorage.setItem('homeless_village_v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const legacy = await t(() => ({ days: G.compostDays, built: G.structures.compost }));
  ok(legacy.days === 0 && legacy.built === false, 'a pre-HV-25 save migrates clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
