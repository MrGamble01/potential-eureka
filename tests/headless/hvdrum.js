/* HV-135 — Rain Barrel said dry garden days, then frost left the drum full.
 *
 * The 🛢️ recipe promises a stored rainfall waters the beds +1 on
 * dry garden days. Frost is not rain. The garden frost branch never
 * spends the barrel — that fight is the compost's (hvbarrel E).
 *
 *  A. The recipe exists, cap 3, and still promises +1 on the beds.
 *  B. THE LIE: the desc must not sell an unqualified "dry garden day."
 *     On main this fails — it says "on dry garden days."
 *  C. A frost dawn with water in the drum does not spend (pins HV-27).
 *  D. A clear garden dawn still spends one. We did not touch the math.
 *  Z. Zero page errors.
 *
 * Hook-free. Distinct from #791 (garden each day / frost) and #806
 * (forage never felt the cold).
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
    if (!sessionStorage.getItem('hvdrum-init')) {
      sessionStorage.setItem('hvdrum-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const row = await page.evaluate(() => {
    const r = RECIPES.find(x => x.id === 'barrel');
    return { desc: r && r.desc, cap: BARREL_CAP, scraps: r && r.cost.scraps, cans: r && r.cost.cans };
  });
  ok(row.cap === 3 && row.scraps === 5 && row.cans === 1 && /\+1/.test(row.desc || ''),
    `the Rain Barrel still promises +1 on the beds (cap ${row.cap})`);

  ok(row.desc && !/dry garden days/i.test(row.desc),
    `the barrel does not claim an unqualified dry garden day (got ${JSON.stringify(row.desc)})`);

  const dawn = (weather) => page.evaluate((w) => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.population = 1; G.dog = 0; G.structures.tent = false;
    G.workers.scrapper = false; G.workers.cook = false;
    G.structures.workbench = false; G.structures.toolbox = false;
    G.structures.compost = false;
    G.rep = 0; G.snapUntil = null; G.days = 1; G.warmth = 90;
    G.forecast = w; G.lastEventDay = G.days + 5;
    G.food = 20;
    onNewDay();
    Math.random = real;
    return { food: G.food, water: G.barrelWater || 0, days: G.barrelDays || 0, sky: G.weather };
  }, weather);

  await page.evaluate(() => {
    G.structures.barrel = true;
    G.structures.garden = true;
    G.structures.compost = false;
    G.barrelWater = 2;
    G.barrelDays = 0;
  });
  const frost = await dawn('cold');
  ok(frost.sky === 'cold' && frost.water === 2 && frost.days === 0,
    `frost leaves the drum full (water ${frost.water}, days ${frost.days}, sky ${frost.sky})`);

  await page.evaluate(() => { G.barrelWater = 2; G.barrelDays = 0; G.food = 20; });
  const clear = await dawn('clear');
  ok(clear.sky === 'clear' && clear.water === 1 && clear.days === 1,
    `a clear garden dawn still spends one (water ${clear.water}, days ${clear.days})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
