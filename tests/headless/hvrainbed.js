/*
 * HV-150 — the Rain Barrel said the sky waters the beds, then a
 * live rain grew like a dry day.
 *
 * The barrel's own suite says a rainy garden dawn never spends
 * because "the sky is doing the work." Stored rain pays +1 food
 * on a dry garden day. A live rain paid the dry-day base, so a
 * stored storm was a better watering than the storm that filled
 * the drum. #819 is frost leaving the drum full (copy). #791 is
 * frost giving nothing. This is the rain's +1.
 *
 *  A. Source: the garden rain path adds the same +1 the barrel
 *     pays on a dry day. The recipe still names stored rainfall.
 *  B. A pinned dry dawn yields 20.5. A pinned rain dawn yields 21.5.
 *  C. A rainy dawn still never spends the drum (hvbarrel D).
 *  D. A dry dawn with water still spends exactly +1 (hvbarrel C).
 *  E. Frost is still barren. Compost is still +1 on a clear day.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives onNewDay() on the production path.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
ok(/stored rainfall waters the beds/.test(cfg) && /dry garden/.test(cfg),
  'the barrel still says a stored rainfall waters dry beds +1');
const garden = /if\(G\.structures\.garden\)\{([\s\S]*?)\n\s*if\(G\.dog===2\)/.exec(loop);
ok(garden && /G\.weather==='rain'[\s\S]{0,160}y\s*\+=\s*1/.test(garden[1]),
  'HV-150: a rainy garden day adds the same +1 the barrel pays on a dry day');
ok(garden && /G\.weather!=='rain'/.test(garden[1]) && /barrelWater/.test(garden[1]),
  'a rainy dawn still never spends the drum');

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
    if (!sessionStorage.getItem('hvrainbed-init')) {
      sessionStorage.setItem('hvrainbed-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const dawn = (weather, extra) => page.evaluate(({ weather, extra }) => {
    SNAP_CHANCE = 0;
    G.population = 1;
    G.dog = 0;
    G.workers.scrapper = false;
    G.workers.cook = false;
    G.structures.tent = false;
    G.structures.workbench = false;
    G.structures.toolbox = false;
    G.structures.pantry = false;
    G.structures.soup_kitchen = false;
    G.ticketsSent = 0;
    G.lastEventDay = 999;
    G.rep = 0;
    G.snapUntil = null;
    G.season = 0;
    G.forecast = weather;
    G.weather = 'clear';
    G.food = 20;
    G.warmth = 90;
    Object.assign(G, extra || {});
    const real = Math.random;
    Math.random = () => 0.5;
    onNewDay();
    Math.random = real;
    return { food: G.food, water: G.barrelWater || 0, days: G.barrelDays || 0, compost: G.compostDays || 0 };
  }, { weather, extra: extra || {} });

  await page.evaluate(() => {
    G.structures.garden = true;
    G.structures.barrel = false;
    G.structures.compost = false;
    G.barrelWater = 0;
    G.barrelDays = 0;
    G.compostDays = 0;
  });
  const dry = await dawn('clear');
  await page.evaluate(() => { G.structures.garden = true; G.structures.barrel = false; G.structures.compost = false; });
  const wet = await dawn('rain');
  ok(dry.food === 20.5,
    `a dry garden dawn still yields the pinned 2 (20 → ${dry.food})`);
  ok(wet.food === 21.5,
    `HV-150: a rainy garden dawn pays the sky's +1 (20 → ${wet.food})`);

  await page.evaluate(() => {
    G.structures.garden = true;
    G.structures.barrel = true;
    G.barrelWater = 2;
    G.barrelDays = 0;
  });
  const wetDrum = await dawn('rain');
  ok(wetDrum.water >= 2 && wetDrum.days === 0,
    `a rainy dawn still never spends the drum (water ${wetDrum.water}, days ${wetDrum.days})`);

  await page.evaluate(() => {
    G.structures.garden = true;
    G.structures.barrel = false;
    G.barrelWater = 0;
  });
  const bare = await dawn('clear');
  await page.evaluate(() => {
    G.structures.barrel = true;
    G.barrelWater = 2;
    G.barrelDays = 0;
  });
  const watered = await dawn('clear');
  ok(watered.food - bare.food === 1 && watered.water === 1 && watered.days === 1,
    `a dry dawn with water still spends exactly +1 (${bare.food} vs ${watered.food})`);

  await page.evaluate(() => {
    G.structures.garden = true;
    G.structures.barrel = false;
    G.structures.compost = false;
    G.barrelWater = 0;
  });
  const frost = await dawn('cold');
  ok(frost.food === 18.5,
    `frost is still barren (20 → ${frost.food}, drain only)`);

  await page.evaluate(() => {
    G.structures.garden = true;
    G.structures.compost = true;
    G.compostDays = 0;
  });
  const fed = await dawn('clear');
  ok(fed.food === 21.5 && fed.compost === 1,
    `compost is still +1 on a clear day (20 → ${fed.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
