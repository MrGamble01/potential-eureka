/* HV-138 — Lookout said warns before police sweeps, and never
 * named tomorrow's sky.
 *
 * forecastVisible() is Lookout OR Radio. The Radio recipe names
 * tomorrow's sky. The Lookout hire line only names sweeps.
 *
 *  A. The Lookout row exists, costs 15, and still names sweeps.
 *  B. THE LIE: the desc must also name tomorrow's sky.
 *     On main this fails — it is only "Warns before police sweeps."
 *  C. A Lookout with no radio still makes the forecast visible.
 *     We did not take the sky away from the Radio.
 *  Z. Zero page errors.
 *
 * Hook-free. Distinct from #758 (radio tomorrow blank), #760
 * (Lookout sky emoji), #777 (Rain Bet radio-only edge), #801
 * (sweep 30s vs The Bridge).
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
    if (!sessionStorage.getItem('hveye-init')) {
      sessionStorage.setItem('hveye-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const row = await page.evaluate(() => {
    const w = WORKER_DEFS.find(x => x.id === 'lookout');
    const radio = RECIPES.find(x => x.id === 'radio');
    return {
      cost: w && w.cost,
      desc: w && w.desc,
      radio: radio && radio.desc,
    };
  });
  ok(row.cost === 15 && /sweep/i.test(row.desc || ''),
    `the Lookout still costs 15 and names sweeps (got ${JSON.stringify(row.desc)})`);

  ok(row.desc && /tomorrow|sky|forecast/i.test(row.desc),
    `the Lookout also names tomorrow's sky (got ${JSON.stringify(row.desc)})`);

  const sight = await page.evaluate(() => {
    G.workers.lookout = true;
    G.structures.radio = false;
    const withEye = forecastVisible();
    G.workers.lookout = false;
    G.structures.radio = true;
    const withRadio = forecastVisible();
    G.workers.lookout = false;
    G.structures.radio = false;
    const bare = forecastVisible();
    return { withEye, withRadio, bare, radioCopy: RECIPES.find(x => x.id === 'radio').desc };
  });
  ok(sight.withEye && sight.withRadio && !sight.bare && /tomorrow/i.test(sight.radioCopy || ''),
    `Lookout or Radio still opens tomorrow's sky (eye ${sight.withEye}, radio ${sight.withRadio}, bare ${sight.bare})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
