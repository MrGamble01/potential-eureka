/* VOX-44 — the Sunken Chest (classic-script page, no hook).
 * A. Constants vox-capsule/45+5; ach + chip registered; two sings
 *    sink no chest, chip hidden.
 * B. The purse scales with sings, cap 5.
 * C. THE SEAM: with the chest sunk, a haul pays and ticks the
 *    tally; the same session hauls once.
 * D. A rearmed session pays again; three hauls crown the ach.
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
    if (!sessionStorage.getItem('voxchest-init')) {
      sessionStorage.setItem('voxchest-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-song');
      localStorage.removeItem('vox-capsule');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  const bare = await t(() => {
    saveShanty({ sings: 2 });
    saveChest({ hauls: 0 });
    const sunk2 = chestSunk();
    chestHauled = false;
    state.coins = 100;
    haulSunkenChest();
    refreshChestHud();
    return { key: CHEST_KEY, base: CHEST_BASE, per: CHEST_PER,
      ach: ACH.some(a => a[0] === 'chest3'),
      hud: !!document.getElementById('chestHud'),
      hidden: document.getElementById('chestHud').style.display === 'none',
      sunk2, coins: state.coins, hauls: loadChest().hauls };
  });
  ok(bare.key === 'vox-capsule' && bare.base === 45 && bare.per === 5 && bare.ach && bare.hud,
    'vox-capsule at 45+5 — The Sunken Chest and its HUD chip are registered');
  ok(!bare.sunk2 && bare.coins === 100 && bare.hauls === 0 && bare.hidden,
    'two sings sink no chest — chip hidden');

  const purses = await t(() => {
    saveShanty({ sings: 3 });
    const p3 = chestPurse();
    saveShanty({ sings: 9 });
    const pCap = chestPurse();
    saveShanty({ sings: 3 });
    return { p3, pCap, sunk: chestSunk() };
  });
  ok(purses.p3 === 60 && purses.pCap === 70 && purses.sunk,
    `the purse scales with sings, capped at 5 (${purses.p3}, ${purses.pCap})`);

  const seam = await t(() => {
    chestHauled = false;
    state.coins = 100;
    haulSunkenChest();
    const coins1 = state.coins, hauls1 = loadChest().hauls;
    haulSunkenChest();
    return { coins1, hauls1, coins2: state.coins, hauls2: loadChest().hauls };
  });
  ok(seam.coins1 === 160 && seam.hauls1 === 1,
    `the haul pays and ticks the tally (${seam.coins1} 🪙, hauls ${seam.hauls1})`);
  ok(seam.coins2 === 160 && seam.hauls2 === 1, 'the same session hauls once');

  const crowned = await t(() => {
    chestHauled = false;
    state.coins = 0;
    haulSunkenChest();
    const paidAgain = state.coins === 60 && loadChest().hauls === 2;
    const a = ACH.find(x => x[0] === 'chest3');
    const before = a[3]();
    saveChest({ hauls: 3 });
    return { paidAgain, before, after: a[3]() };
  });
  ok(crowned.paidAgain, 'a rearmed session pays again');
  ok(!crowned.before && crowned.after, 'three hauls crown The Sunken Chest');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
