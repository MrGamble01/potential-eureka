/* HV-137 — Make room said the camp is one bigger tonight.
 *
 * The welcome log promises: "the camp is one bigger tonight."
 * finishAction does not check night. A dawn seating (timeOfDay 0)
 * still adds a resident and still writes tonight.
 *
 *  A. The funded welcome still seats them — pop +1, +6 morale.
 *  B. THE LIE: the payout log must not claim tonight.
 *     On main this fails — it says "one bigger tonight."
 *  C. The seating under test is dawn. We did not add a night gate.
 *  Z. Zero page errors.
 *
 * Hook-free. Distinct from #774 (ticket said morning bus) and
 * #735 / #734 (full-camp / greyed Make Room).
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
    if (!sessionStorage.getItem('hvtonight-init')) {
      sessionStorage.setItem('hvtonight-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const seated = await page.evaluate(() => {
    const feed = document.getElementById('log-feed');
    if (feed) feed.innerHTML = '';
    G.timeOfDay = 0;
    G.population = 2;
    G.food = 20;
    G.wood = 10;
    G.morale = 40;
    G.newcomerAsk = { day: G.days };
    finishAction({ id: 'newcomer' });
    const lines = [...document.querySelectorAll('#log-feed .log-line')]
      .map(el => el.textContent).join('\n');
    return {
      tod: G.timeOfDay,
      pop: G.population,
      food: G.food,
      wood: G.wood,
      morale: G.morale,
      ask: G.newcomerAsk,
      welcomes: G.welcomes || 0,
      lines,
    };
  });
  ok(seated.pop === 3 && seated.food === 14 && seated.wood === 6 && seated.morale === 46 && !seated.ask,
    `a funded welcome still seats them (pop ${seated.pop}, morale ${seated.morale})`);
  ok(seated.tod === 0,
    `the seating under test is dawn (timeOfDay ${seated.tod})`);
  ok(seated.lines && !/tonight/i.test(seated.lines),
    `the welcome log does not claim tonight (got ${JSON.stringify(seated.lines.slice(0, 240))})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
