/* HV-22 — the Little Free Pantry (one-shot, classic-script globals).
 * A. Fresh camp: no pantry; the Free Pantry recipe is on the
 *    workbench (6🪵 + 2🧱); the goal is on the ladder; the numbers
 *    read 0.5 / 2 / every 5.
 * B. No pantry, no drip: a pinned-generous dawn leaves nothing.
 * C. With the box up, a pinned-generous dawn leaves +2 food and ticks
 *    the fill tally; a pinned-stingy dawn leaves nothing.
 * D. The fifth fill pays +1 rep — the block remembers who keeps the
 *    box up.
 * E. The box and the tally ride the save; a legacy save migrates
 *    clean.
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
    if (!sessionStorage.getItem('hvpantry-init')) {
      sessionStorage.setItem('hvpantry-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => {
    const r = RECIPES.find(x => x.id === 'pantry');
    return { pantry: !!G.structures.pantry,
      recipe: r ? { w: r.cost.wood, s: r.cost.scraps, req: r.requires, gives: r.gives.structure } : null,
      goal: GOALS.some(g => g.id === 'pantry10'),
      consts: [PANTRY_CHANCE, PANTRY_FOOD, PANTRY_REP_EVERY].join(',') };
  });
  ok(!fresh.pantry && fresh.recipe && fresh.recipe.w === 6 && fresh.recipe.s === 2
    && fresh.recipe.req === 'workbench' && fresh.recipe.gives === 'pantry',
    'fresh camp: no pantry; the recipe is on the workbench (6🪵 + 2🧱)');
  ok(fresh.goal && fresh.consts === '0.5,2,5', 'the goal is on the ladder; 0.5 / +2 / every 5');

  // B — no pantry, no drip
  const bare = await t(() => {
    const mr = Math.random;
    Math.random = () => 0;           // the generous branch, if there were a box
    G.food = 10; G.pantryFills = 0;
    pantryAtDawn();
    Math.random = mr;
    return { food: G.food, fills: G.pantryFills };
  });
  ok(bare.food === 10 && bare.fills === 0, 'no pantry, no drip — even on a generous dawn');

  // C — the drip
  const dripped = await t(() => {
    const mr = Math.random;
    G.structures.pantry = true;
    G.food = 10; G.pantryFills = 0;
    Math.random = () => 0;           // generous
    pantryAtDawn();
    const gave = { food: G.food, fills: G.pantryFills };
    Math.random = () => 0.9;         // stingy
    pantryAtDawn();
    Math.random = mr;
    return { gave, food: G.food, fills: G.pantryFills };
  });
  ok(dripped.gave.food === 12 && dripped.gave.fills === 1,
    'a generous dawn leaves +2 food and ticks the tally');
  ok(dripped.food === 12 && dripped.fills === 1, 'a stingy dawn leaves nothing');

  // D — the fifth fill
  const remembered = await t(() => {
    const mr = Math.random;
    Math.random = () => 0;
    G.pantryFills = 4; G.food = 0;
    const rep0 = G.rep || 0;
    pantryAtDawn();
    Math.random = mr;
    return { fills: G.pantryFills, rep: (G.rep || 0) - rep0, food: G.food };
  });
  ok(remembered.fills === 5 && remembered.rep === 1 && remembered.food === 2,
    'the fifth fill pays +1 rep — the block remembers');

  // E — persistence + legacy migration
  await t(() => saveGame());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const back = await t(() => ({ pantry: !!G.structures.pantry, fills: G.pantryFills }));
  ok(back.pantry && back.fills === 5, 'the box and the tally ride the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete sv.pantryFills; delete sv.structures.pantry;
    localStorage.setItem('homeless_village_v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const legacy = await t(() => ({ pantry: G.structures.pantry, fills: G.pantryFills }));
  ok(legacy.pantry === false && legacy.fills === 0, 'pre-HV-22 saves migrate clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
