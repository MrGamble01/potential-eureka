/* HV-30 — the Borrowed Favor (one-shot, classic-script globals).
 * A. The 🤲 action on the bar, the goal on the ladder, 4-against-5 on
 *    the slate, no debt standing.
 * B. Borrowing hands over exactly +4 and books 5 owed; a second loan
 *    is refused mid-debt.
 * C. A controlled dawn collects exactly one goodwill and counts the
 *    ledger down.
 * D. A broke dawn collects nothing — Ray remembers, the debt holds.
 * E. The final morning clears the ledger and counts the loan repaid.
 * F. Two repaid loans clear the goal value; the ledger rides the
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
    if (!sessionStorage.getItem('hvborrow-init')) {
      sessionStorage.setItem('hvborrow-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => {
    const a = ACTIONS.find(x => x.id === 'borrow');
    return { act: !!a, icon: a && a.icon,
      goal: GOALS.some(g => g.id === 'borrow2'),
      amt: BORROW_AMT, owed: BORROW_OWED, debt: G.rayDebt || 0 };
  });
  ok(fresh.act && fresh.icon === '🤲' && fresh.goal, 'the 🤲 Borrow is on the bar; the goal is on the ladder');
  ok(fresh.amt === 4 && fresh.owed === 5 && fresh.debt === 0, '4 against 5 on the slate — no debt standing');

  // B — the front (prime the survive-goal payouts first)
  await t(() => { G.days = 30; finishAction({ id: 'rest' }); });
  const fronted = await t(() => {
    G.goodwill = 5; G.rayDebt = 0;
    finishAction({ id: 'borrow' });
    const one = { gw: G.goodwill, debt: G.rayDebt };
    finishAction({ id: 'borrow' });
    return { one, two: { gw: G.goodwill, debt: G.rayDebt } };
  });
  ok(fronted.one.gw === 9 && fronted.one.debt === 5, 'borrowing hands over exactly +4 and books 5 owed');
  ok(fronted.two.gw === 9 && fronted.two.debt === 5, 'a second loan is refused mid-debt');

  // helper: a controlled dawn
  const dawn = () => t(new Function(`
    const real = Math.random;
    Math.random = () => 0.5;
    G.population = 1; G.dog = 0; G.structures.tent = false;
    G.workers.scrapper = null; G.workers.cook = null;
    G.structures.workbench = false; G.structures.toolbox = false;
    G.structures.garden = false; G.structures.barrel = false;
    G.rep = 0; G.snapUntil = null; G.days = 6; G.warmth = 90; G.food = 20;
    G.forecast = 'clear'; G.lastEventDay = G.days + 5;
    G.rainBetOn = false; G.garageCover = false;
    onNewDay();
    Math.random = real;
    return { gw: G.goodwill, debt: G.rayDebt || 0, loans: G.rayLoans || 0 };
  `));

  // C — the morning collection
  await t(() => { G.goodwill = 10; G.rayDebt = 5; G.rayLoans = 0; });
  const paid = await dawn();
  ok(paid.gw === 9 && paid.debt === 4, 'a dawn collects exactly one goodwill and counts the ledger down');

  // D — the broke morning
  await t(() => { G.goodwill = 0; });
  const broke = await dawn();
  ok(broke.gw === 0 && broke.debt === 4, 'a broke dawn collects nothing — Ray remembers');

  // E — the clear
  await t(() => { G.goodwill = 10; G.rayDebt = 1; });
  const cleared = await dawn();
  ok(cleared.gw === 9 && cleared.debt === 0 && cleared.loans === 1,
    'the final morning clears the ledger and counts the loan repaid');

  // F — the goal + persistence
  await t(() => { G.rayLoans = 2; G.rayDebt = 3; saveGame(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const back = await t(() => ({ loans: G.rayLoans, debt: G.rayDebt,
    goal: GOALS.find(g => g.id === 'borrow2').value() }));
  ok(back.loans === 2 && back.debt === 3 && back.goal === 2,
    'two repaid loans clear the goal value; the ledger rides the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete sv.rayDebt; delete sv.rayLoans;
    localStorage.setItem('homeless_village_v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const legacy = await t(() => ({ debt: G.rayDebt, loans: G.rayLoans }));
  ok(legacy.debt === 0 && legacy.loans === 0, 'a pre-HV-30 save migrates clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
