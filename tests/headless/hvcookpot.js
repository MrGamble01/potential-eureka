/*
 * HV-172 — Soup Kitchen said feeds everyone, then the Cook spent the pot.
 *
 * The kitchen card is "Soup night: feeds everyone at dusk (1 food each)."
 * The Cook "Makes meals from food automatically." Dawn runs the Cook
 * first. A camp of four with just enough left after the night drain
 * watches the Cook take three bowls and leave a cold pot. The kitchen
 * assigned nothing. Hunger-before-cook is a different ticket. Soup
 * before the drain is a different ticket.
 *
 *  A. Source: soupNightAtDawn runs before the Cook spends food; ui.js
 *     is untouched. Both cards still say what they say.
 *  B. A tight dawn with a cook and a kitchen serves soup, not a cold pot.
 *  C. A leftover pot still lets the Cook cook.
 *  D. No kitchen: the Cook still cooks.
 *  E. No cook: the kitchen still serves.
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
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const iCook = src.indexOf('G.workers.cook&&G.food>=3');
const iSoup = src.indexOf('soupNightAtDawn()');
ok(iCook > 0 && iSoup > 0, 'the Cook and soup night are still in onNewDay');
ok(iSoup < iCook,
  'HV-172: soup night runs before the Cook spends the pot');
ok(/feeds everyone at dusk/.test(cfg),
  'the kitchen still promises to feed everyone');
ok(/Makes meals from food automatically/.test(cfg),
  'the Cook still promises automatic meals');
ok(!/soupNightAtDawn/.test(ui) && !/workers\.cook/.test(ui),
  'ui.js untouched — the order lives in onNewDay');

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
    if (!sessionStorage.getItem('hvcookpot-init')) {
      sessionStorage.setItem('hvcookpot-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const dawn = (extra) => page.evaluate((extra) => {
    const real = Math.random;
    Math.random = () => 0.9;
    G.days = 5;
    G.lastEventDay = 99;
    G.forecast = 'clear';
    G.weather = 'clear';
    G.season = 0;
    G.population = 4;
    G.food = 10;
    G.morale = 50;
    G.health = 80;
    G.warmth = 80;
    G.goodwill = 0;
    G.soupNights = 0;
    G.goalIndex = GOALS.length;
    G.snapUntil = null;
    G.dog = 1;
    G.dogMetDay = 99;
    G.rep = 0;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.workers.cook = true;
    G.workers.scrapper = false;
    G.structures.soup_kitchen = true;
    G.structures.garden = false;
    G.structures.pantry = false;
    G.structures.tent = false;
    G.structures.barrel = false;
    G.favor = null;
    Object.assign(G, extra || {});
    onNewDay();
    Math.random = real;
    return {
      food: G.food,
      nights: G.soupNights || 0,
      goodwill: G.goodwill,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  }, extra);

  const tight = await dawn();
  ok(tight.nights === 1,
    `HV-172: a tight pot still serves soup night (nights ${tight.nights})`);
  ok(/Soup night/i.test(tight.log) && !/pot stayed cold/i.test(tight.log),
    `the kitchen fed everyone, not a cold pot (${tight.log.slice(-90)})`);
  ok(!/Cook prepared meals/i.test(tight.log),
    'the Cook left the pot for the kitchen when there was no leftover');

  const leftover = await dawn({ food: 20 });
  ok(leftover.nights === 1 && leftover.goodwill === 2,
    `a leftover pot still lets the Cook cook (${leftover.nights} night, +${leftover.goodwill} goodwill)`);
  ok(/Cook prepared meals/i.test(leftover.log),
    'the leftover dawn still names the Cook');

  const noKitchen2 = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.9;
    G.days = 5; G.lastEventDay = 99; G.forecast = 'clear';
    G.population = 4; G.food = 10; G.goodwill = 0; G.soupNights = 0;
    G.goalIndex = GOALS.length; G.dog = 1; G.dogMetDay = 99; G.rep = 0;
    G.workers.cook = true; G.structures.soup_kitchen = false;
    G.structures.garden = false; G.structures.pantry = false;
    onNewDay();
    Math.random = real;
    return { nights: G.soupNights || 0, goodwill: G.goodwill,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' ') };
  });
  ok(noKitchen2.nights === 0 && noKitchen2.goodwill === 2,
    `no kitchen: the Cook still cooks (${noKitchen2.goodwill} goodwill)`);

  const noCook = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.9;
    G.days = 5; G.lastEventDay = 99; G.forecast = 'clear';
    G.population = 4; G.food = 10; G.goodwill = 0; G.soupNights = 0;
    G.morale = 50; G.health = 80; G.warmth = 80;
    G.goalIndex = GOALS.length; G.dog = 1; G.dogMetDay = 99; G.rep = 0;
    G.workers.cook = false; G.structures.soup_kitchen = true;
    G.structures.garden = false; G.structures.pantry = false;
    onNewDay();
    Math.random = real;
    return { nights: G.soupNights || 0, goodwill: G.goodwill,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' ') };
  });
  ok(noCook.nights === 1 && noCook.goodwill === 0,
    `no cook: the kitchen still serves (${noCook.nights} night)`);
  ok(/Soup night/i.test(noCook.log),
    'the cook-less dawn still names soup night');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
