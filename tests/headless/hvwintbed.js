/*
 * HV-168 — the crash course said the season matters, then the
 * Community Garden still harvested through winter.
 *
 * Frost already sleeps the beds (#791) — that is weather=cold.
 * Heat is a wilt (#855). Forage already felt winter (#850).
 * The garden's else branch still ran rand(1,3) on a winter
 * clear, so January paid like April.
 *
 *  A. Source: the garden dawn reads season===3; the winter
 *     log is in that branch; compostDays is not; barrel
 *     water is not spent.
 *  B. Matched dawns: winter clear + garden + no compost
 *     food == winter clear + no garden. The log names it.
 *  C. A spring clear still yields over bare.
 *  D. Winter frost + compost is still exactly +1 over frost bare.
 *  E. Winter clear + barrel does not spend and does not add +1.
 *  F. Winter clear + compost does not save a bed and does
 *     not tick the tally.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives onNewDay. ui.js unread.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
const SHOT = process.env.HVWINTBED_SHOT || '';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const garden = /if\(G\.structures\.garden\)\{([\s\S]*?)\n  if\(G\.dog===2\)/.exec(loop);
const winter = garden && /else if\(G\.season===3\)\{([\s\S]*?)\n    \}\n    else \{/.exec(garden[1]);
ok(/id:'garden'[\s\S]{0,500}?Winter sleeps/.test(cfg)
  && /id:'compost'[\s\S]{0,400}?through frost/.test(cfg),
  'the garden names winter sleep; compost stays frost');
ok(winter && /Winter on the beds/.test(winter[1]) && !/compostDays/.test(winter[1])
  && !/barrelWater/.test(winter[1]),
  'HV-168: the garden dawn reads winter — sleep, no compost tally, no barrel spend');

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
    if (!sessionStorage.getItem('hvwintbed-init')) {
      sessionStorage.setItem('hvwintbed-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  // days=20 → 21 is winter (floor(21/7)%4 === 3). days=1 → 2 is spring.
  const dawn = (weather, startDays) => page.evaluate(({ w, d }) => {
    const real = Math.random;
    Math.random = () => 0.5;
    SNAP_CHANCE = 0;
    G.snapUntil = null;
    G.population = 1;
    G.dog = 0;
    G.rep = 0;
    G.rayDebt = 0;
    G.rainBetOn = false;
    G.friendDay = -1;
    G.structures.tent = false;
    G.structures.workbench = false;
    G.structures.toolbox = false;
    G.structures.pantry = false;
    G.structures.soup_kitchen = false;
    G.structures.coats = false;
    G.workers.scrapper = null;
    G.workers.cook = null;
    G.days = d;
    G.warmth = 90;
    G.forecast = w;
    G.lastEventDay = G.days + 5;
    G.food = 20;
    onNewDay();
    Math.random = real;
    const log = Array.from(document.querySelectorAll('.log-line')).map(x => x.textContent).join('\n');
    return {
      food: G.food,
      season: G.season,
      weather: G.weather,
      water: G.barrelWater || 0,
      barrelDays: G.barrelDays || 0,
      compostDays: G.compostDays || 0,
      slept: /Winter on the beds/i.test(log),
      frost: /Frost on the beds/i.test(log),
      yielded: /Garden yielded/i.test(log),
    };
  }, { w: weather, d: startDays });

  await page.evaluate(() => {
    G.structures.garden = false;
    G.structures.compost = false;
    G.structures.barrel = false;
    G.barrelWater = 0;
    G.barrelDays = 0;
    G.compostDays = 0;
  });
  const bareWin = await dawn('clear', 20);

  await page.evaluate(() => { G.structures.garden = true; });
  const slept = await dawn('clear', 20);
  ok(bareWin.season === 3 && slept.season === 3 && slept.weather === 'clear'
    && slept.food === bareWin.food && slept.slept && !slept.yielded,
    `HV-168: winter sleep matches a bare lot (${slept.food} vs ${bareWin.food}) and names it`);

  if (SHOT) {
    await page.screenshot({ path: path.join(SHOT, 'hv168-winter-beds.png'), fullPage: true });
  }

  await page.evaluate(() => { G.structures.garden = false; });
  const bareSpring = await dawn('clear', 1);
  await page.evaluate(() => { G.structures.garden = true; });
  const spring = await dawn('clear', 1);
  ok(spring.season === 0 && spring.food > bareSpring.food && spring.yielded && !spring.slept,
    `a spring garden dawn still yields (${bareSpring.food} vs ${spring.food})`);

  await page.evaluate(() => { G.structures.compost = false; G.compostDays = 0; });
  const frostBare = await dawn('cold', 20);
  await page.evaluate(() => { G.structures.compost = true; G.compostDays = 0; });
  const frostFed = await dawn('cold', 20);
  ok(frostFed.compostDays === 1 && frostFed.food - frostBare.food === 1 && frostFed.frost,
    `winter frost + compost is still exactly +1 (${frostBare.food} vs ${frostFed.food})`);

  await page.evaluate(() => {
    G.structures.compost = false;
    G.compostDays = 0;
    G.structures.barrel = true;
    G.barrelWater = 2;
    G.barrelDays = 0;
  });
  const barrel = await dawn('clear', 20);
  ok(barrel.food === bareWin.food && barrel.water === 2 && barrel.barrelDays === 0 && barrel.slept,
    `winter + barrel does not spend and does not add (${barrel.food} vs ${bareWin.food}), water stays 2`);

  await page.evaluate(() => {
    G.structures.barrel = false;
    G.barrelWater = 0;
    G.structures.compost = true;
    G.compostDays = 0;
  });
  const compostWin = await dawn('clear', 20);
  ok(compostWin.food === bareWin.food && compostWin.compostDays === 0 && compostWin.slept,
    `winter + compost does not save a bed and does not tick (${compostWin.food} vs ${bareWin.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
