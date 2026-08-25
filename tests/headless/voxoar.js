/* VOX-36 — the Spare Oar (classic-script page, no hook).
 * A. Constants vox-keepsake/+5; The Spare Oar registered; two
 *    greetings hang no oar — the sounding pays no coins.
 * B. THE SEAM: at three greetings the oar hangs above the tide
 *    line, and the sounding pays +5 coins and ticks the tally.
 * C. The same session sounds once — no second pay.
 * D. A rearmed session pays again; three pays crown the ach.
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
    if (!sessionStorage.getItem('voxoar-init')) {
      sessionStorage.setItem('voxoar-init', '1');
      localStorage.removeItem('voxel-garden-v1');
      localStorage.removeItem('vox-record');
      localStorage.removeItem('vox-letter');
      localStorage.removeItem('vox-visitor');
      localStorage.removeItem('vox-keepsake');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  // A — two greetings hang no oar
  const bare = await t(() => {
    saveVrec({ coins: 50, beats: 0 });
    saveKeeper({ visits: 2 });
    saveOar({ pays: 0 });
    const oar2 = conchHasOar();
    conchSounded = false;
    state.coins = 200;
    soundConch();
    return { key: OAR_KEY, coins: OAR_COINS,
      ach: ACH.some(a => a[0] === 'oar3'),
      oar2, coinsAfter: state.coins, pays: loadOar().pays };
  });
  ok(bare.key === 'vox-keepsake' && bare.coins === 5 && bare.ach,
    'vox-keepsake at +5 🪙 — The Spare Oar is registered');
  ok(!bare.oar2 && bare.coinsAfter === 200 && bare.pays === 0,
    'two greetings hang no oar — the sounding pays no coins');

  // B — the seam
  const seam = await t(() => {
    saveKeeper({ visits: 3 });
    const oar3 = conchHasOar();
    conchSounded = false;
    state.coins = 200;
    soundConch();
    return { oar3, coins: state.coins, pays: loadOar().pays };
  });
  ok(seam.oar3, 'at three greetings the oar hangs above the tide line');
  ok(seam.coins === 205 && seam.pays === 1,
    `the sounding beneath the oar pays and ticks the tally (${seam.coins} 🪙, pays ${seam.pays})`);

  // C — once a session
  const again = await t(() => {
    soundConch();
    return { coins: state.coins, pays: loadOar().pays };
  });
  ok(again.coins === 205 && again.pays === 1, 'the same session sounds once — no second pay');

  // D — rearm and crown
  const crowned = await t(() => {
    conchSounded = false;
    state.coins = 0;
    soundConch();
    const paidAgain = state.coins === 5 && loadOar().pays === 2;
    const a = ACH.find(x => x[0] === 'oar3');
    const before = a[3]();
    saveOar({ pays: 3 });
    return { paidAgain, before, after: a[3]() };
  });
  ok(crowned.paidAgain, 'a rearmed session pays again');
  ok(!crowned.before && crowned.after, 'three pays crown The Spare Oar');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
