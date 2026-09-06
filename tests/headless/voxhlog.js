/* VOX-40 — the Harbor Log (classic-script page, no hook).
 * A. Constants vox-guestbook/25+5; The Harbor Log registered; two
 *    ringings leave no log out, chip hidden.
 * B. The purse scales with ringings, cap 5.
 * C. THE SEAM: with the log out, a leaf-through pays and ticks the
 *    tally; the same session leafs once.
 * D. A rearmed session pays again; three leafs crown the ach.
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
    if (!sessionStorage.getItem('voxhlog-init')) {
      sessionStorage.setItem('voxhlog-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-anniversary');
      localStorage.removeItem('vox-guestbook');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — no log yet
  const bare = await t(() => {
    saveMooring({ toasts: 2 });
    saveHLog({ leafs: 0 });
    const out2 = hlogOut();
    hlogLeafed = false;
    state.coins = 100;
    leafHarborLog();
    refreshHLogHud();
    return { key: HLOG_KEY, base: HLOG_BASE, per: HLOG_PER,
      ach: ACH.some(a => a[0] === 'hlog3'),
      hud: !!document.getElementById('hlogHud'),
      hidden: document.getElementById('hlogHud').style.display === 'none',
      out2, coins: state.coins, leafs: loadHLog().leafs };
  });
  ok(bare.key === 'vox-guestbook' && bare.base === 25 && bare.per === 5 && bare.ach && bare.hud,
    'vox-guestbook at 25+5 — The Harbor Log and its HUD chip are registered');
  ok(!bare.out2 && bare.coins === 100 && bare.leafs === 0 && bare.hidden,
    'two ringings leave no log out — chip hidden');

  // B — the purse scales with the ringings
  const purses = await t(() => {
    saveMooring({ toasts: 3 });
    const p3 = hlogPurse();
    saveMooring({ toasts: 9 });
    const pCap = hlogPurse();
    saveMooring({ toasts: 3 });
    return { p3, pCap, out: hlogOut() };
  });
  ok(purses.p3 === 40 && purses.pCap === 50 && purses.out,
    `the purse scales with ringings, capped at 5 (${purses.p3}, ${purses.pCap})`);

  // C — the seam
  const seam = await t(() => {
    hlogLeafed = false;
    state.coins = 100;
    leafHarborLog();
    const coins1 = state.coins, leafs1 = loadHLog().leafs;
    leafHarborLog();
    return { coins1, leafs1, coins2: state.coins, leafs2: loadHLog().leafs };
  });
  ok(seam.coins1 === 140 && seam.leafs1 === 1,
    `the leaf-through pays and ticks the tally (${seam.coins1} 🪙, leafs ${seam.leafs1})`);
  ok(seam.coins2 === 140 && seam.leafs2 === 1, 'the same session leafs once');

  // D — rearm and crown
  const crowned = await t(() => {
    hlogLeafed = false;
    state.coins = 0;
    leafHarborLog();
    const paidAgain = state.coins === 40 && loadHLog().leafs === 2;
    const a = ACH.find(x => x[0] === 'hlog3');
    const before = a[3]();
    saveHLog({ leafs: 3 });
    return { paidAgain, before, after: a[3]() };
  });
  ok(crowned.paidAgain, 'a rearmed session pays again');
  ok(!crowned.before && crowned.after, 'three leafs crown The Harbor Log');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
