/*
 * HV-239 — the Scrapper said auto-scavenges every day, then a
 * named snap still paid a quiet-day haul under a clear sky.
 *
 * The hire line is "Auto-scavenges every day." The Cold Snap
 * card is "Temperature drops hard tonight." HV-18 already thins
 * the corner (snapCut=0.75 on panhandle). The Scrapper's dawn
 * haul is rand(1,3) scraps and rand(0,2) cans with no snap.
 * A named snap (snapActive()) can grip on a clear dawn
 * independently of today's sky, and that worker still paid
 * the quiet-day haul.
 *
 * Distinct from HV-217 / #910 (Scavenge vs a named snap),
 * HV-229 / #923 (Forage vs a named snap), #788 / #857
 * (winter vs the Scrapper), #753 (Dumpsters Locked vs the
 * Scrapper), #829 (the Scrapper never found food). This
 * ticket is the dawn worker vs a named snap. ui.js is not
 * this ticket.
 *
 *  A. Source: the scrapper dawn haul multiplies by snapActive()
 *     0.75. The hire line still promises a daily auto-scavenge.
 *     The Cold Snap card still drops the temperature. ui.js is
 *     not this ticket.
 *  B. A hired Scrapper at a clear named-snap dawn: a pinned
 *     0.99 roll that pays 3 scraps / 2 cans on a quiet morning
 *     pays 2 / 1 inside the snap.
 *  C. A quiet clear dawn still pays 3 / 2. Rain, winter, and
 *     weather-cold without a named snap still pay the full
 *     haul — those are other tickets.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives onNewDay.
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
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const scrapBlock = /if\(G\.workers\.scrapper\)\{[\s\S]*?The Scrapper found some supplies[\s\S]*?\}/.exec(loop);

ok(/Auto-scavenges every day/.test(cfg),
  'the Scrapper still promises a daily auto-scavenge');
ok(/id:'cold_snap'[\s\S]{0,180}?Temperature drops hard tonight/.test(loop),
  'the Cold Snap card still drops the temperature hard');
ok(!!scrapBlock, 'the Scrapper still hauls at dawn in gameloop.js');
ok(scrapBlock && /snapActive\(\)/.test(scrapBlock[0]) && /0\.75/.test(scrapBlock[0]),
  'HV-239: the dawn haul applies the named-snap 0.75 cut');
ok(scrapBlock && !/season\s*===\s*3/.test(scrapBlock[0]),
  'winter vs the Scrapper is still #788 — this ticket does not steal it');
ok(!/snapActive\(\)\s*\?\s*0\.75/.test(ui),
  'the snap cut lives on the dawn haul — ui.js is not this ticket');

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvscrappersnap-init')) {
      sessionStorage.setItem('hvscrappersnap-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  // rand(1,3) with 0.99 → 3; rand(0,2) → 2
  const haulAt = (opts) => page.evaluate((opts) => {
    const real = Math.random;
    Math.random = () => 0.99;
    G.workers.scrapper = true;
    G.workers.cook = false;
    G.structures.tent = false;
    G.structures.workbench = false;
    G.structures.garden = false;
    G.structures.barrel = false;
    G.structures.coats = false;
    G.dog = 0;
    G.population = 1;
    G.food = 50;
    G.warmth = 90;
    G.health = 80;
    G.morale = 50;
    G.rep = 0;
    G.rayDebt = 0;
    G.rainBetOn = false;
    G.friendDay = -1;
    G.forecast = opts.weather;
    G.weather = opts.weather;
    G.days = opts.days;
    G.snapUntil = opts.snap ? (G.days + 9) : null;
    G.scraps = 10;
    G.cans = 10;
    onNewDay();
    Math.random = real;
    return {
      scraps: G.scraps - 10,
      cans: G.cans - 10,
      weather: G.weather,
      snap: snapActive(),
      season: G.season,
    };
  }, opts);

  const boot = await page.evaluate(() => ({
    name: WORKER_DEFS.find(w => w.id === 'scrapper') && WORKER_DEFS.find(w => w.id === 'scrapper').name,
    banner: EVENTS_BAD.find(e => e.id === 'cold_snap') && EVENTS_BAD.find(e => e.id === 'cold_snap').title,
  }));
  ok(boot.name === 'Scrapper' && boot.banner === 'Cold Snap',
    `the hire is still the Scrapper and the card is still Cold Snap (${boot.name}, ${boot.banner})`);

  const snapClear = await haulAt({ days: 1, weather: 'clear', snap: true });
  ok(snapClear.weather === 'clear' && snapClear.snap
     && snapClear.scraps === 2 && snapClear.cans === 1,
    `HV-239: a clear snap haul is 2 scraps / 1 can, not the quiet 3 / 2 (${snapClear.scraps} / ${snapClear.cans})`);

  const quiet = await haulAt({ days: 1, weather: 'clear', snap: false });
  ok(quiet.weather === 'clear' && !quiet.snap
     && quiet.scraps === 3 && quiet.cans === 2,
    `a quiet clear dawn still pays 3 scraps / 2 cans (${quiet.scraps} / ${quiet.cans})`);

  const rain = await haulAt({ days: 1, weather: 'rain', snap: false });
  ok(rain.weather === 'rain' && !rain.snap
     && rain.scraps === 3 && rain.cans === 2,
    `rain without a named snap still pays the dry-day haul (${rain.scraps} / ${rain.cans})`);

  const winter = await haulAt({ days: 20, weather: 'clear', snap: false });
  ok(winter.season === 3 && !winter.snap
     && winter.scraps === 3 && winter.cans === 2,
    `winter without a snap still pays the full haul — winter vs the Scrapper is #788 (${winter.scraps} / ${winter.cans})`);

  const frost = await haulAt({ days: 1, weather: 'cold', snap: false });
  ok(frost.weather === 'cold' && !frost.snap
     && frost.scraps === 3 && frost.cans === 2,
    `weather-cold without a named snap still pays the full haul (${frost.scraps} / ${frost.cans})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
