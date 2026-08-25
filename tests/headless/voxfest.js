/* VOX-32 — the Lantern Festival (classic-script page, no hook).
 * A. Constants vox-festival/+30xp; Lantern Festival registered; THE
 *    SEAM: this boot rose under the second wick (isles 3 → 4... no:
 *    seeded at 3, so isles 3 fits the wick with the greeting) and
 *    the festival tallied.
 * B. The festival paid: +30 xp once the shore was set.
 * C. A wickless shore (lantern reset to 1 isle) rises quiet.
 * D. Three festivals crown Lantern Festival.
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
    if (!sessionStorage.getItem('voxfest-init')) {
      sessionStorage.setItem('voxfest-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-record');
      localStorage.removeItem('vox-letter');
      localStorage.removeItem('vox-history');
      localStorage.removeItem('vox-conch');
      localStorage.removeItem('vox-festival');
      localStorage.setItem('vox-lantern', JSON.stringify({ lit: true, isles: 2 }));
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A + B — the seam under the fresh wick
  const fest = await t(() => ({
    key: VFEST_KEY, xp: VFEST_XP,
    ach: ACH.some(a => a[0] === 'lanternfest3'),
    isles: loadLantern().isles, wick: lanternHasWick(),
    days: loadVfest().days, stateXp: state.xp,
  }));
  ok(fest.key === 'vox-festival' && fest.xp === 30 && fest.ach,
    'vox-festival at +30 xp — Lantern Festival is registered');
  ok(fest.isles === 3 && fest.wick && fest.days === 1,
    'the isle rose under the second wick — the festival tallied');
  ok(fest.stateXp === 45, `the festival paid +30 xp on top of the bottle's 15 (${fest.stateXp})`);

  // C — the wickless shore rises quiet
  await page.evaluate(() => {
    saveVfest({ days: 0 });
    localStorage.setItem('vox-lantern', JSON.stringify({ lit: true, isles: 1 }));
    localStorage.removeItem('voxel-garden-v1');
    const real = Storage.prototype.setItem.bind(localStorage);
    Storage.prototype.setItem = function (k, v) { if (k === 'voxel-garden-v1') return; real(k, v); };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const quiet = await t(() => ({
    isles: loadLantern().isles, wick: lanternHasWick(),
    days: loadVfest().days, stateXp: state.xp,
  }));
  ok(quiet.isles === 2 && !quiet.wick && quiet.days === 0 && quiet.stateXp === 15,
    `a wickless shore rises quiet — only the bottle's 15 xp, no festival (${quiet.stateXp})`);

  // D — the crown
  const crowned = await t(() => {
    const row = ACH.find(a => a[0] === 'lanternfest3');
    const before = row[3]();
    saveVfest({ days: 3 });
    return { before, after: row[3]() };
  });
  ok(!crowned.before && crowned.after, 'three festivals crown Lantern Festival');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
