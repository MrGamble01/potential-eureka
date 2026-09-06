/* HV-89 — Free Pantry said take what you need, then a stingy dawn
 * left a starving camp empty.
 *
 * RECIPES.pantry.desc: "take what you need, leave what you can."
 * pantryAtDawn rolled 50% and returned. A stocked camp missing the
 * roll is "leave what you can." An empty pot missing the roll is
 * the take that never happened.
 *
 * hvpantry pins the generous/stingy drip. It never asked what the
 * box does when G.food is already 0.
 *
 *  A. The recipe still promises take what you need.
 *  B. A stocked box on a stingy dawn still leaves nothing — hvpantry.
 *  C. An empty pot on a stingy dawn takes +2. The tally ticks.
 *  D. Isolation: no box, empty pot, stingy — still nothing.
 *     A generous empty pot still pays (hvpantry's fifth-fill case).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives pantryAtDawn().
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
    if (!sessionStorage.getItem('hvneed-init')) {
      sessionStorage.setItem('hvneed-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const src = await page.evaluate(() => {
    const r = RECIPES.find(x => x.id === 'pantry');
    return { desc: r && r.desc, chance: PANTRY_CHANCE, food: PANTRY_FOOD };
  });
  ok(src && /take what you need/i.test(src.desc),
    `the Free Pantry still promises take what you need (got ${JSON.stringify(src && src.desc)})`);
  ok(src.chance === 0.5 && src.food === 2,
    `the neighbor drip is still half the dawns, +2 (chance ${src.chance}, food ${src.food})`);

  const stocked = await page.evaluate(() => {
    const real = Math.random; Math.random = () => 0.9;
    G.structures.pantry = true;
    G.food = 10; G.pantryFills = 1;
    pantryAtDawn();
    Math.random = real;
    return { food: G.food, fills: G.pantryFills };
  });
  ok(stocked.food === 10 && stocked.fills === 1,
    `a stocked box on a stingy dawn still leaves nothing (food ${stocked.food}, fills ${stocked.fills})`);

  const need = await page.evaluate(() => {
    const real = Math.random; Math.random = () => 0.9;
    G.structures.pantry = true;
    G.food = 0; G.pantryFills = 1;
    pantryAtDawn();
    Math.random = real;
    return { food: G.food, fills: G.pantryFills };
  });
  ok(need.food === 2 && need.fills === 2,
    `HV-89: an empty pot takes what it needs on a stingy dawn (food ${need.food}, fills ${need.fills})`);

  const iso = await page.evaluate(() => {
    const real = Math.random; Math.random = () => 0.9;
    G.structures.pantry = false;
    G.food = 0; G.pantryFills = 0;
    pantryAtDawn();
    const bare = { food: G.food, fills: G.pantryFills };
    Math.random = () => 0;
    G.structures.pantry = true;
    G.food = 0; G.pantryFills = 4;
    pantryAtDawn();
    Math.random = real;
    const generous = { food: G.food, fills: G.pantryFills };
    return { bare, generous };
  });
  ok(iso.bare.food === 0 && iso.bare.fills === 0,
    `no box, empty pot, stingy — still nothing`);
  ok(iso.generous.food === 2 && iso.generous.fills === 5,
    `a generous empty pot still pays — hvpantry's fifth fill stays true`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
