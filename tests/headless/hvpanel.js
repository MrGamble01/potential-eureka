/* HV-50 — the Fifth Panel beside the community mural (classic-script
 * page, no hook).
 * A. Constants hv-mural/9+1; the 🎨 row and panel2 goal stand; two
 *    digs prime no panel.
 * B. The dish scales with digs, cap 5.
 * C. THE SEAM: with the panel painted, a stand pays and ticks the
 *    tally; the same session stands once.
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
    if (!sessionStorage.getItem('hvpanel-init')) {
      sessionStorage.setItem('hvpanel-init', '1');
      localStorage.removeItem('hv-capsule');
      localStorage.removeItem('hv-mural');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — no panel yet
  const bare = await t(() => {
    saveHvCan({ digs: 2 });
    saveHvPanel({ stands: 0 });
    const painted2 = panelPainted();
    panelStood = false;
    G.food = 10;
    finishAction({ id: 'panel' });
    return { key: HVPAN_KEY, base: HVPAN_BASE, per: HVPAN_PER,
      row: ACTIONS.some(a => a.id === 'panel'),
      goal: GOALS.some(g => g.id === 'panel2'),
      painted2, food: G.food, stands: loadHvPanel().stands };
  });
  ok(bare.key === 'hv-mural' && bare.base === 9 && bare.per === 1 && bare.row && bare.goal,
    'hv-mural at 9+1 — the 🎨 row and the panel2 goal stand');
  ok(!bare.painted2 && bare.food === 10 && bare.stands === 0,
    'two digs prime no panel — the stand refuses');

  // B — the dish scales with the digs
  const dishes = await t(() => {
    saveHvCan({ digs: 3 });
    const d3 = panelDish();
    saveHvCan({ digs: 9 });
    const dCap = panelDish();
    saveHvCan({ digs: 3 });
    return { d3, dCap, painted: panelPainted() };
  });
  ok(dishes.d3 === 12 && dishes.dCap === 14 && dishes.painted,
    `the dish scales with digs, capped at 5 (${dishes.d3}, ${dishes.dCap})`);

  // C — the seam
  const seam = await t(() => {
    panelStood = false;
    G.food = 10;
    finishAction({ id: 'panel' });
    const food1 = G.food, s1 = loadHvPanel().stands;
    finishAction({ id: 'panel' });
    return { food1, s1, food2: G.food, s2: loadHvPanel().stands };
  });
  ok(seam.food1 === 22 && seam.s1 === 1,
    `the stand pays and ticks the tally (food ${seam.food1}, stands ${seam.s1})`);
  ok(seam.food2 === 22 && seam.s2 === 1, 'the same session stands once');

  // D — rearm and the goal
  const goal = await t(() => {
    panelStood = false;
    G.food = 0;
    finishAction({ id: 'panel' });
    const g = GOALS.find(x => x.id === 'panel2');
    return { food: G.food, stands: loadHvPanel().stands, done: g.value() >= g.target };
  });
  ok(goal.food === 12 && goal.stands === 2 && goal.done,
    'a rearmed session pays again — two stands complete the panel2 goal');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
