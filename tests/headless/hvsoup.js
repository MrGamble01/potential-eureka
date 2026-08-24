/*
 * HV-10 — Soup Night (re-runnable; classic scripts, no hook).
 *  A. No kitchen → dawn passes in silence; a cold pot when short.
 *  B. A stocked kitchen feeds the camp: exact food/morale/health math,
 *     counter ticks, log line lands.
 *  C. A pinned neighbor roll chips in goodwill and +1 rep.
 *  D. The soup7 goal is on the ladder; the counter rides the save and
 *     legacy saves migrate to 0.
 *  Z. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hs-init')) {
      sessionStorage.setItem('hs-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // A. gates
  const a = await t(() => {
    const logs = []; const oldLog = window.log; window.log = m => { logs.push(m); oldLog(m); };
    G.structures.soup_kitchen = false; G.population = 3; G.food = 50;
    const f0 = G.food;
    soupNightAtDawn();
    const silent = G.food === f0 && !logs.length;
    G.structures.soup_kitchen = true; G.food = 2;   // three mouths, two bowls
    soupNightAtDawn();
    const cold = G.food === 2 && logs.some(m => /pot stayed cold/.test(m));
    window.log = oldLog;
    return { silent, cold, nights: G.soupNights };
  });
  ok(a.silent, 'no kitchen → dawn passes in silence');
  ok(a.cold && a.nights === 0, 'a short pantry means a cold pot, no penalty');

  // B. a stocked kitchen feeds the camp — exact math
  const b = await t(() => {
    const oldR = Math.random; Math.random = () => 0.9;   // no neighbor tonight
    const logs = []; const oldLog = window.log; window.log = m => { logs.push(m); oldLog(m); };
    G.food = 20; G.population = 4; G.morale = 50; G.health = 60; G.goodwill = 10;
    soupNightAtDawn();
    Math.random = oldR; window.log = oldLog;
    return { food: G.food, morale: G.morale, health: G.health, goodwill: G.goodwill,
      nights: G.soupNights, logged: logs.some(m => /Soup night/.test(m)) };
  });
  ok(b.food === 16 && b.morale === 54 && b.health === 62,
    `four bowls served: food 20→${b.food}, morale 50→${b.morale}, health 60→${b.health}`);
  ok(b.nights === 1 && b.goodwill === 10 && b.logged, 'counter ticks; no neighbor on a 0.9 roll');

  // C. the neighbor who smelled the cooking
  const c = await t(() => {
    const oldR = Math.random; Math.random = () => 0.1;   // neighbor roll hits, rand(1,2)→1
    G.food = 20; G.population = 2; G.goodwill = 10; G.rep = 10;
    soupNightAtDawn();
    Math.random = oldR;
    return { goodwill: G.goodwill, rep: G.rep, nights: G.soupNights };
  });
  ok(c.goodwill === 11 && c.rep === 11 && c.nights === 2,
    `a 0.1 roll brings a neighbor: +1 goodwill, +1 rep (${c.goodwill}/${c.rep})`);

  // D. goal + persistence + migration
  const d1 = await t(() => {
    G.soupNights = 5; saveGame();
    return { goal: GOALS.some(g => g.id === 'soup7' && g.target === 7) };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const d2 = await t(() => G.soupNights);
  await t(() => { const s = JSON.parse(localStorage.getItem('homeless_village_v1')); delete s.soupNights; localStorage.setItem('homeless_village_v1', JSON.stringify(s)); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const d3 = await t(() => G.soupNights);
  ok(d1.goal, 'the soup7 goal is on the ladder');
  ok(d2 === 5, `the counter rides the save (${d2})`);
  ok(d3 === 0, 'a pre-HV-10 save migrates to 0');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
