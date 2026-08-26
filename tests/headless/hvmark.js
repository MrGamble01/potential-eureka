/* HV-52 — a Name on the Wall (classic-script
 * page, no hook).
 * A. Constants hv-mark/11+1; the ✍️ row and mark2 goal stand; two
 *    walks add no name.
 * B. The dish scales with digs, cap 5.
 * C. THE SEAM: with the panel painted, a stand pays and ticks the
 *    tally; the same session adds one name.
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
    if (!sessionStorage.getItem('hvmark-init')) {
      sessionStorage.setItem('hvmark-init', '1');
      localStorage.removeItem('hv-docent');
      localStorage.removeItem('hv-mark');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — no panel yet
  const bare = await t(() => {
    saveHvWalk({ walks: 2 });
    saveHvMark({ names: 0 });
    const added2 = markUp();
    markAdded = false;
    G.food = 10;
    finishAction({ id: 'mark' });
    return { key: HVMARK_KEY, base: HVMARK_BASE, per: HVMARK_PER,
      row: ACTIONS.some(a => a.id === 'mark'),
      goal: GOALS.some(g => g.id === 'mark2'),
      added2, food: G.food, names: loadHvMark().names };
  });
  ok(bare.key === 'hv-mark' && bare.base === 11 && bare.per === 1 && bare.row && bare.goal,
    'hv-mark at 11+1 — the ✍️ row and the mark2 goal stand');
  ok(!bare.added2 && bare.food === 10 && bare.names === 0,
    'two walks add no name — the chalk refuses');

  // B — the dish scales with the digs
  const dishes = await t(() => {
    saveHvWalk({ walks: 3 });
    const d3 = markDish();
    saveHvWalk({ walks: 9 });
    const dCap = markDish();
    saveHvWalk({ walks: 3 });
    return { d3, dCap, added: markUp() };
  });
  ok(dishes.d3 === 14 && dishes.dCap === 16 && dishes.added,
    `the dish scales with walks, capped at 5 (${dishes.d3}, ${dishes.dCap})`);

  // C — the seam
  const seam = await t(() => {
    markAdded = false;
    G.food = 10;
    finishAction({ id: 'mark' });
    const food1 = G.food, n1 = loadHvMark().names;
    finishAction({ id: 'mark' });
    return { food1, n1, food2: G.food, n2: loadHvMark().names };
  });
  ok(seam.food1 === 24 && seam.n1 === 1,
    `the name pays and ticks the tally (food ${seam.food1}, names ${seam.n1})`);
  ok(seam.food2 === 24 && seam.n2 === 1, 'the same session adds one name');

  // D — rearm and the goal
  const goal = await t(() => {
    markAdded = false;
    G.food = 0;
    finishAction({ id: 'mark' });
    const g = GOALS.find(x => x.id === 'mark2');
    return { food: G.food, names: loadHvMark().names, done: g.value() >= g.target };
  });
  ok(goal.food === 14 && goal.names === 2 && goal.done,
    'a rearmed session pays again — two names complete the mark2 goal');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
