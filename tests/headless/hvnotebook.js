/* HV-45 — the Spiral Notebook (classic-script page, no hook).
 * A. Constants hv-guestbook/4+1; the 📓 row and guest2 goal stand;
 *    two candles leave no notebook out.
 * B. The dish scales with candles, cap 5.
 * C. THE SEAM: with the notebook out, a leaf-through pays and
 *    ticks the tally; the same session leafs once.
 * D. A rearmed session pays again; two leafs complete the goal.
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
    if (!sessionStorage.getItem('hvnotebook-init')) {
      sessionStorage.setItem('hvnotebook-init', '1');
      localStorage.removeItem('hv-anniversary');
      localStorage.removeItem('hv-guestbook');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — no notebook yet
  const bare = await t(() => {
    saveHvAnniv({ toasts: 2 });
    saveHvGb({ leafs: 0 });
    const out2 = notebookOut();
    notebookLeafed = false;
    G.food = 10;
    finishAction({ id: 'guestbook' });
    return { key: HVGB_KEY, base: HVGB_BASE, per: HVGB_PER,
      row: ACTIONS.some(a => a.id === 'guestbook'),
      goal: GOALS.some(g => g.id === 'guest2'),
      out2, food: G.food, leafs: loadHvGb().leafs };
  });
  ok(bare.key === 'hv-guestbook' && bare.base === 4 && bare.per === 1 && bare.row && bare.goal,
    'hv-guestbook at 4+1 — the 📓 row and the guest2 goal stand');
  ok(!bare.out2 && bare.food === 10 && bare.leafs === 0,
    'two candles leave no notebook out — the leaf-through refuses');

  // B — the dish scales with the candles
  const dishes = await t(() => {
    saveHvAnniv({ toasts: 3 });
    const d3 = notebookDish();
    saveHvAnniv({ toasts: 9 });
    const dCap = notebookDish();
    saveHvAnniv({ toasts: 3 });
    return { d3, dCap, out: notebookOut() };
  });
  ok(dishes.d3 === 7 && dishes.dCap === 9 && dishes.out,
    `the dish scales with candles, capped at 5 (${dishes.d3}, ${dishes.dCap})`);

  // C — the seam
  const seam = await t(() => {
    notebookLeafed = false;
    G.food = 10;
    finishAction({ id: 'guestbook' });
    const food1 = G.food, leafs1 = loadHvGb().leafs;
    finishAction({ id: 'guestbook' });
    return { food1, leafs1, food2: G.food, leafs2: loadHvGb().leafs };
  });
  ok(seam.food1 === 17 && seam.leafs1 === 1,
    `the leaf-through pays and ticks the tally (food ${seam.food1}, leafs ${seam.leafs1})`);
  ok(seam.food2 === 17 && seam.leafs2 === 1, 'the same session leafs once');

  // D — rearm and the goal
  const goal = await t(() => {
    notebookLeafed = false;
    G.food = 0;
    finishAction({ id: 'guestbook' });
    const g = GOALS.find(x => x.id === 'guest2');
    return { food: G.food, leafs: loadHvGb().leafs, done: g.value() >= g.target };
  });
  ok(goal.food === 7 && goal.leafs === 2 && goal.done,
    'a rearmed session pays again — two leafs complete the guest2 goal');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
