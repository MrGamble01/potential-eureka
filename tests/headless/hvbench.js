/* HV-46 — the Bench under the Bridge (classic-script page, no hook).
 * A. Constants hv-bench/5+1; the 🪑 row and bench2 goal stand; two
 *    leafs build no bench.
 * B. The dish scales with leafs, cap 5.
 * C. THE SEAM: with the bench built, a sit pays and ticks the
 *    tally; the same session sits once.
 * D. A rearmed session pays again; two sits complete the goal.
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
    if (!sessionStorage.getItem('hvbench-init')) {
      sessionStorage.setItem('hvbench-init', '1');
      localStorage.removeItem('hv-guestbook');
      localStorage.removeItem('hv-bench');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — no bench yet
  const bare = await t(() => {
    saveHvGb({ leafs: 2 });
    saveHvBench({ sits: 0 });
    const built2 = hvBenchBuilt();
    G.benchDay = -1;
    G.food = 10;
    finishAction({ id: 'bench' });
    return { key: HVBEN_KEY, base: HVBEN_BASE, per: HVBEN_PER,
      row: ACTIONS.some(a => a.id === 'bench'),
      goal: GOALS.some(g => g.id === 'bench2'),
      built2, food: G.food, sits: loadHvBench().sits };
  });
  ok(bare.key === 'hv-bench' && bare.base === 5 && bare.per === 1 && bare.row && bare.goal,
    'hv-bench at 5+1 — the 🪑 row and the bench2 goal stand');
  ok(!bare.built2 && bare.food === 10 && bare.sits === 0,
    'two leafs build no bench — the sit refuses');

  // B — the dish scales with the leafs
  const dishes = await t(() => {
    saveHvGb({ leafs: 3 });
    const d3 = hvBenchDish();
    saveHvGb({ leafs: 9 });
    const dCap = hvBenchDish();
    saveHvGb({ leafs: 3 });
    return { d3, dCap, built: hvBenchBuilt() };
  });
  ok(dishes.d3 === 8 && dishes.dCap === 10 && dishes.built,
    `the dish scales with leafs, capped at 5 (${dishes.d3}, ${dishes.dCap})`);

  // C — the seam
  const seam = await t(() => {
    G.benchDay = -1;
    G.food = 10;
    finishAction({ id: 'bench' });
    const food1 = G.food, sits1 = loadHvBench().sits;
    finishAction({ id: 'bench' });
    return { food1, sits1, food2: G.food, sits2: loadHvBench().sits };
  });
  ok(seam.food1 === 18 && seam.sits1 === 1,
    `the sit pays and ticks the tally (food ${seam.food1}, sits ${seam.sits1})`);
  ok(seam.food2 === 18 && seam.sits2 === 1, 'the same session sits once');

  // D — rearm and the goal
  const goal = await t(() => {
    G.benchDay = -1;
    G.food = 0;
    finishAction({ id: 'bench' });
    const g = GOALS.find(x => x.id === 'bench2');
    return { food: G.food, sits: loadHvBench().sits, done: g.value() >= g.target };
  });
  ok(goal.food === 8 && goal.sits === 2 && goal.done,
    'a rearmed session pays again — two sits complete the bench2 goal');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
