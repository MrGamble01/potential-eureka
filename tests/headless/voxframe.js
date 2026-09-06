/* VOX-38 — the Driftwood Frame (classic-script page, no hook).
 * A. Constants vox-portrait/15+5; The Driftwood Frame registered;
 *    two reunions hang no frame — the shore stays bare, chip hidden.
 * B. The purse scales with reunions held, cap 5.
 * C. THE SEAM: with the frame hung, a look pays and ticks the
 *    tally; the same session looks once.
 * D. A rearmed session pays again; three looks crown the ach.
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
    if (!sessionStorage.getItem('voxframe-init')) {
      sessionStorage.setItem('voxframe-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-reunion');
      localStorage.removeItem('vox-portrait');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — the bare shore
  const bare = await t(() => {
    saveSReunion({ held: 2 });
    saveDFrame({ looks: 0 });
    const hangs2 = dframeHangs();
    dframeLooked = false;
    state.coins = 100;
    lookAtDFrame();
    refreshDFrameHud();
    return { key: DFRAME_KEY, base: DFRAME_BASE, per: DFRAME_PER,
      ach: ACH.some(a => a[0] === 'dframe3'),
      hud: !!document.getElementById('dframeHud'),
      hidden: document.getElementById('dframeHud').style.display === 'none',
      hangs2, coins: state.coins, looks: loadDFrame().looks };
  });
  ok(bare.key === 'vox-portrait' && bare.base === 15 && bare.per === 5 && bare.ach && bare.hud,
    'vox-portrait at 15+5 — The Driftwood Frame and its HUD chip are registered');
  ok(!bare.hangs2 && bare.coins === 100 && bare.looks === 0 && bare.hidden,
    'two reunions hang no frame — the shore stays bare, chip hidden');

  // B — the purse scales with the reunions
  const purses = await t(() => {
    saveSReunion({ held: 3 });
    const p3 = dframePurse();
    saveSReunion({ held: 9 });
    const pCap = dframePurse();
    saveSReunion({ held: 3 });
    return { p3, pCap, hangs: dframeHangs() };
  });
  ok(purses.p3 === 30 && purses.pCap === 40 && purses.hangs,
    `the purse scales with reunions held, capped at 5 (${purses.p3}, ${purses.pCap})`);

  // C — the seam
  const seam = await t(() => {
    dframeLooked = false;
    state.coins = 100;
    lookAtDFrame();
    const coins1 = state.coins, looks1 = loadDFrame().looks;
    lookAtDFrame();
    return { coins1, looks1, coins2: state.coins, looks2: loadDFrame().looks };
  });
  ok(seam.coins1 === 130 && seam.looks1 === 1,
    `the look pays and ticks the tally (${seam.coins1} 🪙, looks ${seam.looks1})`);
  ok(seam.coins2 === 130 && seam.looks2 === 1, 'the same session looks once');

  // D — rearm and crown
  const crowned = await t(() => {
    dframeLooked = false;
    state.coins = 0;
    lookAtDFrame();
    const paidAgain = state.coins === 30 && loadDFrame().looks === 2;
    const a = ACH.find(x => x[0] === 'dframe3');
    const before = a[3]();
    saveDFrame({ looks: 3 });
    return { paidAgain, before, after: a[3]() };
  });
  ok(crowned.paidAgain, 'a rearmed session pays again');
  ok(!crowned.before && crowned.after, 'three looks crown The Driftwood Frame');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
