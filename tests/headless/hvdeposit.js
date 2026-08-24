/* HV-20 — the Cart & the Deposit Run (one-shot, classic-script globals).
 * A. Fresh camp: no cart, no run button; the Shopping Cart recipe is
 *    on the workbench (6🧱 + 2🪵); the goal is on the ladder.
 * B. With the cart built the button appears, but under 5 cans it's
 *    not worth the walk (disabled, run refused free).
 * C. The exact haul: 20 cans → +10🩶 +2⭐, the cans zeroed, the day
 *    marked, the tally up one.
 * D. One run a day — a second haul is refused; dawn reopens the
 *    redemption center.
 * E. The cart, the tally and the day guard ride the save; pre-HV-20
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
    if (!sessionStorage.getItem('hvdeposit-init')) {
      sessionStorage.setItem('hvdeposit-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const t = fn => page.evaluate(fn);

  // A
  const fresh = await t(() => {
    const r = RECIPES.find(x => x.id === 'cart');
    return { cart: !!G.structures.cart, btn: !!document.getElementById('action-deposit'),
      recipe: r ? { s: r.cost.scraps, w: r.cost.wood, req: r.requires, gives: r.gives.structure } : null,
      goal: GOALS.some(g => g.id === 'deposit3'), min: DEPOSIT_MIN };
  });
  ok(!fresh.cart && !fresh.btn, 'fresh camp: no cart, no deposit run');
  ok(fresh.recipe && fresh.recipe.s === 6 && fresh.recipe.w === 2
    && fresh.recipe.req === 'workbench' && fresh.recipe.gives === 'cart'
    && fresh.goal && fresh.min === 5,
    'the Shopping Cart recipe is on the workbench (6🧱 + 2🪵); the goal is on the ladder');

  // B — under five cans it's not worth the walk
  const short = await t(() => {
    G.structures.cart = true;
    G.cans = 3;
    buildActionUI();
    const b = document.getElementById('action-deposit');
    const disabled = b ? b.disabled : null;   // read BEFORE finishAction — its generic tail re-enables any action button
    const gw0 = G.goodwill;
    finishAction(depositAction());   // the re-check inside refuses the short haul
    return { btn: !!b, disabled, avail: depositAvailable(),
      cans: G.cans, gw: G.goodwill - gw0, deposits: G.deposits || 0 };
  });
  ok(short.btn && short.disabled && !short.avail,
    'with the cart built the button appears — disabled under 5 cans');
  ok(short.cans === 3 && short.gw === 0 && short.deposits === 0, 'a short haul is refused free');

  // C — the exact haul
  const hauled = await t(() => {
    G.cans = 20; G.goodwill = 0;
    const rep0 = G.rep || 0;
    buildActionUI();
    const enabled = !document.getElementById('action-deposit').disabled;
    finishAction(depositAction());
    return { enabled, gw: G.goodwill, rep: (G.rep || 0) - rep0, cans: G.cans,
      deposits: G.deposits, day: G.depositDay === G.days };
  });
  ok(hauled.enabled, 'at 20 cans the run is worth the walk');
  ok(hauled.gw === 10 && hauled.rep === 2 && hauled.cans === 0 && hauled.deposits === 1 && hauled.day,
    'the exact haul: 20 cans → +10🩶 +2⭐, the cans zeroed');

  // D — one run a day
  const rested = await t(() => {
    G.cans = 12;
    doAction(depositAction());         // the door guard refuses
    const same = { deposits: G.deposits, cans: G.cans };
    G.days += 1;
    finishAction(depositAction());     // dawn reopens the center
    return { same, next: G.deposits, cans: G.cans };
  });
  ok(rested.same.deposits === 1 && rested.same.cans === 12, 'one run a day — the second haul is refused');
  ok(rested.next === 2 && rested.cans === 0, 'dawn reopens the redemption center');

  // E — persistence + legacy migration
  await t(() => saveGame());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const back = await t(() => ({ deposits: G.deposits, cart: !!G.structures.cart,
    done: depositDone(), btn: !!document.getElementById('action-deposit') }));
  ok(back.deposits === 2 && back.cart && back.done && back.btn,
    'the cart, the tally and the day guard ride the save');
  await t(() => {
    const sv = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete sv.deposits; delete sv.depositDay; delete sv.structures.cart;
    localStorage.setItem('homeless_village_v1', JSON.stringify(sv));
    localStorage.setItem = () => {};
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const legacy = await t(() => ({ deposits: G.deposits, day: G.depositDay, cart: G.structures.cart }));
  ok(legacy.deposits === 0 && legacy.day === -9 && legacy.cart === false, 'pre-HV-20 saves migrate clean');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
