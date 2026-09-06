/* HV-28 — the Rain Bet (one-shot, classic-script globals).
 * A. The 🎲 action on the bar, the goal on the ladder, constants
 *    2 / 5, no bet riding.
 * B. Placing takes exactly 2 goodwill, marks the day, arms the bet;
 *    a same-day second bet is refused; short goodwill is refused.
 * C. Rain at dawn: Dee pays exactly +5 and the tally ticks.
 * D. A dry dawn: the stake stays gone, the tally holds, the bet
 *    clears.
 * E. Three wins clear the goal value; the ledger rides the save; a
 *    legacy save migrates clean.
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
    if (!sessionStorage.getItem('hvrainbet-init')) {
      sessionStorage.setItem('hvrainbet-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => {
    const a = ACTIONS.find(x => x.id === 'rainbet');
    return { act: !!a, icon: a && a.icon,
      goal: GOALS.some(g => g.id === 'rainbet3'),
      stake: RAINBET_STAKE, pay: RAINBET_PAY, on: G.rainBetOn };
  });
  ok(fresh.act && fresh.icon === '🎲' && fresh.goal, 'the 🎲 Rain Bet is on the bar; the goal is on the ladder');
  ok(fresh.stake === 2 && fresh.pay === 5 && fresh.on === false, '2 against 5 on the slate — no bet riding');

  // B — placing (prime the one-time survive-day goal payouts first so
  // the goodwill deltas below stay exact)
  await t(() => { G.days = 30; finishAction({ id: 'rest' }); });
  const placed = await t(() => {
    G.goodwill = 10; G.days = 4; G.rainBetDay = -9; G.rainBetOn = false;
    finishAction({ id: 'rainbet' });
    const one = { gw: G.goodwill, on: G.rainBetOn, day: G.rainBetDay };
    finishAction({ id: 'rainbet' });
    const two = { gw: G.goodwill };
    G.days = 5; G.rainBetDay = -9; G.rainBetOn = false; G.goodwill = 1;
    finishAction({ id: 'rainbet' });
    return { one, two, broke: { gw: G.goodwill, on: G.rainBetOn } };
  });
  ok(placed.one.gw === 8 && placed.one.on && placed.one.day === 4,
    'placing takes exactly 2 goodwill, marks the day, arms the bet');
  ok(placed.two.gw === 8, 'a same-day second bet is refused');
  ok(placed.broke.gw === 1 && !placed.broke.on, 'short goodwill is refused');

  // helper: a controlled dawn with a chosen sky
  const dawn = (weather) => t(new Function(`
    const real = Math.random;
    Math.random = () => 0.5;
    G.population = 1; G.dog = 0; G.structures.tent = false;
    G.workers.scrapper = null; G.workers.cook = null;
    G.structures.workbench = false; G.structures.toolbox = false;
    G.structures.garden = false; G.structures.barrel = false;
    G.rep = 0; G.snapUntil = null; G.days = 6; G.warmth = 90; G.food = 20;
    G.forecast = '${weather}'; G.lastEventDay = G.days + 5;
    onNewDay();
    Math.random = real;
    return { gw: G.goodwill, on: G.rainBetOn, won: G.rainBetsWon || 0 };
  `));

  // C — rain pays
  await t(() => { G.goodwill = 10; G.rainBetOn = true; G.rainBetsWon = 0; });
  const rain = await dawn('rain');
  ok(rain.gw === 15 && !rain.on && rain.won === 1, 'rain at dawn — Dee pays exactly +5, the tally ticks');

  // D — dry morning
  await t(() => { G.goodwill = 10; G.rainBetOn = true; });
  const dry = await dawn('clear');
  ok(dry.gw === 10 && !dry.on && dry.won === 1, 'a dry dawn — the stake stays gone, the bet clears');

  // E — the goal + persistence
  await t(() => { G.rainBetsWon = 3; G.rainBetDay = 7; saveGame(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const back = await t(() => ({ won: G.rainBetsWon, day: G.rainBetDay,
    goal: GOALS.find(g => g.id === 'rainbet3').value() }));
  ok(back.won === 3 && back.day === 7 && back.goal === 3,
    'three wins clear the goal value; the ledger rides the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete sv.rainBetOn; delete sv.rainBetDay; delete sv.rainBetsWon;
    localStorage.setItem('homeless_village_v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const legacy = await t(() => ({ on: G.rainBetOn, day: G.rainBetDay, won: G.rainBetsWon }));
  ok(legacy.on === false && legacy.day === -9 && legacy.won === 0, 'a pre-HV-28 save migrates clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
