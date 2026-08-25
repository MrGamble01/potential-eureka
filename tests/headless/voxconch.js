/* VOX-30 — the Keeper's Conch (classic-script page, no hook).
 * A. Constants vox-conch/base 10; Heard Across the Water registered;
 *    the hud hides on a shore with no memory; nothing sounded.
 * B. A voiceless sounding refuses — nothing to carry.
 * C. The power scales with the memory: 10 + 5/ring (cap 5) +
 *    5/bottle (cap 3), both caps enforced.
 * D. A sounding pays exactly the power in xp, ticks the tally, and
 *    the same session refuses a second sounding.
 * E. Rearmed sessions tally on; three soundings crown the ach; the
 *    tally survives a fresh isle in its own key.
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
    if (!sessionStorage.getItem('voxconch-init')) {
      sessionStorage.setItem('voxconch-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-lantern');
      localStorage.removeItem('vox-record');
      localStorage.removeItem('vox-letter');
      localStorage.removeItem('vox-history');
      localStorage.removeItem('vox-conch');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => ({
    key: CONCH_KEY, base: CONCH_BASE,
    ach: ACH.some(a => a[0] === 'conch3'),
    hidden: document.getElementById('conchHud').style.display === 'none',
    c: loadConch(),
  }));
  ok(fresh.key === 'vox-conch' && fresh.base === 10 && fresh.ach,
    'vox-conch at base 10 — Heard Across the Water is registered');
  ok(fresh.hidden && fresh.c.uses === 0, 'the hud hides on a shore with no memory — nothing sounded');

  // B — no voice, no sound
  const mute = await t(() => {
    soundConch();
    return loadConch();
  });
  ok(mute.uses === 0, 'a voiceless sounding refuses — nothing to carry');

  // C — the scaling
  const scaled = await t(() => {
    saveVrec({ coins: 120, beats: 4 });
    saveBottle({ read: 2 });
    const p1 = conchPower();
    saveVrec({ coins: 120, beats: 9 });
    saveBottle({ read: 7 });
    const p2 = conchPower();
    saveVrec({ coins: 120, beats: 4 });
    saveBottle({ read: 2 });
    refreshConchHud();
    return { p1, p2, shown: document.getElementById('conchHud').style.display !== 'none' };
  });
  ok(scaled.p1 === 40, 'the power scales with the memory (10 + 20 rings + 10 bottles = 40)');
  ok(scaled.p2 === 50 && scaled.shown, 'both caps enforced at 10 + 25 + 15 = 50 — and the shell stands');

  // D — the sounding, atomically
  const sounded = await t(() => {
    const x0 = state.xp;
    soundConch();
    const dx = state.xp - x0;
    const one = loadConch().uses;
    soundConch();
    return { dx, one, two: loadConch().uses, used: conchSounded };
  });
  ok(sounded.dx === 40 && sounded.one === 1,
    `a sounding pays exactly the power in xp (+${sounded.dx})`);
  ok(sounded.two === 1 && sounded.used, 'the same session refuses a second sounding');

  // E — rearm, crown, fresh isle
  const crowned = await t(() => {
    conchSounded = false; soundConch();
    const two = loadConch().uses;
    const row = ACH.find(a => a[0] === 'conch3');
    const before = row[3]();
    conchSounded = false; soundConch();
    return { two, before, after: row[3](), uses: loadConch().uses };
  });
  ok(crowned.two === 2 && !crowned.before && crowned.after && crowned.uses === 3,
    'three soundings crown Heard Across the Water');
  await page.evaluate(() => {
    const real = Storage.prototype.setItem.bind(localStorage);
    localStorage.removeItem('voxel-garden-v1');
    Storage.prototype.setItem = function (k, v) { if (k === 'voxel-garden-v1') return; real(k, v); };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const back = await t(() => ({ c: loadConch(), used: conchSounded }));
  ok(back.c.uses === 3 && !back.used, 'the tally survives a fresh isle in its own key — and the shell dries for tomorrow');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
