/* VOX-35 — the Old Keeper Rows Past (classic-script page, no hook).
 * A. Constants vox-visitor/base 10; The Old Keeper registered; the
 *    HUD chip stands; nothing visited.
 * B. A storyless shore watches him row on — no gift.
 * C. The gift scales with the shell wreath's rings, capped at 3.
 * D. THE SEAM: a greeting pays the gift, ticks the tally; the same
 *    session refuses a second pass.
 * E. A rearmed session greets him again; three visits crown the ach.
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
    if (!sessionStorage.getItem('voxkeeper-init')) {
      sessionStorage.setItem('voxkeeper-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-record');
      localStorage.removeItem('vox-letter');
      localStorage.removeItem('vox-plaque');
      localStorage.removeItem('vox-visitor');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — the constants and the bare shore
  const fresh = await t(() => ({
    key: KEEPER_KEY, base: KEEPER_BASE,
    ach: ACH.some(a => a[0] === 'keeper3'),
    hud: !!document.getElementById('keeperHud'),
    visits: loadKeeper().visits,
  }));
  ok(fresh.key === 'vox-visitor' && fresh.base === 10 && fresh.ach && fresh.hud,
    'vox-visitor at base 10 — The Old Keeper and his HUD chip are registered');
  ok(fresh.visits === 0, 'nothing visited');

  // B — the storyless shore
  const cold = await t(() => {
    localStorage.removeItem('vox-record');
    localStorage.removeItem('vox-letter');
    const xp0 = state.xp;
    greetKeeper();
    return { story: keeperHasStory(), visits: loadKeeper().visits, dx: state.xp - xp0 };
  });
  ok(!cold.story && cold.visits === 0 && cold.dx === 0,
    'a storyless shore watches him row on — no gift');

  // C — the gift scales with the wreath
  const gifts = await t(() => {
    saveVrec({ coins: 50, beats: 0 });
    saveWreath({ cheers: 0 });
    const g0 = keeperGift();
    saveWreath({ cheers: 2 });
    const g2 = keeperGift();
    saveWreath({ cheers: 9 });
    const g9 = keeperGift();
    saveWreath({ cheers: 2 });
    return { g0, g2, g9 };
  });
  ok(gifts.g0 === 10 && gifts.g2 === 20 && gifts.g9 === 25,
    `the gift deepens with the wreath, capped (${gifts.g0}, ${gifts.g2}, ${gifts.g9})`);

  // D — the seam
  const visit = await t(() => {
    keeperCame = false;
    const xp0 = state.xp;
    greetKeeper();
    const dx1 = state.xp - xp0, visits1 = loadKeeper().visits;
    greetKeeper();
    return { dx1, visits1, dx2: state.xp - xp0, visits2: loadKeeper().visits,
      hud: document.getElementById('keeperTxt').textContent };
  });
  ok(visit.dx1 === 20 && visit.visits1 === 1,
    `the greeting pays the gift and ticks the tally (+${visit.dx1} xp, visits ${visit.visits1})`);
  ok(visit.dx2 === 20 && visit.visits2 === 1 && visit.hud.includes('greeted'),
    'the same session refuses a second pass — the chip reads greeted');

  // E — rearm and crown
  const crowned = await t(() => {
    keeperCame = false;
    const xp0 = state.xp;
    greetKeeper();
    const paidAgain = state.xp - xp0 === 20 && loadKeeper().visits === 2;
    const a = ACH.find(x => x[0] === 'keeper3');
    const before = a[3]();
    saveKeeper({ visits: 3 });
    return { paidAgain, before, after: a[3]() };
  });
  ok(crowned.paidAgain, 'a rearmed session greets him again');
  ok(!crowned.before && crowned.after, 'three greetings crown The Old Keeper');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
