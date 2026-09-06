/* VOX-33 — the Shell Wreath (classic-script page, no hook).
 * A. Constants vox-plaque/3/+10; The Shell Wreath registered; a
 *    wiped bell wears no wreath.
 * B. THE SEAM: with 3 rings standing, the next ring draws the
 *    traders — beats 4, cheers 1, +10 coins on the spot; the bell
 *    HUD cites the wreath.
 * C. A wreathless bell (1 ring standing) rings dry — beats 2, no
 *    cheer, no coins.
 * D. Three cheers crown The Shell Wreath.
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
    if (!sessionStorage.getItem('voxwreath-init')) {
      sessionStorage.setItem('voxwreath-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-record');
      localStorage.removeItem('vox-plaque');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — the constants and the bare bell
  const fresh = await t(() => ({
    key: WREATH_KEY, at: WREATH_AT, coins: WREATH_COINS,
    ach: ACH.some(a => a[0] === 'wreath3'),
    wreath: bellHasWreath(),
  }));
  ok(fresh.key === 'vox-plaque' && fresh.at === 3 && fresh.coins === 10 && fresh.ach,
    'vox-plaque at 3 rings / +10 coins — The Shell Wreath is registered');
  ok(!fresh.wreath, 'a wiped bell wears no wreath');

  // B — the seam: the traders row in under the wreath (atomic)
  const paid = await t(() => {
    saveVrec({ coins: 100, beats: 3 });
    saveWreath({ cheers: 0 });
    vrecMark = null; vrecRung = false;
    state.coins = 50;
    recordHarvestDay(200);
    refreshBellHud();
    const tx = document.getElementById('bellTxt');
    return { beats: loadVrec().beats, cheers: loadWreath().cheers,
      coins: state.coins, hud: tx ? tx.textContent : '' };
  });
  ok(paid.beats === 4 && paid.cheers === 1,
    `the ring under the wreath tallies a cheer (beats ${paid.beats}, cheers ${paid.cheers})`);
  ok(paid.coins === 60, `the traders row in early: +10 coins on the spot (${paid.coins})`);
  ok(paid.hud.includes('wreath'), `the bell HUD cites the wreath (${paid.hud})`);

  // C — the wreathless bell rings dry
  const dry = await t(() => {
    saveVrec({ coins: 300, beats: 1 });
    saveWreath({ cheers: 0 });
    vrecMark = null; vrecRung = false;
    state.coins = 50;
    recordHarvestDay(400);
    return { beats: loadVrec().beats, cheers: loadWreath().cheers, coins: state.coins };
  });
  ok(dry.beats === 2 && dry.cheers === 0 && dry.coins === 50,
    `a wreathless bell rings dry — no cheer, no coins (${dry.coins})`);

  // D — the crown
  const crowned = await t(() => {
    const row = ACH.find(a => a[0] === 'wreath3');
    const before = row[3]();
    saveWreath({ cheers: 3 });
    return { before, after: row[3]() };
  });
  ok(!crowned.before && crowned.after, 'three cheers crown The Shell Wreath');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
