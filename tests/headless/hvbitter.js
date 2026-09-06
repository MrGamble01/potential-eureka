/**
 * HV-105 — Coat Rack said bitter dawns and a rainy morning still
 * borrowed the coats.
 *
 * Recipe copy: "on bitter dawns the cold cuts half as deep."
 * The rack gated on any positive weather bite (wBite>0), so a rainy
 * dawn (warmth:5) borrowed the coats, ticked coldCut, and logged
 * "the cold cuts half as deep." Rain is wet. Bitter is a Cold Snap
 * sky or the snap's extra. Heat stays a gift. The season's base
 * drain is still not the rack's business.
 *
 *  A. The recipe still promises bitter dawns.
 *  B. The dawn gate is cold weather or a snap — not any wBite>0.
 *  C. ui.js stays out of the warmth math.
 *  D. A rainy dawn with the rack loses the same warmth as without it,
 *     does not tick coldCut, and does not log the cold line.
 *  E. A cold dawn still halves 12 → 6 and ticks once (hvcoats).
 *  F. A rainy snap dawn still blunts the snap's extra (not the rain).
 *  Z. Zero page errors.
 *
 * Write-first: on unfixed main, B and D fail by name. E already passes.
 * Hook-free. Drives onNewDay() with a pinned forecast.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const NAMED =
  'HV-105: Coat Rack said bitter dawns and a rainy morning still borrowed the coats';

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const coatsRec = cfg.match(/id:'coats'[\s\S]*?desc:'([^']+)'/);
ok(!!coatsRec, 'Coat Rack recipe is still in RECIPES');
ok(coatsRec && /bitter dawns/i.test(coatsRec[1]),
  'Coat Rack still promises bitter dawns');

const coatsBlock = loop.match(
  /HV-23: coats[\s\S]*?G\.warmth=Math\.max\(0,Math\.min\(100,G\.warmth-seasonDrain\(\)-wBite-snapBite\)\)/
);
ok(!!coatsBlock, 'coats dawn block is still in onNewDay');
ok(coatsBlock && !/wBite\s*>\s*0\s*\|\|/.test(coatsBlock[0]),
  NAMED + ' — the rack still gates on any positive weather bite');
ok(coatsBlock && /weather\s*===\s*['"]cold['"]/.test(coatsBlock[0]),
  'the rack gate names cold weather');
ok(!/COATS_CUT|wBite|coldCut/.test(ui),
  'ui.js must stay out of the coat-rack warmth math');

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
    if (!sessionStorage.getItem('hvbitter-init')) {
      sessionStorage.setItem('hvbitter-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const rain = await page.evaluate(() => {
    const park = () => {
      G.population = 1; G.food = 50; G.dog = 0; G.dogHungry = false;
      G.structures.tent = false; G.structures.garden = false;
      G.structures.soup_kitchen = false; G.structures.barrel = false;
      G.workers.scrapper = false; G.workers.cook = false;
      G.rep = 0; G.mural = 0; G.snapUntil = null;
      G.goalIndex = GOALS.length;
    };
    const real = Math.random;
    Math.random = () => 0.5;
    park();
    G.structures.coats = false; G.coldCut = 0;
    G.days = 1; G.warmth = 90; G.forecast = 'rain';
    onNewDay();
    const lossBare = 90 - G.warmth;
    park();
    G.structures.coats = true;
    G.days = 1; G.warmth = 90; G.forecast = 'rain'; G.snapUntil = null; G.coldCut = 0;
    onNewDay();
    const lossCoats = 90 - G.warmth;
    const logCoats = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    Math.random = real;
    return {
      lossBare, lossCoats, diff: lossBare - lossCoats, ticks: G.coldCut,
      loggedCold: logCoats.some(l => /cold cuts half/i.test(l)),
      weather: G.weather
    };
  });
  ok(rain.weather === 'rain', `the rainy forecast became rain (weather=${rain.weather})`);
  ok(rain.diff === 0 && rain.ticks === 0 && !rain.loggedCold,
    `${NAMED} — rain lost ${rain.lossBare} vs ${rain.lossCoats}, ticks=${rain.ticks}, logged=${rain.loggedCold}`);

  const cold = await page.evaluate(() => {
    const park = () => {
      G.population = 1; G.food = 50; G.dog = 0; G.dogHungry = false;
      G.structures.tent = false; G.structures.garden = false;
      G.structures.soup_kitchen = false; G.structures.barrel = false;
      G.workers.scrapper = false; G.workers.cook = false;
      G.rep = 0; G.mural = 0; G.snapUntil = null;
      G.goalIndex = GOALS.length;
    };
    const real = Math.random;
    Math.random = () => 0.5;
    park();
    G.structures.coats = false; G.coldCut = 0;
    G.days = 1; G.warmth = 90; G.forecast = 'cold'; G.snapUntil = null;
    onNewDay();
    const lossBare = 90 - G.warmth;
    park();
    G.structures.coats = true;
    G.days = 1; G.warmth = 90; G.forecast = 'cold'; G.snapUntil = null; G.coldCut = 0;
    onNewDay();
    const lossCoats = 90 - G.warmth;
    Math.random = real;
    return { lossBare, lossCoats, diff: lossBare - lossCoats, ticks: G.coldCut };
  });
  ok(cold.diff === 6 && cold.ticks === 1,
    `a cold dawn still halves the bite (${cold.lossBare} vs ${cold.lossCoats}) and ticks once`);

  const snapRain = await page.evaluate(() => {
    const park = () => {
      G.population = 1; G.food = 50; G.dog = 0; G.dogHungry = false;
      G.structures.tent = false; G.structures.garden = false;
      G.structures.soup_kitchen = false; G.structures.barrel = false;
      G.workers.scrapper = false; G.workers.cook = false;
      G.rep = 0; G.mural = 0;
      G.goalIndex = GOALS.length;
    };
    const real = Math.random;
    Math.random = () => 0.5;
    park();
    G.structures.coats = false; G.coldCut = 0;
    G.days = 1; G.warmth = 90; G.forecast = 'rain'; G.snapUntil = 99;
    onNewDay();
    const lossBare = 90 - G.warmth;
    park();
    G.structures.coats = true;
    G.days = 1; G.warmth = 90; G.forecast = 'rain'; G.snapUntil = 99; G.coldCut = 0;
    onNewDay();
    const lossCoats = 90 - G.warmth;
    Math.random = real;
    return { lossBare, lossCoats, diff: lossBare - lossCoats, ticks: G.coldCut };
  });
  ok(snapRain.diff === 5 && snapRain.ticks === 1,
    `a rainy snap still blunts the snap's extra (${snapRain.lossBare} vs ${snapRain.lossCoats})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch((err) => {
  console.error('not ok  ' + err.message);
  process.exit(1);
});
