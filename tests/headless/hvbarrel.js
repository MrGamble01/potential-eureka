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
 * G. Live craft-panel stock inspection, inert clicks and recipe controls.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
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

  // G — production state/UI/clicks, with no injected test hooks or mocks.
  const inspect = await t(() => {
    G.goalIndex = GOALS.length;
    G.activeCrafts = {};
    G.structures.workbench = true;
    G.structures.barrel = true;
    G.scraps = 10; G.cans = 5;
    const snapshot = () => JSON.stringify({ scraps: G.scraps, cans: G.cans,
      water: G.barrelWater, structures: G.structures, active: G.activeCrafts });
    buildCraftUI();
    const button = document.getElementById('craft-barrel');
    const stocks = [0, 1, BARREL_CAP, 0].map(water => {
      G.barrelWater = water;
      updateHUD(); // Must stay live without rebuilding the panel.
      const before = snapshot();
      const oldLast = document.querySelector('.log-line:last-child');
      button.click();
      const last = document.querySelector('.log-line:last-child');
      return { water, cost: button.querySelector('.ci-cost').textContent,
        tip: button.getAttribute('data-tip'), log: last !== oldLast ? last.textContent : '',
        same: before === snapshot() };
    });
    delete G.barrelWater;
    buildCraftUI();
    const fallback = document.querySelector('#craft-barrel .ci-cost').textContent;
    const bench = document.getElementById('craft-workbench');
    bench.click();
    const workbench = { tip: bench.getAttribute('data-tip'),
      log: document.querySelector('.log-line:last-child').textContent };
    G.structures.barrel = false;
    updateHUD();
    const barrel = document.getElementById('craft-barrel');
    const unbuilt = { cost: barrel.querySelector('.ci-cost').textContent,
      tip: barrel.getAttribute('data-tip') };
    barrel.click();
    unbuilt.started = !!G.activeCrafts.barrel;
    unbuilt.scraps = G.scraps; unbuilt.cans = G.cans;
    return { cap: BARREL_CAP, stocks, fallback, workbench, unbuilt };
  });
  for (const stock of inspect.stocks) {
    const text = `${stock.water}/${inspect.cap} stored`;
    ok(stock.cost === text && stock.tip.includes('Rain Barrel holds ' + text),
      `live panel and tip show ${text}`);
    ok(stock.log.includes('Rain Barrel holds ' + text) && stock.same,
      `click inspects ${text} without spending, changing structures or starting craft`);
  }
  ok(inspect.fallback === `0/${inspect.cap} stored`, 'missing water defaults to empty on panel rebuild');
  ok([inspect.workbench.tip, inspect.workbench.log].every(text =>
    /Workbench is already built/.test(text) && !/stored|holds/.test(text)),
    'built Workbench keeps already-built feedback without water copy');
  ok(inspect.unbuilt.cost === '5scraps 1cans' && !/\d+\/\d+ stored|Rain Barrel holds/.test(inspect.unbuilt.tip),
    'unbuilt barrel restores build cost and ordinary tip');
  ok(inspect.unbuilt.started && inspect.unbuilt.scraps === 5 && inspect.unbuilt.cans === 4,
    'affordable unbuilt barrel starts and spends its exact build cost');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exitCode = 1; });
