/*
 * HV-146 — a cold snap said keep the pot full, then dawn still
 * ate the usual bowl.
 *
 * The snap's own log is "Keep the fire fed and the pot full."
 * The fire already drains SNAP_WARMTH extra. The pot still lost
 * only population × 1.5, snap or not. #812 is hand-warmers.
 * #823 is the hat. This is the bowl.
 *
 *  A. Source: onNewDay's food drain reads snapActive and SNAP_POT.
 *     The snap log still names the pot.
 *  B. A quiet dawn eats 1.5. A snap dawn eats 1.5 + 2.
 *  C. The fire still drains exactly +10 warmth (hvsnap C).
 *  D. Busk pay is unchanged. An empty pot still bites health.
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
const day = /function onNewDay\(\)\{([\s\S]*?)\nfunction maybeEvent/.exec(loop)
  || /function onNewDay\(\)\{([\s\S]*?)\nfunction checkArc/.exec(loop)
  || /G\.food\s*=Math\.max\(0,G\.food\s*-G\.population\*1\.5\);([\s\S]{0,400})/.exec(loop);
ok(/Keep the fire fed and the pot full/.test(loop),
  'the snap still tells you to keep the pot full');
ok(/SNAP_POT/.test(cfg) && /snapActive\s*\(/.test(loop) && /G\.food/.test(loop),
  'HV-146: a named SNAP_POT is on the dawn food drain');
const foodBit = /G\.food\s*=Math\.max\(0,G\.food\s*-G\.population\*1\.5\);([\s\S]{0,350})/.exec(loop);
ok(foodBit && /snapActive\s*\(/.test(foodBit[1]) && /SNAP_POT/.test(foodBit[1]),
  'HV-146: the food line reads snapActive and subtracts SNAP_POT');

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
    if (!sessionStorage.getItem('hvbowl-init')) {
      sessionStorage.setItem('hvbowl-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const prep = () => page.evaluate(() => {
    SNAP_CHANCE = 0;
    G.population = 1;
    G.dog = 0;
    G.workers.scrapper = false;
    G.workers.cook = false;
    G.structures.garden = false;
    G.structures.pantry = false;
    G.structures.barrel = false;
    G.structures.compost = false;
    G.structures.soup_kitchen = false;
    G.ticketsSent = 0;
    G.lastEventDay = 999;
    G.forecast = 'clear';
    G.weather = 'clear';
    G.season = 0;
    G.rep = 0;
  });
  await prep();

  const quiet = await page.evaluate(() => {
    G.snapUntil = null;
    G.food = 10;
    G.warmth = 90;
    const real = Math.random;
    Math.random = () => 0.5;
    onNewDay();
    Math.random = real;
    return { food: G.food, warmth: G.warmth, snap: snapActive() };
  });
  ok(!quiet.snap && quiet.food === 8.5,
    `a quiet dawn eats 1.5 (10 → ${quiet.food})`);

  await prep();
  const gripped = await page.evaluate(() => {
    G.snapUntil = G.days + 99;
    G.food = 10;
    G.warmth = 90;
    const real = Math.random;
    Math.random = () => 0.5;
    onNewDay();
    Math.random = real;
    const feed = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return { food: G.food, warmth: G.warmth, snap: snapActive(), named: /pot|bowl/i.test(feed) };
  });
  ok(gripped.snap && gripped.food === 6.5 && gripped.named,
    `HV-146: a snap dawn eats the extra bowl (10 → ${gripped.food})`);

  ok(quiet.warmth - gripped.warmth === 10 || gripped.warmth === quiet.warmth - 10,
    `the fire still drains exactly +10 warmth (${quiet.warmth} quiet vs ${gripped.warmth} snap)`);

  const busk = await page.evaluate(() => {
    G.weather = 'clear';
    G.morale = 50;
    return { pay: buskPay(), heat: (G.weather = 'heat') && buskPay() };
  });
  ok(busk.pay === 3 && busk.heat === 6,
    `Busk pay is unchanged (clear ${busk.pay}, scorcher ${busk.heat})`);

  const empty = await page.evaluate(() => {
    SNAP_CHANCE = 0;
    G.snapUntil = G.days + 99;
    G.food = 1.5;
    G.warmth = 80;
    G.health = 80;
    G.population = 1;
    G.dog = 0;
    G.workers.scrapper = false;
    G.workers.cook = false;
    G.structures.garden = false;
    G.structures.pantry = false;
    G.structures.barrel = false;
    G.lastEventDay = 999;
    G.forecast = 'clear';
    const real = Math.random;
    Math.random = () => 0.5;
    onNewDay();
    Math.random = real;
    return { food: G.food, health: G.health };
  });
  ok(empty.food === 0 && empty.health < 80,
    `an empty pot still bites health (food ${empty.food}, health ${empty.health})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
