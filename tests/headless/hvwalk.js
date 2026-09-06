/* HV-51 — the Walk Down the underpass (classic-script
 * page, no hook).
 * A. Constants hv-docent/10+1; the 🧭 row and walk2 goal stand; two
 *    stands start no walk.
 * B. The dish scales with digs, cap 5.
 * C. THE SEAM: with the panel painted, a stand pays and ticks the
 *    tally; the same session walks once.
 * D. A rearmed session pays again; two stands complete the goal.
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
    if (!sessionStorage.getItem('hvwalk-init')) {
      sessionStorage.setItem('hvwalk-init', '1');
      localStorage.removeItem('hv-mural');
      localStorage.removeItem('hv-docent');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — no panel yet
  const bare = await t(() => {
    saveHvPanel({ stands: 2 });
    saveHvWalk({ walks: 0 });
    const started2 = walkUp();
    walkGiven = false;
    G.food = 10;
    finishAction({ id: 'walk' });
    return { key: HVWALK_KEY, base: HVWALK_BASE, per: HVWALK_PER,
      row: ACTIONS.some(a => a.id === 'walk'),
      goal: GOALS.some(g => g.id === 'walk2'),
      started2, food: G.food, walks: loadHvWalk().walks };
  });
  ok(bare.key === 'hv-docent' && bare.base === 10 && bare.per === 1 && bare.row && bare.goal,
    'hv-docent at 10+1 — the 🧭 row and the walk2 goal stand');
  ok(!bare.started2 && bare.food === 10 && bare.walks === 0,
    'two panel stands start no walk — the walk refuses');

  // B — the dish scales with the digs
  const dishes = await t(() => {
    saveHvPanel({ stands: 3 });
    const d3 = walkDish();
    saveHvPanel({ stands: 9 });
    const dCap = walkDish();
    saveHvPanel({ stands: 3 });
    return { d3, dCap, started: walkUp() };
  });
  ok(dishes.d3 === 13 && dishes.dCap === 15 && dishes.started,
    `the dish scales with panel stands, capped at 5 (${dishes.d3}, ${dishes.dCap})`);

  // C — the seam
  const seam = await t(() => {
    walkGiven = false;
    G.food = 10;
    finishAction({ id: 'walk' });
    const food1 = G.food, w1 = loadHvWalk().walks;
    finishAction({ id: 'walk' });
    return { food1, w1, food2: G.food, w2: loadHvWalk().walks };
  });
  ok(seam.food1 === 23 && seam.w1 === 1,
    `the walk pays and ticks the tally (food ${seam.food1}, walks ${seam.w1})`);
  ok(seam.food2 === 23 && seam.w2 === 1, 'the same session walks once');

  // D — rearm and the goal
  const goal = await t(() => {
    walkGiven = false;
    G.food = 0;
    finishAction({ id: 'walk' });
    const g = GOALS.find(x => x.id === 'walk2');
    return { food: G.food, walks: loadHvWalk().walks, done: g.value() >= g.target };
  });
  ok(goal.food === 13 && goal.walks === 2 && goal.done,
    'a rearmed session pays again — two walks complete the walk2 goal');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
