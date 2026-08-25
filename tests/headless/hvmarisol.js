/* HV-40 — Marisol Drops By (classic-script page, no hook).
 * A. Constants hv-visitor/base 2; the 🚗 action row and the marisol2
 *    goal stand; nothing visited.
 * B. A storyless bridge waves at nothing — the truck rolls past.
 * C. The casserole scales with the chalk star's cheers, capped at 3.
 * D. THE SEAM: a wave pays the dish, ticks the tally; the same
 *    session refuses a second visit.
 * E. A rearmed session welcomes her again; two visits complete the
 *    marisol2 goal.
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
    if (!sessionStorage.getItem('hvmarisol-init')) {
      sessionStorage.setItem('hvmarisol-init', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-letter');
      localStorage.removeItem('hv-plaque');
      localStorage.removeItem('hv-visitor');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => ({
    key: MARISOL_KEY, base: MARISOL_BASE,
    row: ACTIONS.some(a => a.id === 'marisol'),
    goal: GOALS.some(g => g.id === 'marisol2'),
    m: loadMarisol(),
  }));
  ok(fresh.key === 'hv-visitor' && fresh.base === 2 && fresh.row && fresh.goal,
    'hv-visitor at base 2 — the 🚗 action row and the marisol2 goal stand');
  ok(fresh.m.visits === 0, 'nothing visited');

  // B — the storyless bridge
  const cold = await t(() => {
    localStorage.removeItem('hv-record');
    localStorage.removeItem('hv-letter');
    G.food = 10;
    finishAction({ id: 'marisol' });
    return { visits: loadMarisol().visits, food: G.food };
  });
  ok(cold.visits === 0 && cold.food === 10,
    'a storyless bridge waves at nothing — the truck rolls past');

  // C — the scaling
  const scaled = await t(() => {
    saveHvRec({ days: 5, beats: 1 });
    saveHvStar({ cheers: 0 });
    const d0 = marisolDish();
    saveHvStar({ cheers: 2 });
    const d2 = marisolDish();
    saveHvStar({ cheers: 9 });
    const d9 = marisolDish();
    saveHvStar({ cheers: 2 });
    return { d0, d2, d9 };
  });
  ok(scaled.d0 === 2 && scaled.d2 === 4 && scaled.d9 === 5,
    `the casserole scales with the chalk star, capped (${scaled.d0}, ${scaled.d2}, ${scaled.d9})`);

  // D — the seam
  const visit = await t(() => {
    marisolCame = false;
    G.food = 10;
    finishAction({ id: 'marisol' });
    const food1 = G.food, visits1 = loadMarisol().visits;
    finishAction({ id: 'marisol' });
    return { food1, visits1, food2: G.food, visits2: loadMarisol().visits };
  });
  ok(visit.food1 === 14 && visit.visits1 === 1,
    `the wave pays the casserole and ticks the tally (food ${visit.food1}, visits ${visit.visits1})`);
  ok(visit.food2 === 14 && visit.visits2 === 1, 'the same session refuses a second visit');

  // E — rearm and the goal
  const goal = await t(() => {
    marisolCame = false;
    G.food = 0;
    finishAction({ id: 'marisol' });
    const g = GOALS.find(x => x.id === 'marisol2');
    return { food: G.food, visits: loadMarisol().visits, done: g.value() >= g.target };
  });
  ok(goal.food === 4 && goal.visits === 2 && goal.done,
    'a rearmed session welcomes her again — two visits complete the marisol2 goal');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
