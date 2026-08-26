/* VOX-47 — Their Own Knot (classic-script page, no hook).
 * A. Constants vox-mark/60+5; Their Own Knot registered; two
 *    pilot walks earn no knot, HUD hidden.
 * B. The purse scales with hauls, cap 5.
 * C. THE SEAM: with the mural painted, a walk pays and ticks the
 *    tally; the same session ties one knot.
 * D. A rearmed session pays again; three walks crown the ach.
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
    if (!sessionStorage.getItem('voxmark-init')) {
      sessionStorage.setItem('voxmark-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-docent');
      localStorage.removeItem('vox-mark');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — no mural yet
  const bare = await t(() => {
    savePilot({ walks: 2 });
    saveMark({ knots: 0 });
    const earned2 = markEarned();
    markAdded = false;
    state.coins = 100;
    tieTheirKnot();
    refreshMarkHud();
    return { key: MARK_KEY, base: MARK_BASE, per: MARK_PER,
      ach: ACH.some(a => a[0] === 'mark3'),
      hud: !!document.getElementById('markHud'),
      hidden: document.getElementById('markHud').style.display === 'none',
      earned2, coins: state.coins, walks: loadMark().knots };
  });
  ok(bare.key === 'vox-mark' && bare.base === 60 && bare.per === 5 && bare.ach && bare.hud,
    'vox-mark at 60+5 — Their Own Knot and its HUD chip are registered');
  ok(!bare.earned2 && bare.coins === 100 && bare.walks === 0 && bare.hidden,
    'two pilot walks earn no knot — chip hidden');

  // B — the purse scales with the hauls
  const purses = await t(() => {
    savePilot({ walks: 3 });
    const p3 = markPurse();
    savePilot({ walks: 9 });
    const pCap = markPurse();
    savePilot({ walks: 3 });
    return { p3, pCap, earned: markEarned() };
  });
  ok(purses.p3 === 75 && purses.pCap === 85 && purses.earned,
    `the purse scales with pilot walks, capped at 5 (${purses.p3}, ${purses.pCap})`);

  // C — the seam
  const seam = await t(() => {
    markAdded = false;
    state.coins = 100;
    tieTheirKnot();
    const c1 = state.coins, w1 = loadMark().knots;
    tieTheirKnot();
    return { c1, w1, c2: state.coins, w2: loadMark().knots };
  });
  ok(seam.c1 === 175 && seam.w1 === 1,
    `the knot pays and ticks the tally (${seam.c1} 🪙, knots ${seam.w1})`);
  ok(seam.c2 === 175 && seam.w2 === 1, 'the same session ties one knot');

  // D — rearm and crown
  const crowned = await t(() => {
    markAdded = false;
    state.coins = 0;
    tieTheirKnot();
    const paidAgain = state.coins === 75 && loadMark().knots === 2;
    const a = ACH.find(x => x[0] === 'mark3');
    const before = a[3]();
    saveMark({ knots: 3 });
    return { paidAgain, before, after: a[3]() };
  });
  ok(crowned.paidAgain, 'a rearmed session pays again');
  ok(!crowned.before && crowned.after, 'three knots crown Their Own Knot');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
