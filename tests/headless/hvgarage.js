/* HV-29 — Marisol's Garage (one-shot, classic-script globals).
 * A. The 🚙 action on the bar, the goal on the ladder, cost 2, no
 *    cover riding.
 * B. Asking the favor takes exactly 2 goodwill and arms the cover; a
 *    second ask is refused; short goodwill is refused.
 * C. A covered sweep confiscates nothing — the cover is spent, the
 *    tally ticks, the tent still falls.
 * D. An uncovered sweep takes its pinned cut as ever.
 * E. Two rode-out sweeps clear the goal value; the ledger rides the
 *    save; a legacy save migrates clean.
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
    if (!sessionStorage.getItem('hvgarage-init')) {
      sessionStorage.setItem('hvgarage-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => {
    const a = ACTIONS.find(x => x.id === 'garage');
    return { act: !!a, icon: a && a.icon,
      goal: GOALS.some(g => g.id === 'garage2'),
      cost: GARAGE_COST, cover: !!G.garageCover };
  });
  ok(fresh.act && fresh.icon === '🚙' && fresh.goal, 'the 🚙 Garage Favor is on the bar; the goal is on the ladder');
  ok(fresh.cost === 2 && !fresh.cover, '2 goodwill on the slate — no cover riding');

  // B — the favor (prime the one-time survive-goal payouts first so
  // the goodwill deltas stay exact)
  await t(() => { G.days = 30; finishAction({ id: 'rest' }); });
  const placed = await t(() => {
    G.goodwill = 10; G.garageCover = false;
    finishAction({ id: 'garage' });
    const one = { gw: G.goodwill, cover: G.garageCover };
    finishAction({ id: 'garage' });
    const two = { gw: G.goodwill };
    G.garageCover = false; G.goodwill = 1;
    finishAction({ id: 'garage' });
    return { one, two, broke: { gw: G.goodwill, cover: G.garageCover } };
  });
  ok(placed.one.gw === 8 && placed.one.cover, 'the favor takes exactly 2 goodwill and arms the cover');
  ok(placed.two.gw === 8, 'a second ask is refused while the cover rides');
  ok(placed.broke.gw === 1 && !placed.broke.cover, 'short goodwill is refused');

  // C — the covered sweep
  const covered = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.garageCover = true; G.garageSaves = 0; G.packedUp = false;
    G.scraps = 10; G.food = 10; G.morale = 80;
    G.structures.tent = true; G.structures.stash = false;
    G.structures.soup_kitchen = false; G.structures.workbench = false; G.structures.garden = false;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    Math.random = real;
    return { scraps: G.scraps, food: G.food, cover: G.garageCover,
      saves: G.garageSaves, tent: G.structures.tent };
  });
  ok(covered.scraps === 10 && covered.food === 10 && !covered.cover && covered.saves === 1,
    'a covered sweep confiscates nothing — the cover is spent, the tally ticks');
  ok(!covered.tent, 'the tent still falls — the garage holds goods, not shelter');

  // D — the uncovered sweep (pinned 0.5: scraps lose 50%, food 35%)
  const raw = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.garageCover = false; G.packedUp = false;
    G.scraps = 10; G.food = 10;
    G.structures.tent = false; G.structures.stash = false;
    G.structures.soup_kitchen = false; G.structures.workbench = false; G.structures.garden = false;
    EVENTS_BAD.find(e => e.id === 'sweep').effect();
    Math.random = real;
    return { scraps: G.scraps, food: G.food, saves: G.garageSaves };
  });
  ok(raw.scraps === 5 && raw.food === 7 && raw.saves === 1,
    'an uncovered sweep takes its pinned cut as ever');

  // E — the goal + persistence
  await t(() => { G.garageSaves = 2; G.garageCover = true; saveGame(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const back = await t(() => ({ saves: G.garageSaves, cover: G.garageCover,
    goal: GOALS.find(g => g.id === 'garage2').value() }));
  ok(back.saves === 2 && back.cover === true && back.goal === 2,
    'two rode-out sweeps clear the goal value; the ledger rides the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete sv.garageCover; delete sv.garageSaves;
    localStorage.setItem('homeless_village_v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const legacy = await t(() => ({ cover: G.garageCover, saves: G.garageSaves }));
  ok(legacy.cover === false && legacy.saves === 0, 'a pre-HV-29 save migrates clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
