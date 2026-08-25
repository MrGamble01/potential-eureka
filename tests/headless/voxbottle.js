/* VOX-28 — the Message in a Bottle (classic-script page, no hook).
 * A. Constants vox-letter/15; The Sea Remembers registered; nothing
 *    read (the boot isle had no history).
 * B. A shore with no history gets no bottle — xp untouched.
 * C. The message cites the lantern's isles and the bell's best day by
 *    their real numbers.
 * D. A read pays exactly +15 xp and ticks the tally.
 * E. THE SEAM: a fresh isle (save wiped, keys kept) finds the bottle
 *    on its own at the boot boundary.
 * F. Three bottles crown The Sea Remembers.
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
    if (!sessionStorage.getItem('voxbottle-init')) {
      sessionStorage.setItem('voxbottle-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-lantern');
      localStorage.removeItem('vox-record');
      localStorage.removeItem('vox-letter');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => ({
    key: BOTTLE_KEY, xp: BOTTLE_XP,
    ach: ACH.some(a => a[0] === 'bottles3'),
    b: loadBottle(),
  }));
  ok(fresh.key === 'vox-letter' && fresh.xp === 15 && fresh.ach,
    'vox-letter at +15 xp a read — The Sea Remembers is registered');
  ok(fresh.b.read === 0, 'nothing read — the boot isle had no history');

  // B — no history, no bottle
  const bare = await t(() => {
    const x0 = state.xp;
    deliverBottle();
    return { b: loadBottle(), moved: state.xp !== x0 };
  });
  ok(bare.b.read === 0 && !bare.moved, 'a shore with no history gets no bottle');

  // C — the citation
  const cited = await t(() => {
    saveLantern({ lit: true, isles: 2 });
    saveVrec({ coins: 88, beats: 1 });
    return composeBottle();
  });
  ok(cited.includes('Isle #2') && cited.includes('88'),
    'the message cites the lantern and the bell by their real numbers');

  // D — the read
  const read = await t(() => {
    const x0 = state.xp;
    deliverBottle();
    return { b: loadBottle(), dx: state.xp - x0 };
  });
  ok(read.b.read === 1 && read.dx === 15,
    'a read pays exactly +15 xp and ticks the tally');

  // E — the seam at a fresh isle
  await page.evaluate(() => {
    const real = Storage.prototype.setItem.bind(localStorage);
    localStorage.removeItem('voxel-garden-v1');
    Storage.prototype.setItem = function (k, v) { if (k === 'voxel-garden-v1') return; real(k, v); };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const seam = await t(() => ({ b: loadBottle(), isles: loadLantern().isles }));
  ok(seam.b.read === 2 && seam.isles === 3,
    'a fresh isle finds the bottle on its own at the boot boundary');

  // F — the crown
  const crowned = await t(() => {
    const row = ACH.find(a => a[0] === 'bottles3');
    const before = row[3]();
    saveBottle({ read: 3 });
    return { before, after: row[3]() };
  });
  ok(!crowned.before && crowned.after, 'three bottles crown The Sea Remembers');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
