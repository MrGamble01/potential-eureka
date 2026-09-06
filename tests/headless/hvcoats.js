/* HV-23 — the Coat Rack (one-shot, classic-script globals).
 * A. Fresh camp: the 🧥 recipe on the bench (scraps 5 + goodwill 6),
 *    the goal on the ladder, COATS_CUT reads 0.5, no rack yet.
 * B. Matched cold dawns: the rack blunts exactly half the weather's
 *    bite (12 → 6) and the tally ticks only on the coats dawn.
 * C. A snap dawn stacks: coats halve both bites — 11 warmth saved.
 * D. A heat wave's gift is never touched: matched heat dawns read
 *    identical, and the tally never ticks.
 * E. A clear winter dawn: the season's base drain is not the rack's
 *    business — no cut, no tick.
 * F. The rack and the tally ride the save; a legacy save migrates.
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
    if (!sessionStorage.getItem('hvcoats-init')) {
      sessionStorage.setItem('hvcoats-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => {
    const r = RECIPES.find(x => x.id === 'coats');
    return { rec: r ? { s: r.cost.scraps, g: r.cost.goodwill, req: r.requires } : null,
      goal: GOALS.some(g => g.id === 'coldcut6'),
      cut: COATS_CUT, built: !!G.structures.coats };
  });
  ok(fresh.rec && fresh.rec.s === 5 && fresh.rec.g === 6 && fresh.rec.req === 'workbench',
    'the 🧥 Coat Rack is on the bench — scraps 5 + goodwill 6');
  ok(fresh.goal && fresh.cut === 0.5 && !fresh.built, 'the goal is on the ladder; the cut reads 0.5');

  // B — matched cold dawns
  const cold = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.snapUntil = null;
    G.population = 1; G.food = 50; G.dog = 0; G.structures.tent = false;
    G.structures.garden = false; G.workers.scrapper = null; G.workers.cook = null;
    G.rep = 0;
    G.structures.coats = false; G.coldCut = 0;
    G.days = 1; G.warmth = 90; G.forecast = 'cold';
    onNewDay();
    const lossBare = 90 - G.warmth;
    G.structures.coats = true;
    G.days = 1; G.warmth = 90; G.forecast = 'cold'; G.snapUntil = null;
    onNewDay();
    const lossCoats = 90 - G.warmth;
    Math.random = real;
    return { lossBare, lossCoats, diff: lossBare - lossCoats, ticks: G.coldCut };
  });
  ok(cold.diff === 6 && cold.ticks === 1,
    `coats blunt exactly half the cold's bite (${cold.lossBare} vs ${cold.lossCoats}) and the tally ticks once`);

  // C — the snap stacks
  const snap = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.coats = false; G.coldCut = 0;
    G.days = 1; G.warmth = 90; G.forecast = 'cold'; G.snapUntil = 99;
    onNewDay();
    const lossBare = 90 - G.warmth;
    G.structures.coats = true;
    G.days = 1; G.warmth = 90; G.forecast = 'cold'; G.snapUntil = 99;
    onNewDay();
    const lossCoats = 90 - G.warmth;
    Math.random = real;
    G.snapUntil = null;
    return { diff: lossBare - lossCoats, ticks: G.coldCut };
  });
  ok(snap.diff === 11 && snap.ticks === 1,
    'a snap dawn stacks — coats halve both bites: 11 warmth saved');

  // D — a heat wave's gift is never touched
  const heat = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.coats = false; G.coldCut = 0;
    G.days = 1; G.warmth = 50; G.forecast = 'heat'; G.snapUntil = null;
    onNewDay();
    const bare = G.warmth;
    G.structures.coats = true;
    G.days = 1; G.warmth = 50; G.forecast = 'heat'; G.snapUntil = null;
    onNewDay();
    const coats = G.warmth;
    Math.random = real;
    return { bare, coats, ticks: G.coldCut };
  });
  ok(heat.bare === heat.coats && heat.ticks === 0,
    'a heat wave reads identical with or without the rack — and never ticks');

  // E — a clear winter dawn: the base drain is not the rack's business
  const winter = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.coats = true; G.coldCut = 0;
    G.days = 21; G.warmth = 90; G.forecast = 'clear'; G.snapUntil = null;
    onNewDay();
    const loss = 90 - G.warmth;
    Math.random = real;
    return { loss, season: G.season, ticks: G.coldCut };
  });
  ok(winter.season === 3 && winter.loss === 18 && winter.ticks === 0,
    'a clear winter dawn drains the full 18 base — no cut, no tick');

  // F — persistence
  await t(() => { G.coldCut = 4; G.structures.coats = true; saveGame(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const back = await t(() => ({ cut: G.coldCut, built: G.structures.coats }));
  ok(back.cut === 4 && back.built, 'the rack and the tally ride the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete sv.coldCut; delete sv.structures.coats;
    localStorage.setItem('homeless_village_v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const legacy = await t(() => ({ cut: G.coldCut, built: G.structures.coats }));
  ok(legacy.cut === 0 && legacy.built === false, 'a pre-HV-23 save migrates clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
