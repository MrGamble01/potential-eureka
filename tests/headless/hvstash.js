/*
 * HV-12 — the Hidden Stash (re-runnable: classic scripts, globals
 * reachable, save cleared on boot).
 *  A. Fresh camp: no stash; the recipe is on the craft list behind the Workbench.
 *  B. Crafting it flips the structure flag (and it has no mesh — it's hidden).
 *  C. Theft losses halved by the stash (exact floor math).
 *  D. The stash stacks with Biscuit's barking (quarter losses).
 *  E. Sweep: the stash halves what a sweep takes — and stacks with Pack Up.
 *  F. The sweep never finds (destroys) the stash itself.
 *  G. Reload keeps it; a pre-HV-12 save migrates to stash-less defaults.
 *  Z. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvstash-init')) {
      sessionStorage.setItem('hvstash-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // A. fresh + recipe
  const fresh = await t(() => {
    const r = RECIPES.find(x => x.id === 'stash');
    return { has: !!G.structures.stash, recipe: !!r, gated: r && r.requires === 'workbench',
      cost: r && r.cost };
  });
  ok(!fresh.has && fresh.recipe && fresh.gated, 'the stash recipe waits behind the Workbench');

  // B. craft it (resolve the in-flight job directly, like the game does on reload)
  const built = await t(() => {
    G.structures.workbench = true;
    const r = RECIPES.find(x => x.id === 'stash');
    Object.entries(r.cost).forEach(([k, v]) => { G[k] = v + 5; });
    G.activeCrafts[r.id] = { start: 0, duration: 0 };
    finishCraft(r);
    return { has: !!G.structures.stash, crafted: G.totalCrafted };
  });
  ok(built.has && built.crafted >= 1, 'crafting flips the hidden structure flag');

  // C. theft halved
  const theft = await t(() => {
    const real = Math.random; Math.random = () => 0.5;
    G.dog = 0; G.cans = 20; G.food = 20; G.scraps = 20; G.morale = 50;
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    Math.random = real;
    return { cans: G.cans, food: G.food, scraps: G.scraps };
  });
  ok(theft.cans === 17 && theft.food === 17 && theft.scraps === 18,
    `theft halved by the stash (cans ${theft.cans}, food ${theft.food}, scraps ${theft.scraps})`);

  // D. stacks with the dog
  const both = await t(() => {
    const real = Math.random; Math.random = () => 0.5;
    G.dog = 2; G.cans = 20; G.food = 20; G.scraps = 20;
    EVENTS_BAD.find(e => e.id === 'theft').effect();
    Math.random = real;
    return { cans: G.cans, food: G.food, scraps: G.scraps };
  });
  ok(both.cans === 19 && both.food === 19 && both.scraps === 19,
    `Biscuit + the stash: quarter losses (cans ${both.cans}, food ${both.food}, scraps ${both.scraps})`);

  // E. sweep halved, stacking with Pack Up
  const sweep = await t(() => {
    const real = Math.random; Math.random = () => 0.5;
    G.dog = 0; G.scraps = 20; G.food = 20; G.morale = 50; G.packedUp = false;
    G.structures.tent = false; G.structures.soup_kitchen = false; G.structures.garden = false;
    G.structures.workbench = false;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    const a = { scraps: G.scraps, food: G.food };
    G.scraps = 20; G.food = 20; G.packedUp = true;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    Math.random = real;
    return { a, b: { scraps: G.scraps, food: G.food } };
  });
  ok(sweep.a.scraps === 15 && sweep.a.food === 17,
    `sweep takes half with a stash (scraps ${sweep.a.scraps}, food ${sweep.a.food})`);
  ok(sweep.b.scraps === 19 && sweep.b.food === 20,
    `packed up + stash: almost nothing lost (scraps ${sweep.b.scraps}, food ${sweep.b.food})`);

  // F. the stash survives the sweep
  const kept = await t(() => !!G.structures.stash);
  ok(kept, 'a sweep never finds the buried stash');

  // G. persistence + migration
  await t(() => saveGame());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const back = await t(() => !!G.structures.stash);
  ok(back, 'reload keeps the stash');
  await t(() => {
    const s = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete s.structures.stash;
    localStorage.setItem('homeless_village_v1', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const legacy = await t(() => G.structures.stash);
  ok(legacy === false, 'pre-HV-12 saves migrate to stash-less defaults');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
