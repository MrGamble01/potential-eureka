/*
 * HV-208 — Biscuit said one food a day keeps him fed, then the Cook
 * spent the last bowl first.
 *
 * The join log says "One food a day keeps him fed — he earns it."
 * The Cook "Makes meals from food automatically" and spends 3 food
 * at dawn whenever G.food>=3. That spend sits BEFORE Biscuit's keep.
 * A dawn that wakes with exactly three bowls after breakfast feeds
 * the Cook and leaves Biscuit hungry — the keep never got its day.
 *
 *  A. Source: the Cook's dawn spend leaves one bowl when Biscuit
 *     is in camp. The keep and the cook line still exist.
 *  B. Cook + Biscuit + three bowls after breakfast: Biscuit stays
 *     fed, the Cook stands down, no hungry log.
 *  C. Four bowls: the Cook still cooks, then Biscuit still eats.
 *  D. No dog: three bowls still cook. No cook: three bowls still
 *     feed Biscuit. Soup Kitchen is still its own pot.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives onNewDay() on the production dawn.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
ok(/One food a day keeps him fed/.test(src),
  'Biscuit still says one food a day keeps him fed');
ok(/The Cook prepared meals/.test(src),
  'the Cook still prepares meals at dawn');
ok(/G\.workers\.cook&&G\.food>=3\+\(G\.dog===2\?1:0\)/.test(src),
  'HV-208: the Cook leaves a bowl when Biscuit is in camp');

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvcookbowl-init')) {
      sessionStorage.setItem('hvcookbowl-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const dawn = (opts) => page.evaluate((o) => {
    const real = Math.random;
    Math.random = () => 0.6;
    G.days = 20;
    G.lastEventDay = G.days + 5;
    G.forecast = 'clear';
    G.weather = 'clear';
    G.population = 1;
    G.dog = o.dog;
    G.dogHungry = false;
    G.workers.cook = !!o.cook;
    G.workers.scrapper = false;
    G.structures.garden = false;
    G.structures.tent = false;
    G.structures.workbench = false;
    G.structures.soup_kitchen = false;
    G.structures.pantry = false;
    G.structures.barrel = false;
    G.structures.coats = false;
    G.food = o.food;
    G.goodwill = 10;
    G.morale = 50;
    G.warmth = 80;
    G.health = 90;
    G.friendDay = -1;
    G.rainBetOn = false;
    G.rayDebt = 0;
    G.arcDone = true;
    G.goalIndex = GOALS.length;
    G.snapUntil = null;
    G.mural = 0;
    G.rep = 0;
    if (typeof logFeed !== 'undefined') { logFeed.innerHTML = ''; }
    if (typeof logLines !== 'undefined') { logLines.length = 0; }
    onNewDay();
    Math.random = real;
    return {
      food: G.food,
      goodwill: G.goodwill,
      hungry: !!G.dogHungry,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n'),
    };
  }, opts);

  // pop 1 breakfast = 1.5. food 4.5 → 3 after breakfast — the seam.
  const tight = await dawn({ cook: true, dog: 2, food: 4.5 });
  ok(!tight.hungry,
    `HV-208: three bowls after breakfast still feed Biscuit (hungry=${tight.hungry}, food=${tight.food})`);
  ok(!/No scraps left for Biscuit/.test(tight.log),
    'HV-208: the Cook does not spend the last bowl — no hungry log');
  ok(!/The Cook prepared meals/.test(tight.log) && tight.goodwill === 10,
    `the Cook stands down when the keep would starve (gw=${tight.goodwill})`);

  const plenty = await dawn({ cook: true, dog: 2, food: 5.5 });
  ok(!plenty.hungry && /The Cook prepared meals/.test(plenty.log) && plenty.goodwill === 12,
    `four bowls: the Cook still cooks, then Biscuit still eats (gw=${plenty.goodwill}, food=${plenty.food})`);

  const noDog = await dawn({ cook: true, dog: 0, food: 4.5 });
  ok(/The Cook prepared meals/.test(noDog.log) && noDog.goodwill === 12 && noDog.food === 0,
    `no dog: three bowls still cook (food=${noDog.food})`);

  const noCook = await dawn({ cook: false, dog: 2, food: 4.5 });
  ok(!noCook.hungry && !/The Cook prepared meals/.test(noCook.log) && noCook.food === 2,
    `no cook: three bowls still feed Biscuit (food=${noCook.food})`);

  const soup = await page.evaluate(() => {
    const r = RECIPES.find(x => x.id === 'soup_kitchen');
    return { desc: r && r.desc, cook: WORKER_DEFS.find(w => w.id === 'cook').desc };
  });
  ok(/feeds everyone at dusk/.test(soup.desc) && /Makes meals from food automatically/.test(soup.cook),
    'Soup Kitchen is still its own pot — the Cook is still automatic meals');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
