/* HV-41 — the Spare Mugs (classic-script page, no hook).
 * A. Constants hv-keepsake/+2; the mugs2 goal stands; two visits
 *    leave no mugs — the thermos round pays no food.
 * B. THE SEAM: at three visits the mugs come off the shelf, and the
 *    round pays +2 food and ticks the tally.
 * C. The same session pours once — no second pay.
 * D. A rearmed session pays again; two pays complete the goal.
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
    if (!sessionStorage.getItem('hvmugs-init')) {
      sessionStorage.setItem('hvmugs-init', '1');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-letter');
      localStorage.removeItem('hv-visitor');
      localStorage.removeItem('hv-keepsake');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — two visits leave no mugs
  const bare = await t(() => {
    saveHvRec({ days: 5, beats: 0 });
    saveMarisol({ visits: 2 });
    saveHvKeep({ pays: 0 });
    const mugs2 = thermosHasMugs();
    G.thermosDay = -1;
    G.food = 10;
    const m0 = G.morale;
    finishAction({ id: 'thermos' });
    return { key: HVKEEP_KEY, food: HVKEEP_FOOD,
      goal: GOALS.some(g => g.id === 'mugs2'),
      mugs2, foodAfter: G.food, pays: loadHvKeep().pays, moraleRose: G.morale > m0 || G.morale === 100 };
  });
  ok(bare.key === 'hv-keepsake' && bare.food === 2 && bare.goal,
    'hv-keepsake at +2 food — the mugs2 goal stands');
  ok(!bare.mugs2 && bare.foodAfter === 10 && bare.pays === 0 && bare.moraleRose,
    'two visits leave no mugs — the round warms morale but pays no food');

  // B — the seam
  const seam = await t(() => {
    saveMarisol({ visits: 3 });
    const mugs3 = thermosHasMugs();
    G.thermosDay = -1;
    G.food = 10;
    finishAction({ id: 'thermos' });
    return { mugs3, food: G.food, pays: loadHvKeep().pays };
  });
  ok(seam.mugs3, 'at three visits the mugs come off the shelf');
  ok(seam.food === 12 && seam.pays === 1,
    `the round with the mugs pays the food and ticks the tally (food ${seam.food}, pays ${seam.pays})`);

  // C — once a session
  const again = await t(() => {
    finishAction({ id: 'thermos' });
    return { food: G.food, pays: loadHvKeep().pays };
  });
  ok(again.food === 12 && again.pays === 1, 'the same session pours once — no second pay');

  // D — rearm and the goal
  const goal = await t(() => {
    G.thermosDay = -1;
    G.food = 0;
    finishAction({ id: 'thermos' });
    const g = GOALS.find(x => x.id === 'mugs2');
    return { food: G.food, pays: loadHvKeep().pays, done: g.value() >= g.target };
  });
  ok(goal.food === 2 && goal.pays === 2 && goal.done,
    'a rearmed session pays again — two pays complete the mugs2 goal');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
