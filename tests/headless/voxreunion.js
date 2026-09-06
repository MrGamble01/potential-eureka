/* VOX-37 — the Shore Reunion (classic-script page, no hook).
 * A. Constants vox-reunion/20+5; The Shore Reunion registered; a
 *    half story (rings without greetings) keeps the shore quiet.
 * B. The purse composes both stores, caps enforced.
 * C. THE SEAM: with the whole story standing, the reunion pays and
 *    ticks the tally; the same session throws once.
 * D. A rearmed session pays again; three held crown the ach.
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
    if (!sessionStorage.getItem('voxreunion-init')) {
      sessionStorage.setItem('voxreunion-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-plaque');
      localStorage.removeItem('vox-visitor');
      localStorage.removeItem('vox-reunion');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — the half story
  const half = await t(() => {
    saveWreath({ cheers: 3 });
    saveKeeper({ visits: 2 });
    saveSReunion({ held: 0 });
    const stands = sreunionStands();
    shoreReunionHeld = false;
    state.coins = 100;
    throwShoreReunion();
    refreshSReunionHud();
    return { key: SREU_KEY, base: SREU_BASE, per: SREU_PER,
      ach: ACH.some(a => a[0] === 'sreunion3'),
      hud: !!document.getElementById('sreunionHud'),
      hidden: document.getElementById('sreunionHud').style.display === 'none',
      stands, coins: state.coins, held: loadSReunion().held };
  });
  ok(half.key === 'vox-reunion' && half.base === 20 && half.per === 5 && half.ach && half.hud,
    'vox-reunion at 20+5 — The Shore Reunion and its HUD chip are registered');
  ok(!half.stands && half.coins === 100 && half.held === 0 && half.hidden,
    'a half story keeps the shore quiet — rings without greetings, chip hidden');

  // B — the purse composes both stores
  const purses = await t(() => {
    saveKeeper({ visits: 3 });
    const p33 = sreunionPurse();
    saveWreath({ cheers: 9 });
    saveKeeper({ visits: 7 });
    const pCap = sreunionPurse();
    saveWreath({ cheers: 3 });
    saveKeeper({ visits: 3 });
    return { p33, pCap, stands: sreunionStands() };
  });
  ok(purses.p33 === 50 && purses.pCap === 50 && purses.stands,
    `the purse composes both stores with caps (${purses.p33}, capped ${purses.pCap})`);

  // C — the seam
  const seam = await t(() => {
    shoreReunionHeld = false;
    state.coins = 100;
    throwShoreReunion();
    const coins1 = state.coins, held1 = loadSReunion().held;
    throwShoreReunion();
    return { coins1, held1, coins2: state.coins, held2: loadSReunion().held };
  });
  ok(seam.coins1 === 150 && seam.held1 === 1,
    `the reunion pays the purse and ticks the tally (${seam.coins1} 🪙, held ${seam.held1})`);
  ok(seam.coins2 === 150 && seam.held2 === 1, 'the same session throws once');

  // D — rearm and crown
  const crowned = await t(() => {
    shoreReunionHeld = false;
    state.coins = 0;
    throwShoreReunion();
    const paidAgain = state.coins === 50 && loadSReunion().held === 2;
    const a = ACH.find(x => x[0] === 'sreunion3');
    const before = a[3]();
    saveSReunion({ held: 3 });
    return { paidAgain, before, after: a[3]() };
  });
  ok(crowned.paidAgain, 'a rearmed session pays again');
  ok(!crowned.before && crowned.after, 'three held crown The Shore Reunion');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
