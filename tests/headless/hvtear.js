/*
 * HV-257 — Tent said a roof of sorts, then a rainy dawn still
 * tore it at a dry-day rate.
 *
 * The tent is a roof of sorts. Dawn already tears it more in
 * winter (15%) than the rest of the year (5%). Rain tests a
 * roof. The tear roll never read the sky, so a wet spring
 * dawn used the same 5% as a clear one.
 *
 * Patch Shelter vs tear is not this card. Tent warmth vs the
 * open is not this card. Winter's 15% is not this card. Heat
 * is not this card. ui.js is not this ticket.
 *
 *  A. Source: the tent still tears, and rain raises the non-winter rate.
 *  B. A pinned 0.06 clear spring dawn keeps the tent.
 *  C. A pinned 0.06 rainy spring dawn tears it.
 *  D. Heat at 0.06 still keeps it. Winter at 0.16 still keeps it.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production onNewDay. Wraps window.log so
 * the six-line feed cannot stain the tear line.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const tentAt = loop.indexOf('G.structures.tent&&Math.random()');
const tent = tentAt >= 0 ? loop.slice(tentAt, tentAt + 280) : '';

ok(/tore in the wind/.test(loop),
  'the tent still tears in the wind');
ok(/weather==='rain'/.test(tent) && /0\.10/.test(tent),
  'HV-257: rain raises the non-winter tear rate to 0.10');
ok(!/homeless-village\/js\/ui\.js/.test(loop),
  'the cut lives on onNewDay — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvtear-init')) {
      sessionStorage.setItem('hvtear-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const dawn = (weather, roll) => page.evaluate(({ weather, roll }) => {
    const seen = [];
    const realLog = window.log;
    window.log = function (m) { seen.push(String(m)); return realLog.apply(this, arguments); };
    const real = Math.random;
    Math.random = () => roll;
    G.days = 5;
    G.forecast = weather;
    G.weather = 'clear';
    G.structures.tent = true;
    G.structures.workbench = false;
    G.structures.garden = false;
    G.structures.soup_kitchen = false;
    G.structures.pantry = false;
    G.structures.barrel = false;
    G.workers.scrapper = false;
    G.workers.cook = false;
    G.dog = 0;
    G.food = 50; G.warmth = 80; G.health = 100; G.morale = 50;
    G.lastEventDay = 99;
    G.friendDay = -1;
    G.favor = null;
    G.rainBetOn = false;
    G.snapUntil = null;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.petitions = {};
    G.rep = 0;
    G.mural = 0;
    G.population = 1;
    G.goalIndex = GOALS.length;
    onNewDay();
    window.log = realLog;
    Math.random = real;
    return {
      tent: G.structures.tent,
      weather: G.weather,
      tore: seen.some(s => /tore in the wind/.test(s)),
    };
  }, { weather, roll });

  const dry = await dawn('clear', 0.06);
  ok(dry.weather === 'clear' && dry.tent && !dry.tore,
    `a pinned 0.06 clear dawn keeps the tent (tent=${dry.tent})`);

  const wet = await dawn('rain', 0.06);
  ok(wet.weather === 'rain' && !wet.tent && wet.tore,
    `HV-257: a pinned 0.06 rainy dawn tears the tent (tent=${wet.tent}, tore=${wet.tore})`);

  const heat = await dawn('heat', 0.06);
  ok(heat.weather === 'heat' && heat.tent && !heat.tore,
    `heat is not this card — 0.06 still keeps the tent`);

  const winter = await page.evaluate(() => {
    const seen = [];
    const realLog = window.log;
    window.log = function (m) { seen.push(String(m)); return realLog.apply(this, arguments); };
    const real = Math.random;
    Math.random = () => 0.16;
    G.days = 20;
    G.forecast = 'clear';
    G.weather = 'clear';
    G.structures.tent = true;
    G.structures.workbench = false;
    G.dog = 0; G.food = 50; G.warmth = 80; G.health = 100;
    G.lastEventDay = 99; G.friendDay = -1; G.favor = null;
    G.rainBetOn = false; G.snapUntil = null;
    G.workers.scrapper = false; G.workers.cook = false;
    G.goalIndex = GOALS.length;
    onNewDay();
    window.log = realLog;
    Math.random = real;
    return { tent: G.structures.tent, season: G.season, tore: seen.some(s => /tore in the wind/.test(s)) };
  });
  ok(winter.season === 3 && winter.tent && !winter.tore,
    `winter's 15% is not this card — 0.16 still keeps the tent (season=${winter.season})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
