/* HV-49 — the Coffee Can (classic-script page, no hook).
 * A. Constants hv-capsule/8+1; the 📦 row and can2 goal stand; two
 *    playings bury nothing.
 * B. The dish scales with playings, cap 5.
 * C. THE SEAM: with the can buried, a dig pays and ticks the
 *    tally; the same session digs once.
 * D. A rearmed session pays again; two digs complete the goal.
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
    if (!sessionStorage.getItem('hvcan-init')) {
      sessionStorage.setItem('hvcan-init', '1');
      localStorage.removeItem('hv-song');
      localStorage.removeItem('hv-capsule');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  const bare = await t(() => {
    saveHvSong({ plays: 2 });
    saveHvCan({ digs: 0 });
    const buried2 = canBuried();
    G.canDay = -1;
    G.food = 10;
    finishAction({ id: 'can' });
    return { key: HVCAN_KEY, base: HVCAN_BASE, per: HVCAN_PER,
      row: ACTIONS.some(a => a.id === 'can'),
      goal: GOALS.some(g => g.id === 'can2'),
      buried2, food: G.food, digs: loadHvCan().digs };
  });
  ok(bare.key === 'hv-capsule' && bare.base === 8 && bare.per === 1 && bare.row && bare.goal,
    'hv-capsule at 8+1 — the 📦 row and the can2 goal stand');
  ok(!bare.buried2 && bare.food === 10 && bare.digs === 0,
    'two playings bury nothing — the dig refuses');

  const dishes = await t(() => {
    saveHvSong({ plays: 3 });
    const d3 = canDish();
    saveHvSong({ plays: 9 });
    const dCap = canDish();
    saveHvSong({ plays: 3 });
    return { d3, dCap, buried: canBuried() };
  });
  ok(dishes.d3 === 11 && dishes.dCap === 13 && dishes.buried,
    `the dish scales with playings, capped at 5 (${dishes.d3}, ${dishes.dCap})`);

  const seam = await t(() => {
    G.canDay = -1;
    G.food = 10;
    finishAction({ id: 'can' });
    const food1 = G.food, digs1 = loadHvCan().digs;
    finishAction({ id: 'can' });
    return { food1, digs1, food2: G.food, digs2: loadHvCan().digs };
  });
  ok(seam.food1 === 21 && seam.digs1 === 1,
    `the dig pays and ticks the tally (food ${seam.food1}, digs ${seam.digs1})`);
  ok(seam.food2 === 21 && seam.digs2 === 1, 'the same session digs once');

  const goal = await t(() => {
    G.canDay = -1;
    G.food = 0;
    finishAction({ id: 'can' });
    const g = GOALS.find(x => x.id === 'can2');
    return { food: G.food, digs: loadHvCan().digs, done: g.value() >= g.target };
  });
  ok(goal.food === 11 && goal.digs === 2 && goal.done,
    'a rearmed session pays again — two digs complete the can2 goal');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
