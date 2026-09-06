/* HV-42 — the Bridge Reunion (classic-script page, no hook).
 * A. Constants hv-reunion/2+1; the 🎂 row and reunion2 goal stand; a
 *    half story (holds without visits) keeps the pot empty.
 * B. The dish composes both stores, caps enforced.
 * C. THE SEAM: with the whole story standing, the reunion pays and
 *    ticks the tally; the same session throws once.
 * D. A rearmed session pays again; two held complete the goal.
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
    if (!sessionStorage.getItem('hvreunion-init')) {
      sessionStorage.setItem('hvreunion-init', '1');
      localStorage.removeItem('hv-plaque');
      localStorage.removeItem('hv-visitor');
      localStorage.removeItem('hv-reunion');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — the half story
  const half = await t(() => {
    saveHvStar({ cheers: 3 });
    saveMarisol({ visits: 2 });
    saveHvReunion({ held: 0 });
    const stands = hvReunionStands();
    G.hvReunionDay = -1;
    G.food = 10;
    finishAction({ id: 'reunion' });
    return { key: HVREU_KEY, base: HVREU_BASE, per: HVREU_PER,
      row: ACTIONS.some(a => a.id === 'reunion'),
      goal: GOALS.some(g => g.id === 'reunion2'),
      stands, food: G.food, held: loadHvReunion().held };
  });
  ok(half.key === 'hv-reunion' && half.base === 2 && half.per === 1 && half.row && half.goal,
    'hv-reunion at 2+1 — the 🎂 row and the reunion2 goal stand');
  ok(!half.stands && half.food === 10 && half.held === 0,
    'a half story keeps the pot empty — holds without visits');

  // B — the dish composes both stores
  const dishes = await t(() => {
    saveMarisol({ visits: 3 });
    const d33 = hvReunionDish();
    saveHvStar({ cheers: 9 });
    saveMarisol({ visits: 8 });
    const dCap = hvReunionDish();
    saveHvStar({ cheers: 3 });
    saveMarisol({ visits: 3 });
    return { d33, dCap, stands: hvReunionStands() };
  });
  ok(dishes.d33 === 8 && dishes.dCap === 8 && dishes.stands,
    `the dish composes both stores with caps (${dishes.d33}, capped ${dishes.dCap})`);

  // C — the seam
  const seam = await t(() => {
    G.hvReunionDay = -1;
    G.food = 10;
    finishAction({ id: 'reunion' });
    const food1 = G.food, held1 = loadHvReunion().held;
    finishAction({ id: 'reunion' });
    return { food1, held1, food2: G.food, held2: loadHvReunion().held };
  });
  ok(seam.food1 === 18 && seam.held1 === 1,
    `the reunion pays the dish and ticks the tally (food ${seam.food1}, held ${seam.held1})`);
  ok(seam.food2 === 18 && seam.held2 === 1, 'the same session throws once');

  // D — rearm and the goal
  const goal = await t(() => {
    G.hvReunionDay = -1;
    G.food = 0;
    finishAction({ id: 'reunion' });
    const g = GOALS.find(x => x.id === 'reunion2');
    return { food: G.food, held: loadHvReunion().held, done: g.value() >= g.target };
  });
  ok(goal.food === 8 && goal.held === 2 && goal.done,
    'a rearmed session pays again — two held complete the reunion2 goal');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
