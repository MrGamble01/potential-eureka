/* HV-21 — the Newcomer (one-shot, classic-script globals).
 * A. Fresh camp: no ask, no button; the 'Welcome 2 newcomers' goal is
 *    on the ladder; the numbers read 6🍞 + 4🪵 / 3-day ask / every 9 /
 *    cap 6.
 * B. The gates: an unknown camp, a tentless camp, and a full camp all
 *    hear no ask at dawn; a Respected camp with a tent and room opens
 *    one, with the button on the rail.
 * C. A short pantry is refused free; the funded welcome seats them —
 *    pop +1, +6 morale, +2 rep, the ask closes, the tally ticks, one
 *    community figure joins the scene.
 * D. The ask lapses after 3 unfunded days, and the next only opens
 *    after the 9-day cadence.
 * E. The tally, cadence day and a pending ask ride the save; legacy
 *    saves migrate clean.
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
    if (!sessionStorage.getItem('hvnewcomer-init')) {
      sessionStorage.setItem('hvnewcomer-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => ({
    ask: !!G.newcomerAsk, btn: !!document.getElementById('action-newcomer'),
    goal: GOALS.some(g => g.id === 'welcome2'),
    consts: [NEWCOMER_COST_FOOD, NEWCOMER_COST_WOOD, NEWCOMER_ASK_DAYS, NEWCOMER_EVERY, NEWCOMER_POP_MAX].join(','),
  }));
  ok(!fresh.ask && !fresh.btn, 'fresh camp: no ask, no button');
  ok(fresh.goal && fresh.consts === '6,4,3,9,6',
    "the goal is on the ladder; 6🍞 + 4🪵 / 3-day ask / every 9 / cap 6");

  // B — the gates
  const gated = await t(() => {
    G.days = 20; G.newcomerLastDay = -9; G.newcomerAsk = null;
    G.rep = 0; G.structures.tent = true; G.population = 2;
    newcomerAtDawn();
    const unknown = !!G.newcomerAsk;
    G.rep = 60; G.structures.tent = false;
    newcomerAtDawn();
    const tentless = !!G.newcomerAsk;
    G.structures.tent = true; G.population = 6;
    newcomerAtDawn();
    const full = !!G.newcomerAsk;
    G.population = 2;
    newcomerAtDawn();
    return { unknown, tentless, full, opened: !!G.newcomerAsk,
      btn: !!document.getElementById('action-newcomer') };
  });
  ok(!gated.unknown && !gated.tentless && !gated.full,
    'an unknown camp, a tentless camp, and a full camp all hear no ask');
  ok(gated.opened && gated.btn, 'a Respected camp with a tent and room opens one, button on the rail');

  // C — refusal and the welcome
  const seated = await t(() => {
    G.food = 2; G.wood = 10;
    doAction(newcomerAction());          // the door guard refuses the short pantry
    const short = { pop: G.population, welcomes: G.welcomes || 0 };
    G.food = 10; G.wood = 10; G.morale = 50;
    const rep0 = G.rep, figs0 = figures.filter(f => f.userData && f.userData.type === 'community').length;
    finishAction(newcomerAction());
    return { short,
      pop: G.population, food: G.food, wood: G.wood, morale: G.morale,
      rep: G.rep - rep0, welcomes: G.welcomes, ask: !!G.newcomerAsk,
      figs: figures.filter(f => f.userData && f.userData.type === 'community').length - figs0 };
  });
  ok(seated.short.pop === 2 && seated.short.welcomes === 0, 'a short pantry is refused free');
  ok(seated.pop === 3 && seated.food === 4 && seated.wood === 6 && seated.morale === 56
    && seated.rep === 2 && seated.welcomes === 1 && !seated.ask && seated.figs === 1,
    'the welcome seats them: pop +1, +6 morale, +2 rep, one figure joins, the ask closes');

  // D — the lapse and the cadence
  const lapsed = await t(() => {
    G.newcomerAsk = { day: G.days - 3 };
    newcomerAtDawn();
    const gone = !G.newcomerAsk;
    G.newcomerLastDay = G.days - 5;      // inside the 9-day cadence
    newcomerAtDawn();
    const early = !!G.newcomerAsk;
    G.newcomerLastDay = G.days - 9;
    newcomerAtDawn();
    return { gone, early, reopened: !!G.newcomerAsk };
  });
  ok(lapsed.gone && !lapsed.early && lapsed.reopened,
    'the ask lapses after 3 days; the next only opens after the 9-day cadence');

  // E — persistence + legacy migration
  await t(() => saveGame());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const back = await t(() => ({
    welcomes: G.welcomes, ask: !!G.newcomerAsk, last: G.newcomerLastDay,
    btn: !!document.getElementById('action-newcomer') }));
  ok(back.welcomes === 1 && back.ask && typeof back.last === 'number' && back.btn,
    'the tally, cadence day and a pending ask ride the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete sv.welcomes; delete sv.newcomerLastDay; delete sv.newcomerAsk;
    localStorage.setItem('homeless_village_v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const legacy = await t(() => ({ welcomes: G.welcomes, last: G.newcomerLastDay, ask: !!G.newcomerAsk }));
  ok(legacy.welcomes === 0 && legacy.last === -9 && !legacy.ask, 'pre-HV-21 saves migrate clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
