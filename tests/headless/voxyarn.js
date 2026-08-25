/* VOX-42 — the Harbor Yarn (classic-script page, no hook).
 * A. Constants vox-storyhour/35+5; The Harbor Yarn registered; two
 *    sits leave the yarn unspun, chip hidden.
 * B. The purse scales with sits, cap 5.
 * C. THE SEAM: with the yarn ready, a telling pays and ticks the
 *    tally; the same session tells once.
 * D. A rearmed session pays again; three tellings crown the ach.
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
    if (!sessionStorage.getItem('voxyarn-init')) {
      sessionStorage.setItem('voxyarn-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-bench');
      localStorage.removeItem('vox-storyhour');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — the yarn not ready yet
  const bare = await t(() => {
    saveHBench({ sits: 2 });
    saveYarn({ tellings: 0 });
    const ready2 = yarnReady();
    yarnTold = false;
    state.coins = 100;
    tellHarborYarn();
    refreshYarnHud();
    return { key: YARN_KEY, base: YARN_BASE, per: YARN_PER,
      ach: ACH.some(a => a[0] === 'yarn3'),
      hud: !!document.getElementById('yarnHud'),
      hidden: document.getElementById('yarnHud').style.display === 'none',
      ready2, coins: state.coins, tellings: loadYarn().tellings };
  });
  ok(bare.key === 'vox-storyhour' && bare.base === 35 && bare.per === 5 && bare.ach && bare.hud,
    'vox-storyhour at 35+5 — The Harbor Yarn and its HUD chip are registered');
  ok(!bare.ready2 && bare.coins === 100 && bare.tellings === 0 && bare.hidden,
    'two sits leave the yarn unspun — chip hidden');

  // B — the purse scales with the sits
  const purses = await t(() => {
    saveHBench({ sits: 3 });
    const p3 = yarnPurse();
    saveHBench({ sits: 9 });
    const pCap = yarnPurse();
    saveHBench({ sits: 3 });
    return { p3, pCap, ready: yarnReady() };
  });
  ok(purses.p3 === 50 && purses.pCap === 60 && purses.ready,
    `the purse scales with sits, capped at 5 (${purses.p3}, ${purses.pCap})`);

  // C — the seam
  const seam = await t(() => {
    yarnTold = false;
    state.coins = 100;
    tellHarborYarn();
    const coins1 = state.coins, tellings1 = loadYarn().tellings;
    tellHarborYarn();
    return { coins1, tellings1, coins2: state.coins, tellings2: loadYarn().tellings };
  });
  ok(seam.coins1 === 150 && seam.tellings1 === 1,
    `the telling pays and ticks the tally (${seam.coins1} 🪙, tellings ${seam.tellings1})`);
  ok(seam.coins2 === 150 && seam.tellings2 === 1, 'the same session tells once');

  // D — rearm and crown
  const crowned = await t(() => {
    yarnTold = false;
    state.coins = 0;
    tellHarborYarn();
    const paidAgain = state.coins === 50 && loadYarn().tellings === 2;
    const a = ACH.find(x => x[0] === 'yarn3');
    const before = a[3]();
    saveYarn({ tellings: 3 });
    return { paidAgain, before, after: a[3]() };
  });
  ok(crowned.paidAgain, 'a rearmed session pays again');
  ok(!crowned.before && crowned.after, 'three tellings crown The Harbor Yarn');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
