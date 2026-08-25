/* VOX-41 — the Harbor Bench (classic-script page, no hook).
 * A. Constants vox-bench/30+5; The Harbor Bench registered; two
 *    leafs build no bench, chip hidden.
 * B. The purse scales with leafs, cap 5.
 * C. THE SEAM: with the bench built, a sit pays and ticks the
 *    tally; the same session sits once.
 * D. A rearmed session pays again; three sits crown the ach.
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
    if (!sessionStorage.getItem('voxbench-init')) {
      sessionStorage.setItem('voxbench-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-guestbook');
      localStorage.removeItem('vox-bench');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — no bench yet
  const bare = await t(() => {
    saveHLog({ leafs: 2 });
    saveHBench({ sits: 0 });
    const built2 = hbenchBuilt();
    hbenchSat = false;
    state.coins = 100;
    sitHarborBench();
    refreshHBenchHud();
    return { key: HBEN_KEY, base: HBEN_BASE, per: HBEN_PER,
      ach: ACH.some(a => a[0] === 'hbench3'),
      hud: !!document.getElementById('hbenchHud'),
      hidden: document.getElementById('hbenchHud').style.display === 'none',
      built2, coins: state.coins, sits: loadHBench().sits };
  });
  ok(bare.key === 'vox-bench' && bare.base === 30 && bare.per === 5 && bare.ach && bare.hud,
    'vox-bench at 30+5 — The Harbor Bench and its HUD chip are registered');
  ok(!bare.built2 && bare.coins === 100 && bare.sits === 0 && bare.hidden,
    'two leafs build no bench — chip hidden');

  // B — the purse scales with the leafs
  const purses = await t(() => {
    saveHLog({ leafs: 3 });
    const p3 = hbenchPurse();
    saveHLog({ leafs: 9 });
    const pCap = hbenchPurse();
    saveHLog({ leafs: 3 });
    return { p3, pCap, built: hbenchBuilt() };
  });
  ok(purses.p3 === 45 && purses.pCap === 55 && purses.built,
    `the purse scales with leafs, capped at 5 (${purses.p3}, ${purses.pCap})`);

  // C — the seam
  const seam = await t(() => {
    hbenchSat = false;
    state.coins = 100;
    sitHarborBench();
    const coins1 = state.coins, sits1 = loadHBench().sits;
    sitHarborBench();
    return { coins1, sits1, coins2: state.coins, sits2: loadHBench().sits };
  });
  ok(seam.coins1 === 145 && seam.sits1 === 1,
    `the sit pays and ticks the tally (${seam.coins1} 🪙, sits ${seam.sits1})`);
  ok(seam.coins2 === 145 && seam.sits2 === 1, 'the same session sits once');

  // D — rearm and crown
  const crowned = await t(() => {
    hbenchSat = false;
    state.coins = 0;
    sitHarborBench();
    const paidAgain = state.coins === 45 && loadHBench().sits === 2;
    const a = ACH.find(x => x[0] === 'hbench3');
    const before = a[3]();
    saveHBench({ sits: 3 });
    return { paidAgain, before, after: a[3]() };
  });
  ok(crowned.paidAgain, 'a rearmed session pays again');
  ok(!crowned.before && crowned.after, 'three sits crown The Harbor Bench');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
