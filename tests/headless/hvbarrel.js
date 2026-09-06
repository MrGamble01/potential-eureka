/* HV-27 — the Rain Barrel (one-shot, classic-script globals).
 * A. The 🛢️ recipe on the bench (scraps 5 + cans 1), the goal on the
 *    ladder, cap 3, no barrel yet.
 * B. Rainy dawns fill it: one dawn → 1/3; four dawns cap at 3.
 * C. A dry garden dawn spends one: the pinned roll yields exactly +1
 *    over bare, the water drops, the tally ticks.
 * D. A rainy garden dawn never spends — the sky is doing the work.
 * E. Frost neither fills nor spends — that fight belongs to the
 *    compost.
 * F. Six waterings clear the goal value; barrel, water and tally ride
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
    if (!sessionStorage.getItem('hvbarrel-init')) {
      sessionStorage.setItem('hvbarrel-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => {
    const r = RECIPES.find(x => x.id === 'barrel');
    return { rec: r ? { s: r.cost.scraps, c: r.cost.cans, req: r.requires } : null,
      goal: GOALS.some(g => g.id === 'barrel6'),
      cap: BARREL_CAP, built: !!G.structures.barrel };
  });
  ok(fresh.rec && fresh.rec.s === 5 && fresh.rec.c === 1 && fresh.rec.req === 'workbench',
    'the 🛢️ Rain Barrel is on the bench — scraps 5 + cans 1');
  ok(fresh.goal && fresh.cap === 3 && !fresh.built, 'the goal is on the ladder; cap 3');

  // helper: a controlled dawn
  const dawn = (weather) => t(new Function(`
    const real = Math.random;
    Math.random = () => 0.5;
    G.population = 1; G.dog = 0; G.structures.tent = false;
    G.workers.scrapper = null; G.workers.cook = null;
    G.structures.workbench = false; G.structures.toolbox = false;
    G.rep = 0; G.snapUntil = null; G.days = 1; G.warmth = 90;
    G.forecast = '${weather}'; G.lastEventDay = G.days + 5;
    G.food = 20;
    onNewDay();
    Math.random = real;
    return { food: G.food, water: G.barrelWater || 0, days: G.barrelDays || 0 };
  `));

  // B — rainy dawns fill it
  await t(() => { G.structures.barrel = true; G.structures.garden = false; G.barrelWater = 0; G.barrelDays = 0; });
  const one = await dawn('rain');
  ok(one.water === 1, 'a rainy dawn fills the barrel to 1/3');
  await dawn('rain'); await dawn('rain');
  const capped = await dawn('rain');
  ok(capped.water === 3, 'four rainy dawns cap the barrel at 3');

  // C — a dry garden dawn spends one
  await t(() => { G.structures.garden = true; G.structures.compost = false; G.structures.barrel = false; G.barrelWater = 0; });
  const bare = await dawn('clear');
  await t(() => { G.structures.barrel = true; G.barrelWater = 2; G.barrelDays = 0; });
  const watered = await dawn('clear');
  ok(watered.food - bare.food === 1 && watered.water === 1 && watered.days === 1,
    `a dry garden dawn spends one — exactly +1 over bare (${bare.food} vs ${watered.food}), water 2→1`);

  // D — a rainy garden dawn never spends
  await t(() => { G.barrelWater = 2; G.barrelDays = 0; });
  const rainy = await dawn('rain');
  ok(rainy.water >= 2 && rainy.days === 0, 'a rainy garden dawn never spends — the sky is doing the work');

  // E — frost neither fills nor spends
  await t(() => { G.barrelWater = 2; G.barrelDays = 0; });
  const frost = await dawn('cold');
  ok(frost.water === 2 && frost.days === 0, 'frost neither fills nor spends — that fight is the compost’s');

  // F — the goal + persistence
  await t(() => { G.barrelDays = 6; G.barrelWater = 2; G.structures.barrel = true; saveGame(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const back = await t(() => ({ days: G.barrelDays, water: G.barrelWater, built: G.structures.barrel,
    goal: GOALS.find(g => g.id === 'barrel6').value() }));
  ok(back.days === 6 && back.water === 2 && back.built && back.goal === 6,
    'six waterings clear the goal; barrel, water and tally ride the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete sv.barrelWater; delete sv.barrelDays; delete sv.structures.barrel;
    localStorage.setItem('homeless_village_v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const legacy = await t(() => ({ days: G.barrelDays, water: G.barrelWater, built: G.structures.barrel }));
  ok(legacy.days === 0 && legacy.water === 0 && legacy.built === false, 'a pre-HV-27 save migrates clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
