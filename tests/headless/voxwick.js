/* VOX-31 — the Second Wick (classic-script page, no hook).
 * A. Constants wick-at-3 / 40 coins; The Second Wick registered; the
 *    third greeting fits the wick with it.
 * B. THE SEAM: this boot (isle three) rose with the kindling purse —
 *    20 base + 40 = 60 coins.
 * C. The HUD names the second wick.
 * D. A fresh isle under the double flame (isle four) also rises at
 *    60, and the wick2 row stays true.
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
    if (!sessionStorage.getItem('voxwick-init')) {
      sessionStorage.setItem('voxwick-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-record');
      localStorage.removeItem('vox-letter');
      localStorage.removeItem('vox-history');
      localStorage.removeItem('vox-conch');
      localStorage.setItem('vox-lantern', JSON.stringify({ lit: true, isles: 2 }));
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A + B — the third greeting fits the wick and pays the purse
  const third = await t(() => ({
    at: LANTERN_WICK_AT, purse: WICK_COINS,
    ach: ACH.some(a => a[0] === 'wick2'),
    isles: loadLantern().isles,
    wick: lanternHasWick(),
    coins: state.coins,
  }));
  ok(third.at === 3 && third.purse === 40 && third.ach,
    'the wick fits at three isles and pays 40 — The Second Wick is registered');
  ok(third.isles === 3 && third.wick,
    'the third greeting fits the second wick with it');
  ok(third.coins === 60,
    `isle three rises with the kindling purse — 20 base + 40 = 60 (${third.coins})`);

  // C — the HUD names it
  const hud = await t(() => {
    refreshLanternHud();
    return document.getElementById('lanternTxt').textContent;
  });
  ok(hud.includes('second wick'), `the HUD names the second wick (${hud})`);

  // D — a fresh isle under the double flame
  await page.evaluate(() => {
    const real = Storage.prototype.setItem.bind(localStorage);
    localStorage.removeItem('voxel-garden-v1');
    Storage.prototype.setItem = function (k, v) { if (k === 'voxel-garden-v1') return; real(k, v); };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const fourth = await t(() => ({
    isles: loadLantern().isles,
    coins: state.coins,
    row: ACH.find(a => a[0] === 'wick2')[3](),
  }));
  ok(fourth.isles === 4 && fourth.coins === 60 && fourth.row,
    `isle four also rises at 60 under the double flame (${fourth.coins}) — and the wick2 row stays true`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
