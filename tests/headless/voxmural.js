/* VOX-45 — the Harbor Mural (classic-script page, no hook).
 * A. Constants vox-mural/50+5; The Harbor Mural registered; two
 *    hauls paint no mural, HUD hidden.
 * B. The purse scales with hauls, cap 5.
 * C. THE SEAM: with the mural painted, a walk pays and ticks the
 *    tally; the same session walks once.
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
    if (!sessionStorage.getItem('voxmural-init')) {
      sessionStorage.setItem('voxmural-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-capsule');
      localStorage.removeItem('vox-mural');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — no mural yet
  const bare = await t(() => {
    saveChest({ hauls: 2 });
    saveMural({ walks: 0 });
    const painted2 = muralPainted();
    muralWalked = false;
    state.coins = 100;
    walkHarborMural();
    refreshMuralHud();
    return { key: MURAL_KEY, base: MURAL_BASE, per: MURAL_PER,
      ach: ACH.some(a => a[0] === 'mural3'),
      hud: !!document.getElementById('muralHud'),
      hidden: document.getElementById('muralHud').style.display === 'none',
      painted2, coins: state.coins, walks: loadMural().walks };
  });
  ok(bare.key === 'vox-mural' && bare.base === 50 && bare.per === 5 && bare.ach && bare.hud,
    'vox-mural at 50+5 — The Harbor Mural and its HUD chip are registered');
  ok(!bare.painted2 && bare.coins === 100 && bare.walks === 0 && bare.hidden,
    'two hauls paint no mural — chip hidden');

  // B — the purse scales with the hauls
  const purses = await t(() => {
    saveChest({ hauls: 3 });
    const p3 = muralPurse();
    saveChest({ hauls: 9 });
    const pCap = muralPurse();
    saveChest({ hauls: 3 });
    return { p3, pCap, painted: muralPainted() };
  });
  ok(purses.p3 === 65 && purses.pCap === 75 && purses.painted,
    `the purse scales with hauls, capped at 5 (${purses.p3}, ${purses.pCap})`);

  // C — the seam
  const seam = await t(() => {
    muralWalked = false;
    state.coins = 100;
    walkHarborMural();
    const c1 = state.coins, w1 = loadMural().walks;
    walkHarborMural();
    return { c1, w1, c2: state.coins, w2: loadMural().walks };
  });
  ok(seam.c1 === 165 && seam.w1 === 1,
    `the walk pays and ticks the tally (${seam.c1} 🪙, walks ${seam.w1})`);
  ok(seam.c2 === 165 && seam.w2 === 1, 'the same session walks once');

  // D — rearm and crown
  const crowned = await t(() => {
    muralWalked = false;
    state.coins = 0;
    walkHarborMural();
    const paidAgain = state.coins === 65 && loadMural().walks === 2;
    const a = ACH.find(x => x[0] === 'mural3');
    const before = a[3]();
    saveMural({ walks: 3 });
    return { paidAgain, before, after: a[3]() };
  });
  ok(crowned.paidAgain, 'a rearmed session pays again');
  ok(!crowned.before && crowned.after, 'three walks crown The Harbor Mural');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
