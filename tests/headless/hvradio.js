/* HV-91 — Radio said see tomorrow's sky, and tomorrow stayed blank.
 *
 * The Radio recipe promises: "A crackly weather band — see tomorrow's
 * sky coming." HV-5 rolls the sky a day ahead so a Radio (or Lookout)
 * can reveal it. A fresh camp starts with G.forecast = null, and the
 * only writer was onNewDay(). finishCraft just flipped
 * G.structures.radio. Until the next dawn, forecastVisible() is true
 * and G.forecast is still null — no HUD arrow, no Tomorrow log, Rain
 * Bet stays blind. The radio is sitting in camp.
 *
 * hvweather only asserts the arrow after onNewDay has already rolled
 * a forecast. #757 is a cold morning vs the Cold Snap latch. Neither
 * is the seed gap.
 *
 * Write-first, hook-free, source-driven.
 *
 * A. The recipe still says tomorrow. ensureForecast rolls when the
 *    radio (or Lookout) is in camp and tomorrow is blank. finishCraft,
 *    hireWorker, and loadGame call it. ui.js is not touched.
 * B. Live: a fresh camp has no tomorrow. Crafting the Radio fills it
 *    and the badge grows an arrow. An already-rolled tomorrow is not
 *    replaced. Hiring a Lookout into a blank forecast also seeds it.
 *    Dawn still promotes yesterday's forecast to today.
 *
 * Named assertion: HV-91: Radio shows tomorrow's sky the moment it is built
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg    = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const save   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/save.js'), 'utf8');
const ui     = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const radioAt = cfg.indexOf("id:'radio'");
const radio = radioAt >= 0 ? cfg.slice(radioAt, radioAt + 420) : '';
const finishAt = player.indexOf('function finishCraft');
const finish = finishAt >= 0 ? player.slice(finishAt, finishAt + 700) : '';
const hireAt = player.indexOf('function hireWorker');
const hire = hireAt >= 0 ? player.slice(hireAt, hireAt + 700) : '';

(async () => {
  ok(/tomorrow/i.test(radio),
     `the Radio recipe still promises tomorrow's sky (got ${JSON.stringify((radio.match(/desc:'[^']+'/)||[''])[0])})`);

  ok(/function ensureForecast/.test(cfg) && /forecastVisible\(\)/.test(cfg) && /rollWeather\(\)/.test(cfg),
     'ensureForecast rolls tomorrow only when a Radio or Lookout can see it');

  ok(/ensureForecast\(\)/.test(finish),
     'finishCraft seeds tomorrow when the Radio lands — not at the next dawn');

  ok(/ensureForecast\(\)/.test(hire),
     'hiring a Lookout seeds the same blank tomorrow');

  ok(/ensureForecast\(\)/.test(save),
     'loadGame seeds a Radio that was built, saved, and reopened before dawn');

  ok(!/ensureForecast/.test(ui) && !/id:'radio'/.test(ui),
     'ui.js is not this ticket — it already draws the arrow once a forecast exists');

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {}
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    updateHUD();
    const badge = document.getElementById('season-badge').textContent;
    return {
      intro: !!(document.getElementById('intro-modal') && document.getElementById('intro-modal').classList.contains('open')),
      recipe: !!(typeof RECIPES !== 'undefined' && RECIPES.some(r => r.id === 'radio')),
      forecast: G.forecast,
      radio: !!G.structures.radio,
      lookout: !!G.workers.lookout,
      badge,
    };
  });
  ok(!boot.intro && boot.recipe,
     'a returning camp can build the Radio — not behind the crash course');
  ok(boot.forecast === null && !boot.radio && !boot.lookout && !boot.badge.includes('→'),
     `a fresh camp has no tomorrow yet (forecast ${boot.forecast}, badge ${JSON.stringify(boot.badge)})`);

  const built = await page.evaluate(() => {
    const r = RECIPES.find(x => x.id === 'radio');
    G.forecast = null;
    G.structures.radio = false;
    G.workers.lookout = false;
    G.activeCrafts.radio = { start: Date.now(), duration: 1 };
    finishCraft(r);
    const badge = document.getElementById('season-badge').textContent;
    return {
      forecast: G.forecast,
      valid: !!(typeof WEATHERS !== 'undefined' && WEATHERS[G.forecast]),
      radio: !!G.structures.radio,
      badge,
    };
  });
  ok(built.radio,
     'finishCraft still plants the Radio in camp');
  ok(built.valid && built.badge.includes('→'),
     `HV-91: Radio shows tomorrow's sky the moment it is built (forecast ${built.forecast}, badge ${JSON.stringify(built.badge)})`);

  const kept = await page.evaluate(() => {
    const r = RECIPES.find(x => x.id === 'radio');
    G.forecast = 'rain';
    G.structures.radio = true;
    G.activeCrafts.radio = { start: Date.now(), duration: 1 };
    finishCraft(r);
    return { forecast: G.forecast };
  });
  ok(kept.forecast === 'rain',
     `an already-rolled tomorrow is not replaced (forecast ${kept.forecast})`);

  const look = await page.evaluate(() => {
    G.forecast = null;
    G.structures.radio = false;
    G.workers.lookout = false;
    G.goodwill = 80;
    hireWorker('lookout');
    const badge = document.getElementById('season-badge').textContent;
    return {
      lookout: !!G.workers.lookout,
      forecast: G.forecast,
      valid: !!(typeof WEATHERS !== 'undefined' && WEATHERS[G.forecast]),
      badge,
    };
  });
  ok(look.lookout && look.valid && look.badge.includes('→'),
     `a Lookout hired into a blank morning also sees tomorrow (forecast ${look.forecast})`);

  const dawn = await page.evaluate(() => {
    G.forecast = 'cold';
    G.weather = 'clear';
    G.days = 4;
    G.lastEventDay = G.days + 5;
    G.food = 80; G.warmth = 90; G.health = 90; G.morale = 80;
    G.population = 1; G.dog = 0;
    G.structures.tent = false; G.structures.garden = false;
    SNAP_CHANCE = 0; G.snapUntil = null;
    onNewDay();
    return { weather: G.weather, forecast: G.forecast, valid: !!WEATHERS[G.forecast] };
  });
  ok(dawn.weather === 'cold' && dawn.valid,
     `dawn still promotes yesterday's forecast to today (weather ${dawn.weather}, next ${dawn.forecast})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
