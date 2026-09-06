/* VOX-48 — the Long Shed: the first link on this shore that asks for
 * coin back (classic-script page, no hook).
 * A. Constants vox-longshed/350🪙 paying 70+5; the ach and the tray
 *    chip are registered; two knots do not offer the shed.
 * B. Three knots offer it, and the chip reads as a price.
 * C. Short of coin, the shipwrights refuse and take nothing.
 * D. THE SEAM: paid, it debits exactly 350, and the same chip
 *    becomes the sitting.
 * E. The sitting pays once a session, tallies apart from the build,
 *    and the shed is never charged for twice.
 * F. The purse scales with knots, cap 5; three sittings crown the ach.
 * G. The shed survives a reload; the session latch does not.
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
    // addInitScript re-runs on reload; the persistence assertion below
    // depends on what the first pass wrote surviving it.
    if (!sessionStorage.getItem('voxshed-init')) {
      sessionStorage.setItem('voxshed-init', '1');
      localStorage.removeItem('vox-mark');
      localStorage.removeItem('vox-longshed');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — the shed is not on offer
  const bare = await t(() => {
    saveMark({ knots: 2 });
    saveShed({ built: false, sits: 0 });
    shedSat = false;
    state.coins = 5000;
    useLongShed();
    refreshShedHud();
    const h = document.getElementById('shedHud');
    return { key: SHED_KEY, cost: SHED_COST, base: SHED_BASE, per: SHED_PER,
      ach: ACH.some(a => a[0] === 'longshed'), hud: !!h,
      disp: h ? h.style.display : '',
      offered: shedOffered(), built: shedBuilt(),
      coins: state.coins, sits: loadShed().sits };
  });
  ok(bare.key === 'vox-longshed' && bare.cost === 350 && bare.base === 70 && bare.per === 5
     && bare.ach && bare.hud,
    'vox-longshed at 350🪙, paying 70+5 — the Long Shed and its tray chip are registered');
  ok(!bare.offered && !bare.built && bare.disp === 'none'
     && bare.coins === 5000 && bare.sits === 0,
    'two knots in two hands do not open the shed — chip hidden, nothing spent');

  // B — the third knot offers it
  const offer = await t(() => {
    saveMark({ knots: 3 });
    refreshShedHud();
    const h = document.getElementById('shedHud');
    return { offered: shedOffered(), built: shedBuilt(),
      disp: h.style.display, txt: document.getElementById('shedTxt').textContent,
      purse: shedPurse() };
  });
  ok(offer.offered && !offer.built && offer.disp === 'flex',
    'the third knot in a third hand offers the shed — the chip appears, unbuilt');
  ok(/350/.test(offer.txt) && !/\+/.test(offer.txt),
    `unbuilt, the chip reads its price, not a payout (${offer.txt})`);

  // C — short of coin
  const short = await t(() => {
    state.coins = 349;
    useLongShed();
    refreshShedHud();
    const h = document.getElementById('shedHud');
    return { coins: state.coins, built: shedBuilt(), sits: loadShed().sits, dim: h.style.opacity };
  });
  ok(short.coins === 349 && !short.built && short.sits === 0,
    'a coin short, the shipwrights will not lay a keel and take nothing');
  ok(short.dim === '0.45',
    'and the chip dims to say so rather than lying about being ready');

  // D — the seam
  const built = await t(() => {
    state.coins = 500;
    useLongShed();
    refreshShedHud();
    return { coins: state.coins, built: shedBuilt(), sits: loadShed().sits,
      sat: shedSat, txt: document.getElementById('shedTxt').textContent };
  });
  ok(built.coins === 150 && built.built,
    `paid for, it debits exactly 350🪙 (500 → ${built.coins})`);
  ok(built.sits === 0 && !built.sat,
    'raising the shed is not sitting in it — the tally is still zero');
  ok(/\+85/.test(built.txt),
    `built, the same chip switches to the payout it now offers (${built.txt})`);

  // E — the sitting
  const sat = await t(() => {
    const c0 = state.coins;
    useLongShed();
    const c1 = state.coins, s1 = loadShed().sits;
    useLongShed();
    refreshShedHud();
    const h = document.getElementById('shedHud');
    return { c0, c1, s1, c2: state.coins, s2: loadShed().sits,
      txt: document.getElementById('shedTxt').textContent, dim: h.style.opacity };
  });
  ok(sat.c1 === sat.c0 + 85 && sat.s1 === 1,
    `the first sitting pays the purse once (${sat.c0} → ${sat.c1})`);
  ok(sat.c2 === sat.c1 && sat.s2 === 1 && /sat/.test(sat.txt) && sat.dim === '0.45',
    'a second sitting the same session pays nothing and the chip dims');

  // F — the purse scales, and the ach crowns
  const scale = await t(() => {
    saveMark({ knots: 3 }); const p3 = shedPurse();
    saveMark({ knots: 9 }); const pCap = shedPurse();
    saveMark({ knots: 3 });
    state.coins = 5000;
    useLongShed();                       // must not re-charge
    const noRebuy = state.coins;
    const before = ACH.find(a => a[0] === 'longshed')[3]();
    saveShed({ built: true, sits: 3 });
    return { p3, pCap, noRebuy, before, after: ACH.find(a => a[0] === 'longshed')[3]() };
  });
  ok(scale.p3 === 85 && scale.pCap === 95,
    `the sitting pays on knots tied, capped at 5 (${scale.p3}, ${scale.pCap})`);
  ok(scale.noRebuy === 5000,
    'the shed cannot be bought twice — the price is never charged again');
  ok(!scale.before && scale.after,
    'three sittings across sessions crown The Long Shed');

  // G — persistence
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const after = await t(() => ({
    built: shedBuilt(), sits: loadShed().sits, sat: shedSat,
    offered: shedOffered(),
    disp: document.getElementById('shedHud').style.display,
  }));
  ok(after.built && after.sits === 3 && after.offered && after.disp === 'flex',
    'the shed and the tally survive a reload, and the chip comes back showing');
  ok(!after.sat,
    'the once-a-session latch does not survive a reload');

  ok(errs.length === 0, `no page errors (${errs.length ? errs[0] : 'clean'})`);

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
