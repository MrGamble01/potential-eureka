/*
 * HV-109 — Dry Corner said the rain would stop editing the story.
 *
 * The unbuilt Roof tooltip: "It just stops the rain from taking the
 * story." The build log: "The rain stops editing the story." Rain
 * already settles Dee's bet and fills the barrel. It never touched
 * the names. A camp with chalk on an open wall woke from a rainy
 * night the same as a clear one.
 *
 *  A. Source: the tooltip and the build log still promise rain-proofing.
 *  B. Source: onNewDay calls rainEditsStory.
 *  C. Names on an unroofed wall + a rainy dawn: morale drops 2 more
 *     than the same camp on a clear dawn, and the log names the chalk.
 *     The name tally does not decrement (later links stay unlocked).
 *  D. The same names under a roof: rainy dawn matches the clear dawn.
 *  E. No names, no roof, rainy dawn: no rain-edit (fresh-camp isolation).
 *  F. Sit / hook still pay — this latch does not steal the corner.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives onNewDay on the production path.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');

ok(/stops the rain from taking the story/.test(cfg),
  'unbuilt Dry Corner still promises to stop the rain from taking the story');
ok(/The rain stops editing the story/.test(player),
  'the build log still says the rain stops editing the story');
ok(/function rainEditsStory/.test(loop) && /rainEditsStory\(\)/.test(loop),
  'HV-109: onNewDay calls rainEditsStory');

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
    if (!sessionStorage.getItem('hvdryrain-init')) {
      sessionStorage.setItem('hvdryrain-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-mark');
      localStorage.removeItem('hv-drycorner');
      localStorage.removeItem('hv-hook');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const dawn = (arg) => page.evaluate((a) => {
    const real = Math.random;
    Math.random = () => 0.99;
    saveHvMark({ names: a.names });
    saveHvDry({ built: !!a.roof, sits: 0 });
    saveHvHook({ up: false });
    drySat = false;
    G.days = 1;
    G.season = 0;
    G.timeOfDay = 0;
    G.forecast = a.sky;
    G.weather = 'clear';
    G.morale = 50;
    G.food = 20;
    G.health = 80;
    G.warmth = 80;
    G.population = 1;
    G.dog = 0;
    G.mural = 0;
    G.friendDay = -1;
    G.snapUntil = null;
    G.ticketsSent = 0;
    G.ticketAsk = null;
    G.newcomerAsk = null;
    G.rainBetOn = false;
    G.rayDebt = 0;
    G.rep = 0;
    G.goodwill = 4;
    G.arcStage = 0;
    G.arcDone = true;
    G.lastEventDay = 99;
    G.goalIndex = GOALS.length;
    G.favor = null;
    G.lastFavorDay = -9;
    G.lastLetterDay = 99;
    G.workers = { scrapper: false, cook: false };
    G.petitions = {};
    G.structures.tent = false;
    G.structures.workbench = false;
    G.structures.soup_kitchen = false;
    G.structures.garden = false;
    G.structures.pantry = false;
    G.structures.coats = false;
    G.structures.barrel = false;
    G.structures.compost = false;
    if (typeof logFeed !== 'undefined' && logFeed) logFeed.innerHTML = '';
    if (typeof logLines !== 'undefined') logLines.length = 0;
    onNewDay();
    Math.random = real;
    // The feed keeps six lines; rainEditsStory logs with the Day N
    // sky line so the chalk stays readable.
    const log = Array.from(document.querySelectorAll('.log-line'))
      .map(d => d.textContent).join(' ');
    return {
      morale: G.morale,
      names: loadHvMark().names,
      weather: G.weather,
      log,
    };
  }, arg);

  const clear = await dawn({ names: 1, roof: false, sky: 'clear' });
  const rain = await dawn({ names: 1, roof: false, sky: 'rain' });
  ok(clear.weather === 'clear' && rain.weather === 'rain',
    `forecast still becomes today's sky (clear=${clear.weather}, rain=${rain.weather})`);
  ok(rain.morale === clear.morale - 2,
    `HV-109: an unroofed name on a rainy dawn loses 2 more morale than a clear dawn (${clear.morale} → ${rain.morale})`);
  ok(/chalk ran|edited the story|taking the story/i.test(rain.log),
    `the rainy log names the story the rain took (${rain.log.slice(-120)})`);
  ok(rain.names === 1,
    `the name tally stays — rain edits the story, it does not lock later links (${rain.names})`);

  const roofed = await dawn({ names: 1, roof: true, sky: 'rain' });
  ok(roofed.morale === clear.morale && !/chalk ran|edited the story/i.test(roofed.log),
    `a roofed corner on a rainy dawn matches the clear dawn (${roofed.morale})`);

  const bare = await dawn({ names: 0, roof: false, sky: 'rain' });
  ok(bare.morale === clear.morale && !/chalk ran|edited the story/i.test(bare.log),
    `a fresh camp with no names is not edited (${bare.morale})`);

  const sit = await page.evaluate(() => {
    saveHvMark({ names: 3 });
    saveHvDry({ built: true, sits: 0 });
    drySat = false;
    G.food = 10;
    finishAction({ id: 'dry' });
    return { food: G.food, sits: loadHvDry().sits, sat: drySat };
  });
  ok(sit.food === 25 && sit.sits === 1 && sit.sat,
    `Sit in the Dry Corner still pays 12+1 per name (${sit.food}, sits=${sit.sits})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
