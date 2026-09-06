/* VOX-29 — the Tide Tablet (classic-script page, no hook).
 * A. Constants vox-history; Written in Tide registered; nothing
 *    consulted.
 * B. A shore with no story carves no tablet — the almanac ends bare.
 * C. The carved lines cite every store by its real number.
 * D. A consultation ticks the tally; twice ticks twice.
 * E. Three consultations crown Written in Tide; the tally outlives a
 *    fresh isle in its own key.
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
    if (!sessionStorage.getItem('voxtablet-init')) {
      sessionStorage.setItem('voxtablet-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-lantern');
      localStorage.removeItem('vox-record');
      localStorage.removeItem('vox-letter');
      localStorage.removeItem('vox-history');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A
  const fresh = await t(() => ({
    key: VTAB_KEY,
    ach: ACH.some(a => a[0] === 'tablet3'),
    v: loadVtab(),
  }));
  ok(fresh.key === 'vox-history' && fresh.ach,
    'vox-history — Written in Tide is registered');
  ok(fresh.v.opens === 0, 'nothing consulted');

  // B — the bare almanac
  const bare = await t(() => {
    renderAlmanac();
    return { v: loadVtab(), carved: document.getElementById('almBody').innerHTML.includes('TIDE TABLET') };
  });
  ok(bare.v.opens === 0 && !bare.carved,
    'a shore with no story carves no tablet — the almanac ends bare');

  // C — the citation
  const cited = await t(() => {
    saveLantern({ lit: true, isles: 3 });
    saveVrec({ coins: 120, beats: 2 });
    saveBottle({ read: 2 });
    return composeTablet().join(' | ');
  });
  ok(cited.includes('3 isles') && cited.includes('120') && cited.includes('rung 2×')
    && cited.includes('2 messages'),
    'the carved lines cite every store by its real number');

  // D — the consultation
  const consulted = await t(() => {
    renderAlmanac();
    const one = loadVtab().opens;
    const carved = document.getElementById('almBody').innerHTML.includes('THE TIDE TABLET');
    renderAlmanac();
    return { one, carved, two: loadVtab().opens };
  });
  ok(consulted.one === 1 && consulted.carved && consulted.two === 2,
    'a consultation ticks the tally — twice ticks twice');

  // E — the crown + persistence across a fresh isle
  const crowned = await t(() => {
    const row = ACH.find(a => a[0] === 'tablet3');
    const before = row[3]();
    renderAlmanac();
    return { before, after: row[3](), unlocked: !!(state.ach && state.ach.tablet3), opens: loadVtab().opens };
  });
  ok(!crowned.before && crowned.after && crowned.unlocked && crowned.opens === 3,
    'three consultations crown Written in Tide');
  await page.evaluate(() => {
    const real = Storage.prototype.setItem.bind(localStorage);
    localStorage.removeItem('voxel-garden-v1');
    Storage.prototype.setItem = function (k, v) { if (k === 'voxel-garden-v1') return; real(k, v); };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const back = await t(() => loadVtab());
  ok(back.opens === 3, 'the tally outlives a fresh isle in its own key');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
