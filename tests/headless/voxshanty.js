/* VOX-43 — the Sea Shanty (classic-script page, no hook).
 * A. Constants vox-song/40+5; The Sea Shanty registered; two
 *    tellings set no chorus, chip hidden.
 * B. The purse scales with tellings, cap 5.
 * C. THE SEAM: with the shanty set, a singing pays and ticks the
 *    tally; the same session sings once.
 * D. A rearmed session pays again; three sings crown the ach.
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
    if (!sessionStorage.getItem('voxshanty-init')) {
      sessionStorage.setItem('voxshanty-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-storyhour');
      localStorage.removeItem('vox-song');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — no chorus yet
  const bare = await t(() => {
    saveYarn({ tellings: 2 });
    saveShanty({ sings: 0 });
    const ready2 = shantyReady();
    shantySung = false;
    state.coins = 100;
    singSeaShanty();
    refreshShantyHud();
    return { key: SHANTY_KEY, base: SHANTY_BASE, per: SHANTY_PER,
      ach: ACH.some(a => a[0] === 'shanty3'),
      hud: !!document.getElementById('shantyHud'),
      hidden: document.getElementById('shantyHud').style.display === 'none',
      ready2, coins: state.coins, sings: loadShanty().sings };
  });
  ok(bare.key === 'vox-song' && bare.base === 40 && bare.per === 5 && bare.ach && bare.hud,
    'vox-song at 40+5 — The Sea Shanty and its HUD chip are registered');
  ok(!bare.ready2 && bare.coins === 100 && bare.sings === 0 && bare.hidden,
    'two tellings set no chorus — chip hidden');

  // B — the purse scales with the tellings
  const purses = await t(() => {
    saveYarn({ tellings: 3 });
    const p3 = shantyPurse();
    saveYarn({ tellings: 9 });
    const pCap = shantyPurse();
    saveYarn({ tellings: 3 });
    return { p3, pCap, ready: shantyReady() };
  });
  ok(purses.p3 === 55 && purses.pCap === 65 && purses.ready,
    `the purse scales with tellings, capped at 5 (${purses.p3}, ${purses.pCap})`);

  // C — the seam
  const seam = await t(() => {
    shantySung = false;
    state.coins = 100;
    singSeaShanty();
    const coins1 = state.coins, sings1 = loadShanty().sings;
    singSeaShanty();
    return { coins1, sings1, coins2: state.coins, sings2: loadShanty().sings };
  });
  ok(seam.coins1 === 155 && seam.sings1 === 1,
    `the singing pays and ticks the tally (${seam.coins1} 🪙, sings ${seam.sings1})`);
  ok(seam.coins2 === 155 && seam.sings2 === 1, 'the same session sings once');

  // D — rearm and crown
  const crowned = await t(() => {
    shantySung = false;
    state.coins = 0;
    singSeaShanty();
    const paidAgain = state.coins === 55 && loadShanty().sings === 2;
    const a = ACH.find(x => x[0] === 'shanty3');
    const before = a[3]();
    saveShanty({ sings: 3 });
    return { paidAgain, before, after: a[3]() };
  });
  ok(crowned.paidAgain, 'a rearmed session pays again');
  ok(!crowned.before && crowned.after, 'three sings crown The Sea Shanty');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
