/* VOX-39 — the First Mooring (classic-script page, no hook).
 * A. Constants vox-anniversary/20+5; The First Mooring registered;
 *    two frame looks count back to no mooring day, chip hidden.
 * B. The purse scales with frame looks, cap 5.
 * C. THE SEAM: with the day counted, a ringing pays and ticks the
 *    tally; the same session rings once.
 * D. A rearmed session pays again; three ringings crown the ach.
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
    if (!sessionStorage.getItem('voxmooring-init')) {
      sessionStorage.setItem('voxmooring-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-portrait');
      localStorage.removeItem('vox-anniversary');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — no mooring day yet
  const bare = await t(() => {
    saveDFrame({ looks: 2 });
    saveMooring({ toasts: 0 });
    const counts2 = mooringCounts();
    mooringRung = false;
    state.coins = 100;
    ringFirstMooring();
    refreshMooringHud();
    return { key: MOOR_KEY, base: MOOR_BASE, per: MOOR_PER,
      ach: ACH.some(a => a[0] === 'mooring3'),
      hud: !!document.getElementById('mooringHud'),
      hidden: document.getElementById('mooringHud').style.display === 'none',
      counts2, coins: state.coins, toasts: loadMooring().toasts };
  });
  ok(bare.key === 'vox-anniversary' && bare.base === 20 && bare.per === 5 && bare.ach && bare.hud,
    'vox-anniversary at 20+5 — The First Mooring and its HUD chip are registered');
  ok(!bare.counts2 && bare.coins === 100 && bare.toasts === 0 && bare.hidden,
    'two frame looks count back to no mooring day — chip hidden');

  // B — the purse scales with the looks
  const purses = await t(() => {
    saveDFrame({ looks: 3 });
    const p3 = mooringPurse();
    saveDFrame({ looks: 9 });
    const pCap = mooringPurse();
    saveDFrame({ looks: 3 });
    return { p3, pCap, counts: mooringCounts() };
  });
  ok(purses.p3 === 35 && purses.pCap === 45 && purses.counts,
    `the purse scales with frame looks, capped at 5 (${purses.p3}, ${purses.pCap})`);

  // C — the seam
  const seam = await t(() => {
    mooringRung = false;
    state.coins = 100;
    ringFirstMooring();
    const coins1 = state.coins, toasts1 = loadMooring().toasts;
    ringFirstMooring();
    return { coins1, toasts1, coins2: state.coins, toasts2: loadMooring().toasts };
  });
  ok(seam.coins1 === 135 && seam.toasts1 === 1,
    `the ringing pays and ticks the tally (${seam.coins1} 🪙, toasts ${seam.toasts1})`);
  ok(seam.coins2 === 135 && seam.toasts2 === 1, 'the same session rings once');

  // D — rearm and crown
  const crowned = await t(() => {
    mooringRung = false;
    state.coins = 0;
    ringFirstMooring();
    const paidAgain = state.coins === 35 && loadMooring().toasts === 2;
    const a = ACH.find(x => x[0] === 'mooring3');
    const before = a[3]();
    saveMooring({ toasts: 3 });
    return { paidAgain, before, after: a[3]() };
  });
  ok(crowned.paidAgain, 'a rearmed session pays again');
  ok(!crowned.before && crowned.after, 'three ringings crown The First Mooring');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
