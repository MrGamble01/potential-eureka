/* VOX-27 — the Harvest Bell (classic-script page, no hook needed).
 * A. Constants vox-record/25; the bell3 row and the bellHud chip
 *    stand; the chip hides while no day is weighed.
 * B. The first weighed day opens the book silently — no xp granted.
 * C. Richer days climb it silently within the session.
 * D. THE BELL: a fresh session (re-armed mark) beating the standing
 *    mark rings once — exactly +25 xp — and a richer day the same
 *    session stays quiet.
 * E. Three rung sessions crown Harvest Bell; the book survives a
 *    save wipe in its own key.
 * F. A shore with no book rings nothing — the first day just opens it.
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
    if (!sessionStorage.getItem('voxbell-init')) {
      sessionStorage.setItem('voxbell-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-record');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => ({
    key: VREC_KEY, xp: VREC_XP,
    ach: ACH.some(a => a[0] === 'bell3'),
    chip: !!document.getElementById('bellHud'),
    hidden: document.getElementById('bellHud').style.display === 'none',
    r: loadVrec(),
  }));
  ok(fresh.key === 'vox-record' && fresh.xp === 25 && fresh.ach && fresh.chip,
    'vox-record at +25 xp a ring — the bell3 row and bellHud chip stand');
  ok(fresh.hidden && fresh.r.coins === 0 && fresh.r.beats === 0,
    'no day weighed — the chip hides');

  // B — the virgin book
  const first = await t(() => {
    const x0 = state.xp;
    recordHarvestDay(40);
    return { r: loadVrec(), rung: vrecRung, moved: state.xp !== x0,
      shown: document.getElementById('bellHud').style.display !== 'none' };
  });
  ok(first.r.coins === 40 && first.r.beats === 0 && !first.rung && !first.moved && first.shown,
    'the first weighed day opens the book silently — no xp granted');

  // C — silent climb
  const grown = await t(() => {
    const x0 = state.xp;
    recordHarvestDay(70);
    return { r: loadVrec(), rung: vrecRung, moved: state.xp !== x0 };
  });
  ok(grown.r.coins === 70 && grown.r.beats === 0 && !grown.rung && !grown.moved,
    'richer days climb it silently within the session');

  // D — the bell on a fresh session (atomic)
  const rung = await t(() => {
    vrecMark = null; vrecRung = false;
    recordHarvestDay(10);    // arms the mark below it — quiet
    const armedQuiet = !vrecRung, mark = vrecMark;
    const x0 = state.xp;
    recordHarvestDay(mark + 15);
    const one = { r: loadVrec(), rung: vrecRung, dx: state.xp - x0 };
    const x1 = state.xp;
    recordHarvestDay(mark + 40);
    return { armedQuiet, mark, one, again: loadVrec().beats, dx2: state.xp - x1 };
  });
  ok(rung.armedQuiet && rung.mark === 70 && rung.one.rung
    && rung.one.r.coins === 85 && rung.one.r.beats === 1 && rung.one.dx === 25,
    'beating the standing mark rings once — exactly +25 xp');
  ok(rung.again === 1 && rung.dx2 === 0,
    'a richer day the same session stays quiet — the book still climbs');

  // E — the crown + survival
  const crowned = await t(() => {
    const row = ACH.find(a => a[0] === 'bell3');
    const before = row[3]();
    saveVrec({ coins: 120, beats: 3 });
    return { before, after: row[3]() };
  });
  ok(!crowned.before && crowned.after, 'three rung sessions crown Harvest Bell');
  await page.evaluate(() => {
    const real = Storage.prototype.setItem.bind(localStorage);
    localStorage.removeItem('voxel-garden-v1');
    Storage.prototype.setItem = function (k, v) { if (k === 'voxel-garden-v1') return; real(k, v); };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const back = await t(() => ({ r: loadVrec(),
    chip: document.getElementById('bellTxt').textContent }));
  ok(back.r.coins === 120 && back.r.beats === 3 && back.chip.includes('120'),
    'the book survives a save wipe in its own key');

  // F — the bare shore
  const bare = await t(() => {
    localStorage.removeItem('vox-record');
    vrecMark = null; vrecRung = false;
    const x0 = state.xp;
    recordHarvestDay(5);
    return { r: loadVrec(), rung: vrecRung, moved: state.xp !== x0 };
  });
  ok(bare.r.coins === 5 && bare.r.beats === 0 && !bare.rung && !bare.moved,
    'a shore with no book rings nothing — the first day just opens it');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
