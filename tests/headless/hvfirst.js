/* HV-133 — Walk a Newcomer Down said first night.
 *
 * The 🧭 tooltip promises every newcomer gets the walk on their
 * first night. finishAction does not check a newcomer, a welcome
 * day, or night. A dawn walk with population 1 and no ask still pays.
 *
 *  A. The 🧭 row exists. Three panel stands still pay; two still refuse.
 *  B. THE LIE: the tooltip must not claim a first night.
 *     On main this fails — it says "on their first night."
 *  C. A dawn walk (timeOfDay 0) with no newcomer still pays the dish.
 *     We did not add a gate; hvwalk stays green.
 *  Z. Zero page errors.
 *
 * Hook-free. Distinct from #766 (stranger) and #786 (tomorrow rearm).
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
    if (!sessionStorage.getItem('hvfirst-init')) {
      sessionStorage.setItem('hvfirst-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-mural');
      localStorage.removeItem('hv-docent');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const gate = await page.evaluate(() => {
    saveHvPanel({ stands: 2 });
    saveHvWalk({ walks: 0 });
    walkGiven = false;
    G.food = 10;
    finishAction({ id: 'walk' });
    const refused = { food: G.food, walks: loadHvWalk().walks, up: walkUp() };
    saveHvPanel({ stands: 3 });
    const row = ACTIONS.find(a => a.id === 'walk');
    return {
      refused,
      up3: walkUp(),
      dish: walkDish(),
      tip: row && row.tooltip,
    };
  });
  ok(gate.refused.food === 10 && gate.refused.walks === 0 && !gate.refused.up,
    'two panel stands still refuse the walk');
  ok(gate.up3 && gate.dish === 13,
    `three stands still open the walk and pay 13 food (dish ${gate.dish})`);

  ok(gate.tip && !/first night/i.test(gate.tip),
    `the Walk tip does not claim a first night (got ${JSON.stringify(gate.tip)})`);

  const dawn = await page.evaluate(() => {
    G.timeOfDay = 0;
    G.population = 1;
    G.newcomerAsk = null;
    walkGiven = false;
    G.food = 10;
    finishAction({ id: 'walk' });
    return {
      tod: G.timeOfDay,
      pop: G.population,
      ask: G.newcomerAsk,
      food: G.food,
      walks: loadHvWalk().walks,
    };
  });
  ok(dawn.tod === 0 && dawn.pop === 1 && !dawn.ask,
    `the walk under test is dawn, camp of one, no newcomer (tod ${dawn.tod})`);
  ok(dawn.food === 23 && dawn.walks === 1,
    `that dawn walk still pays (food ${dawn.food}, walks ${dawn.walks})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
