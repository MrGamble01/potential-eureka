/* HV-44 — the Bridge Anniversary (classic-script page, no hook).
 * A. Constants hv-anniversary/3+1; the 🕯️ row and anniv2 goal
 *    stand; two snapshot looks add up to no year.
 * B. The dish scales with snapshot looks, cap 5.
 * C. THE SEAM: with the year counted, a candle pays and ticks the
 *    tally; the same session marks once.
 * D. A rearmed session pays again; two markings complete the goal.
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
    if (!sessionStorage.getItem('hvanniv-init')) {
      sessionStorage.setItem('hvanniv-init', '1');
      localStorage.removeItem('hv-portrait');
      localStorage.removeItem('hv-anniversary');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — no year counted yet
  const bare = await t(() => {
    saveHvSnap({ looks: 2 });
    saveHvAnniv({ toasts: 0 });
    const counts2 = annivCounts();
    annivMarked = false;
    G.food = 10;
    finishAction({ id: 'anniv' });
    return { key: HVANN_KEY, base: HVANN_BASE, per: HVANN_PER,
      row: ACTIONS.some(a => a.id === 'anniv'),
      goal: GOALS.some(g => g.id === 'anniv2'),
      counts2, food: G.food, toasts: loadHvAnniv().toasts };
  });
  ok(bare.key === 'hv-anniversary' && bare.base === 3 && bare.per === 1 && bare.row && bare.goal,
    'hv-anniversary at 3+1 — the 🕯️ row and the anniv2 goal stand');
  ok(!bare.counts2 && bare.food === 10 && bare.toasts === 0,
    'two snapshot looks add up to no year — the candle refuses');

  // B — the dish scales with the looks
  const dishes = await t(() => {
    saveHvSnap({ looks: 3 });
    const d3 = annivDish();
    saveHvSnap({ looks: 9 });
    const dCap = annivDish();
    saveHvSnap({ looks: 3 });
    return { d3, dCap, counts: annivCounts() };
  });
  ok(dishes.d3 === 6 && dishes.dCap === 8 && dishes.counts,
    `the dish scales with snapshot looks, capped at 5 (${dishes.d3}, ${dishes.dCap})`);

  // C — the seam
  const seam = await t(() => {
    annivMarked = false;
    G.food = 10;
    finishAction({ id: 'anniv' });
    const food1 = G.food, toasts1 = loadHvAnniv().toasts;
    finishAction({ id: 'anniv' });
    return { food1, toasts1, food2: G.food, toasts2: loadHvAnniv().toasts };
  });
  ok(seam.food1 === 16 && seam.toasts1 === 1,
    `the candle pays and ticks the tally (food ${seam.food1}, toasts ${seam.toasts1})`);
  ok(seam.food2 === 16 && seam.toasts2 === 1, 'the same session marks once');

  // D — rearm and the goal
  const goal = await t(() => {
    annivMarked = false;
    G.food = 0;
    finishAction({ id: 'anniv' });
    const g = GOALS.find(x => x.id === 'anniv2');
    return { food: G.food, toasts: loadHvAnniv().toasts, done: g.value() >= g.target };
  });
  ok(goal.food === 6 && goal.toasts === 2 && goal.done,
    'a rearmed session pays again — two markings complete the anniv2 goal');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
