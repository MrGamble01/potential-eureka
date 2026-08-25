/* VOX-34 — the Beacon Flame (classic-script page, no hook).
 * A. Constants 6/60; The Beacon Flame registered; THE SEAM: the
 *    sixth isle rises under the beacon — a 60-coin purse (20 base +
 *    60), the HUD cites the beacon.
 * B. Below the beacon the wick holds: the fourth isle rises with 40
 *    (20 + 40).
 * C. The purse ladders 40 → 60; the ach flips exactly at six.
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
    if (!sessionStorage.getItem('voxbeacon-init')) {
      sessionStorage.setItem('voxbeacon-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-record');
      localStorage.removeItem('vox-letter');
      localStorage.removeItem('vox-history');
      localStorage.removeItem('vox-conch');
      localStorage.removeItem('vox-festival');
      localStorage.removeItem('vox-plaque');
      localStorage.setItem('vox-lantern', JSON.stringify({ lit: true, isles: 5 }));
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — the sixth isle rises under the beacon
  const beacon = await t(() => ({
    at: LANTERN_BEACON_AT, coinsC: BEACON_COINS,
    ach: ACH.some(a => a[0] === 'beacon6'),
    isles: loadLantern().isles, hasBeacon: lanternHasBeacon(),
    coins: state.coins,
    hud: (document.getElementById('lanternTxt') || {}).textContent || '',
  }));
  ok(beacon.at === 6 && beacon.coinsC === 60 && beacon.ach,
    'beacon at 6 isles / 60-coin purse — The Beacon Flame is registered');
  ok(beacon.isles === 6 && beacon.hasBeacon && beacon.coins === 80,
    `the sixth isle rises under the beacon — 20 base + 60 purse (${beacon.coins})`);

  // B — below the beacon the wick holds
  await page.evaluate(() => {
    localStorage.setItem('vox-lantern', JSON.stringify({ lit: true, isles: 3 }));
    localStorage.removeItem('voxel-garden-v1');
    const real = Storage.prototype.setItem.bind(localStorage);
    Storage.prototype.setItem = function (k, v) { if (k === 'voxel-garden-v1') return; real(k, v); };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const wick = await t(() => ({
    isles: loadLantern().isles, hasBeacon: lanternHasBeacon(), wick: lanternHasWick(),
    coins: state.coins,
  }));
  ok(wick.isles === 4 && !wick.hasBeacon && wick.wick && wick.coins === 60,
    `a fourth isle rises wick-deep — 20 base + 40 purse (${wick.coins})`);

  // C — the ladder and the flip
  const ladder = await t(() => {
    localStorage.setItem('vox-lantern', JSON.stringify({ lit: true, isles: 4 }));
    const p4 = kindlingPurse();
    const row = ACH.find(a => a[0] === 'beacon6');
    const at4 = row[3]();
    localStorage.setItem('vox-lantern', JSON.stringify({ lit: true, isles: 6 }));
    return { p4, at4, p6: kindlingPurse(), at6: row[3]() };
  });
  ok(ladder.p4 === 40 && ladder.p6 === 60, `the purse ladders 40 → 60 (${ladder.p4}, ${ladder.p6})`);
  ok(!ladder.at4 && ladder.at6, 'the ach flips exactly at six isles');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
