/*
 * VOX-3 — the compost heap (re-runnable: classic script, globals reachable,
 * save cleared on first load).
 *  A. The Compost Heap is a registered town building (♻️, lvl 5, kind heap).
 *  B. No heap built → spreadCompost is inert; with a heap but <5 goods it
 *     refuses without consuming anything.
 *  C. A spread eats exactly 5 goods (cheapest first) and boosts every
 *     growing crop by exactly +15% of its grow bar.
 *  D. The 60s cooldown blocks a second spread.
 *  E. A crop pushed past its grow bar ripens through the normal path on
 *     the next plant tick (stage 2).
 *  F. The fifth spread unlocks 🏆 Black Gold; counter survives reload.
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
    if (!sessionStorage.getItem('vcp-init')) {
      sessionStorage.setItem('vcp-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = fn => page.evaluate(fn);

  // A. registered building
  const def = await t(() => ({ d: BUILDINGS.compost, cubes: buildingCubes(BUILDINGS.compost).length }));
  ok(def.d && def.d.ico === '♻️' && def.d.lvl === 5 && def.cubes > 5, `Compost Heap registered (lvl ${def.d.lvl}, ${def.cubes} cubes)`);

  // B. gates
  const gates = await t(() => {
    for (const p of [...W.plants.values()]) removePlant(p);
    state.goods = { crop: 7 };
    state.buildings = state.buildings || {};
    delete state.buildings.compost;
    compostT = 0; state.composted = 0;
    spreadCompost();                                 // no heap → inert
    const noHeap = { goods: state.goods.crop, n: state.composted };
    state.buildings.compost = { x: 8, z: 8 };
    state.goods = { crop: 3 };
    spreadCompost();                                 // too few goods → refuse
    return { noHeap, few: { goods: state.goods.crop, n: state.composted },
      toast: document.body.textContent.includes('Feed the heap 5') };
  });
  ok(gates.noHeap.goods === 7 && gates.noHeap.n === 0, 'no heap built → nothing happens');
  ok(gates.few.goods === 3 && gates.few.n === 0 && gates.toast, 'under 5 goods → refused, nothing consumed');

  // C. a real spread: cheapest-first consumption + exact boost
  const spread = await t(() => {
    state.goods = { crop: 3, honey: 4 };             // crop is cheaper than honey
    const p1 = addPlant(2, 8, 2, 'sunflower');       // grow 45
    const p2 = addPlant(4, 8, 2, 'carrot');          // grow 70
    p1.prog = 10; p2.prog = 20;
    compostT = 0;
    spreadCompost();
    return { crop: state.goods.crop, honey: state.goods.honey,
      p1: p1.prog, p2: p2.prog, n: state.composted, cd: compostT,
      toast: document.body.textContent.includes('surge ahead') };
  });
  ok(spread.crop === 0 && spread.honey === 2, `cheapest goods go first (crop 3→0, honey 4→${spread.honey})`);
  ok(Math.abs(spread.p1 - (10 + 45 * 0.15)) < 1e-9 && Math.abs(spread.p2 - (20 + 70 * 0.15)) < 1e-9,
    `both crops surge exactly +15% of their grow bars (${spread.p1.toFixed(2)}, ${spread.p2.toFixed(2)})`);
  ok(spread.cd === 60 && spread.n === 1 && spread.toast, 'cooldown armed, counter ticks, toast fires');

  // D. cooldown blocks
  const blocked = await t(() => {
    state.goods = { crop: 9 };
    spreadCompost();
    return { goods: state.goods.crop, n: state.composted,
      toast: document.body.textContent.includes('still brewing') };
  });
  ok(blocked.goods === 9 && blocked.n === 1 && blocked.toast, 'the heap refuses while brewing');

  // E. push past the bar → normal ripen path
  const ripened = await t(() => {
    const p = addPlant(6, 8, 2, 'sunflower');
    p.prog = 44; p.stage = 1;                        // 1 short of grow 45
    compostT = 0; state.goods = { crop: 5 };
    spreadCompost();                                 // prog → 50.75
    updatePlants(0.001, { night: 0 });               // the normal tick ripens it
    return { stage: p.stage, prog: p.prog };
  });
  ok(ripened.stage === 2, `a boosted crop ripens through the normal path (stage ${ripened.stage})`);

  // F. Black Gold at five + persistence
  const gold = await t(() => {
    state.composted = 4; compostT = 0; state.goods = { crop: 6 };
    spreadCompost();
    return { n: state.composted, ach: !!state.ach.compost5 };
  });
  ok(gold.n === 5 && gold.ach, '🏆 Black Gold unlocks on the fifth spread');
  await t(() => save());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const back = await t(() => ({ n: state.composted, ach: !!state.ach.compost5, built: !!state.buildings.compost }));
  ok(back.n === 5 && back.ach && back.built, 'counter, achievement and building survive reload');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
