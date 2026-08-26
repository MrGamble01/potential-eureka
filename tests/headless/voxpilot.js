/* VOX-46 — the Pilot’s Walk (classic-script page, no hook).
 * A. Constants vox-docent/55+5; The Pilot’s Walk registered; two
 *    mural walks post no pilot, HUD hidden.
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
    if (!sessionStorage.getItem('voxpilot-init')) {
      sessionStorage.setItem('voxpilot-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-mural');
      localStorage.removeItem('vox-docent');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — no mural yet
  const bare = await t(() => {
    saveMural({ walks: 2 });
    savePilot({ walks: 0 });
    const posted2 = pilotPosted();
    pilotWalked = false;
    state.coins = 100;
    walkTheGreenhand();
    refreshPilotHud();
    return { key: PILOT_KEY, base: PILOT_BASE, per: PILOT_PER,
      ach: ACH.some(a => a[0] === 'pilot3'),
      hud: !!document.getElementById('pilotHud'),
      hidden: document.getElementById('pilotHud').style.display === 'none',
      posted2, coins: state.coins, walks: loadPilot().walks };
  });
  ok(bare.key === 'vox-docent' && bare.base === 55 && bare.per === 5 && bare.ach && bare.hud,
    'vox-docent at 55+5 — The Pilot’s Walk and its HUD chip are registered');
  ok(!bare.posted2 && bare.coins === 100 && bare.walks === 0 && bare.hidden,
    'two mural walks post no pilot — chip hidden');

  // B — the purse scales with the hauls
  const purses = await t(() => {
    saveMural({ walks: 3 });
    const p3 = pilotPurse();
    saveMural({ walks: 9 });
    const pCap = pilotPurse();
    saveMural({ walks: 3 });
    return { p3, pCap, posted: pilotPosted() };
  });
  ok(purses.p3 === 70 && purses.pCap === 80 && purses.posted,
    `the purse scales with mural walks, capped at 5 (${purses.p3}, ${purses.pCap})`);

  // C — the seam
  const seam = await t(() => {
    pilotWalked = false;
    state.coins = 100;
    walkTheGreenhand();
    const c1 = state.coins, w1 = loadPilot().walks;
    walkTheGreenhand();
    return { c1, w1, c2: state.coins, w2: loadPilot().walks };
  });
  ok(seam.c1 === 170 && seam.w1 === 1,
    `the walk pays and ticks the tally (${seam.c1} 🪙, walks ${seam.w1})`);
  ok(seam.c2 === 170 && seam.w2 === 1, 'the same session walks once');

  // D — rearm and crown
  const crowned = await t(() => {
    pilotWalked = false;
    state.coins = 0;
    walkTheGreenhand();
    const paidAgain = state.coins === 70 && loadPilot().walks === 2;
    const a = ACH.find(x => x[0] === 'pilot3');
    const before = a[3]();
    savePilot({ walks: 3 });
    return { paidAgain, before, after: a[3]() };
  });
  ok(crowned.paidAgain, 'a rearmed session pays again');
  ok(!crowned.before && crowned.after, 'three walks crown The Pilot’s Walk');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
