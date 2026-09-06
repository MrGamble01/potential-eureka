/*
 * HV-170 — Paint the mural said the panel needs to dry,
 * then a rainy dawn left the wet paint on the wall.
 *
 * The session gate says today's panel needs to dry — one
 * session a day is all the wall gets. #790 is Word fading
 * an unfinished mural. #794 is the fifth panel's today
 * flag. #847 is a finished wall lingering for a set.
 * #859 took HV-169 (theft cardboard). Rain still left
 * yesterday's wet panel standing.
 *
 *  A. Source: the dry gate is still there; dawn reads rain
 *     for an in-progress panel; doAction refuses rain.
 *  B. Paint on a clear day, then a rain dawn: mural 1→0
 *     and the log names the wash.
 *  C. A clear dawn keeps yesterday's panel.
 *  D. A finished wall survives the rain and still greets.
 *  E. doAction does not start a session in the rain.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction(mural) + onNewDay + doAction.
 * ui.js unread.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
const SHOT = process.env.HVWETPAINT_SHOT || '';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const dawn = /function muralAtDawn\(\)\{([\s\S]*?)\n\}/.exec(loop);
const door = /if\(a\.id==='mural'\)\{([\s\S]*?)\n  if\(a\.id==='meeting'/.exec(player);
ok(/needs to dry/.test(player) && /id:'mural'[\s\S]{0,280}?dry night/.test(cfg),
  'the session still says the panel needs to dry; the tooltip names a dry night');
ok(dawn && /weather==='rain'/.test(dawn[1]) && /muralDay/.test(dawn[1])
  && door && /weather==='rain'/.test(door[1]),
  'HV-170: dawn washes a wet in-progress panel; doAction refuses rain');

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
    if (!sessionStorage.getItem('hvwetpaint-init')) {
      sessionStorage.setItem('hvwetpaint-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const paint = () => page.evaluate(() => {
    G.rep = 30;
    G.dog = 1;
    G.dogMetDay = 99;
    G.goalIndex = GOALS.length;
    G.scraps = 10;
    G.morale = 50;
    G.mural = 0;
    G.muralDay = -1;
    G.days = 5;
    G.weather = 'clear';
    finishAction(muralAction());
    return { mural: G.mural, day: G.muralDay, scraps: G.scraps };
  });

  const dawnSky = (weather) => page.evaluate((w) => {
    const real = Math.random;
    Math.random = () => 0.99;
    SNAP_CHANCE = 0;
    G.snapUntil = null;
    G.population = 1;
    G.dog = 1;
    G.rep = 30;
    G.rayDebt = 0;
    G.rainBetOn = false;
    G.friendDay = -1;
    G.structures.tent = false;
    G.structures.garden = false;
    G.structures.pantry = false;
    G.structures.soup_kitchen = false;
    G.workers.scrapper = null;
    G.workers.cook = null;
    G.forecast = w;
    G.lastEventDay = G.days + 5;
    G.food = 20;
    G.warmth = 40;
    const before = document.querySelectorAll('.log-line').length;
    onNewDay();
    Math.random = real;
    const added = Array.from(document.querySelectorAll('.log-line')).slice(before).map(d => d.textContent).join('\n');
    return {
      mural: G.mural,
      weather: G.weather,
      washed: /washed/i.test(added) && /panel/i.test(added),
    };
  }, weather);

  const first = await paint();
  const rainDawn = await dawnSky('rain');
  ok(first.mural === 1 && rainDawn.weather === 'rain' && rainDawn.mural === 0 && rainDawn.washed,
    `HV-170: a rain dawn washes yesterday's wet panel (${first.mural} → ${rainDawn.mural})`);

  if (SHOT) {
    await page.screenshot({ path: path.join(SHOT, 'hv170-rain-washed-panel.png'), fullPage: true });
  }

  await paint();
  const clearDawn = await dawnSky('clear');
  ok(clearDawn.weather === 'clear' && clearDawn.mural === 1 && !clearDawn.washed,
    'a clear dawn keeps yesterday\'s panel');

  const finished = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.99;
    SNAP_CHANCE = 0;
    G.mural = 4;
    G.muralDay = G.days;
    G.forecast = 'rain';
    G.lastEventDay = G.days + 5;
    G.food = 20;
    G.warmth = 40;
    G.morale = 50;
    G.population = 1;
    G.dog = 1;
    G.rep = 40;
    onNewDay();
    Math.random = real;
    return { mural: G.mural, morale: G.morale };
  });
  ok(finished.mural === 4 && finished.morale === 49,
    `a finished wall survives the rain and still greets (mural ${finished.mural}, morale ${finished.morale})`);

  const door = await page.evaluate(() => {
    G.weather = 'rain';
    G.mural = 0;
    G.muralDay = -1;
    G.scraps = 10;
    G.rep = 30;
    G.days = 8;
    delete activeJobs.mural;
    G.cooldowns = {};
    doAction(muralAction());
    const started = !!activeJobs.mural;
    delete activeJobs.mural;
    return { started, mural: G.mural, scraps: G.scraps };
  });
  ok(!door.started && door.mural === 0 && door.scraps === 10,
    'doAction does not start a session in the rain');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
