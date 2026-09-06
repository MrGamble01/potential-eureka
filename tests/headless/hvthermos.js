/* HV-35 — the Old Thermos (classic-script page, no hook).
 * A. Constants hv-thermos/base 2; the 🫖 action row and the thermos2
 *    goal stand; nothing passed.
 * B. A cold thermos refuses — the bridge has no story to warm it.
 * C. The power scales with the memory: base + hold mornings (cap 5)
 *    + notes (cap 3), both caps enforced.
 * D. A pass lifts morale by exactly the power, ticks the tally, and
 *    the same session refuses a second pass.
 * E. Rearmed sessions tally on to the thermos2 goal; the tally
 *    survives Start Over in its own key.
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
    if (!sessionStorage.getItem('hvthermos-init')) {
      sessionStorage.setItem('hvthermos-init', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-fridge');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-letter');
      localStorage.removeItem('hv-history');
      localStorage.removeItem('hv-thermos');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => ({
    key: THERMOS_KEY, base: THERMOS_BASE,
    row: ACTIONS.some(a => a.id === 'thermos'),
    goal: GOALS.some(g => g.id === 'thermos2'),
    th: loadThermos(),
  }));
  ok(fresh.key === 'hv-thermos' && fresh.base === 2 && fresh.row && fresh.goal,
    'hv-thermos at base 2 — the 🫖 action row and the thermos2 goal stand');
  ok(fresh.th.uses === 0, 'nothing passed');

  // B — the cold thermos
  const cold = await t(() => {
    finishAction({ id: 'thermos' });
    return loadThermos();
  });
  ok(cold.uses === 0, 'a cold thermos refuses — the bridge has no story to warm it');

  // C — the scaling
  const scaled = await t(() => {
    saveHvRec({ days: 14, beats: 4 });
    saveHvNote({ read: 2 });
    const p1 = thermosPower();
    saveHvRec({ days: 14, beats: 9 });
    saveHvNote({ read: 7 });
    const p2 = thermosPower();
    saveHvRec({ days: 14, beats: 4 });
    saveHvNote({ read: 2 });
    return { p1, p2 };
  });
  ok(scaled.p1 === 8, 'the power scales with the memory (2 + 4 mornings + 2 notes = 8)');
  ok(scaled.p2 === 10, 'both caps enforced at 2 + 5 + 3 = 10');

  // D — the pass, atomically
  const passed = await t(() => {
    G.morale = 50;
    const before = G.morale;
    finishAction({ id: 'thermos' });
    const after = G.morale;
    const one = loadThermos().uses;
    finishAction({ id: 'thermos' });
    return { before, after, one, two: loadThermos().uses, used: thermosUsed };
  });
  ok(passed.after - passed.before === 8 && passed.one === 1,
    `a pass lifts morale by exactly the power (${passed.before} -> ${passed.after})`);
  ok(passed.two === 1 && passed.used, 'the same session refuses a second pass');

  // E — rearm to the goal + Start Over survival
  const goal = await t(() => {
    thermosUsed = false;
    finishAction({ id: 'thermos' });
    const g = GOALS.find(x => x.id === 'thermos2');
    return { v: g.value(), target: g.target };
  });
  ok(goal.v === 2 && goal.v >= goal.target, 'two sessions passed complete the thermos2 goal');
  await page.evaluate(() => {
    const real = Storage.prototype.setItem.bind(localStorage);
    localStorage.removeItem('homeless_village_v1');
    Storage.prototype.setItem = function (k, v) { if (k === 'homeless_village_v1') return; real(k, v); };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const back = await t(() => ({ th: loadThermos(), used: thermosUsed }));
  ok(back.th.uses === 2 && !back.used, 'the tally survives Start Over in its own key — and the thermos refills');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
