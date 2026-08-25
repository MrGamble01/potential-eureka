/* HV-43 — the Reunion Snapshot (classic-script page, no hook).
 * A. Constants hv-portrait/2+1; the 📷 row and snapshot2 goal stand;
 *    two reunions tuck no snapshot — the door stays bare.
 * B. The dish scales with reunions held, cap 5.
 * C. THE SEAM: with the snapshot tucked in, a look pays and ticks
 *    the tally; the same session looks once.
 * D. A rearmed session pays again; two looks complete the goal.
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
    if (!sessionStorage.getItem('hvsnapshot-init')) {
      sessionStorage.setItem('hvsnapshot-init', '1');
      localStorage.removeItem('hv-reunion');
      localStorage.removeItem('hv-portrait');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — the bare door
  const bare = await t(() => {
    saveHvReunion({ held: 2 });
    saveHvSnap({ looks: 0 });
    const hangs2 = snapshotHangs();
    snapshotLooked = false;
    G.food = 10;
    finishAction({ id: 'snapshot' });
    return { key: HVSNAP_KEY, base: HVSNAP_BASE, per: HVSNAP_PER,
      row: ACTIONS.some(a => a.id === 'snapshot'),
      goal: GOALS.some(g => g.id === 'snapshot2'),
      hangs2, food: G.food, looks: loadHvSnap().looks };
  });
  ok(bare.key === 'hv-portrait' && bare.base === 2 && bare.per === 1 && bare.row && bare.goal,
    'hv-portrait at 2+1 — the 📷 row and the snapshot2 goal stand');
  ok(!bare.hangs2 && bare.food === 10 && bare.looks === 0,
    'two reunions tuck no snapshot — the door stays bare');

  // B — the dish scales with the reunions
  const dishes = await t(() => {
    saveHvReunion({ held: 3 });
    const d3 = snapshotDish();
    saveHvReunion({ held: 9 });
    const dCap = snapshotDish();
    saveHvReunion({ held: 3 });
    return { d3, dCap, hangs: snapshotHangs() };
  });
  ok(dishes.d3 === 5 && dishes.dCap === 7 && dishes.hangs,
    `the dish scales with reunions held, capped at 5 (${dishes.d3}, ${dishes.dCap})`);

  // C — the seam
  const seam = await t(() => {
    snapshotLooked = false;
    G.food = 10;
    finishAction({ id: 'snapshot' });
    const food1 = G.food, looks1 = loadHvSnap().looks;
    finishAction({ id: 'snapshot' });
    return { food1, looks1, food2: G.food, looks2: loadHvSnap().looks };
  });
  ok(seam.food1 === 15 && seam.looks1 === 1,
    `the look pays and ticks the tally (food ${seam.food1}, looks ${seam.looks1})`);
  ok(seam.food2 === 15 && seam.looks2 === 1, 'the same session looks once');

  // D — rearm and the goal
  const goal = await t(() => {
    snapshotLooked = false;
    G.food = 0;
    finishAction({ id: 'snapshot' });
    const g = GOALS.find(x => x.id === 'snapshot2');
    return { food: G.food, looks: loadHvSnap().looks, done: g.value() >= g.target };
  });
  ok(goal.food === 5 && goal.looks === 2 && goal.done,
    'a rearmed session pays again — two looks complete the snapshot2 goal');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
