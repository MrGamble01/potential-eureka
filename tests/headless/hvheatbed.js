/*
 * HV-165 — Community Garden said each day, then a scorcher
 * still paid a spring harvest.
 *
 * Frost already wilts the beds (#791). Compost heat keeps
 * one frost bed, and only then. The barrel waters dry garden
 * days. Heat is dry — and a wilt. The else branch still ran
 * rand(1,3) on a Heat Wave, so a scorcher paid like Clear.
 *
 * #791 is camp-garden frost. #849 is the co-op job frost.
 * #838 is live rain on the beds. This is the heat branch.
 *
 *  A. Source: the garden dawn reads weather==='heat'; the
 *     wilt log is in that branch; compostDays is not.
 *  B. Matched dawns: heat + garden + no compost + no barrel
 *     food == heat + no garden. The log names the wilt.
 *  C. A clear garden dawn still yields over bare.
 *  D. Frost + compost is still exactly +1 over frost bare.
 *  E. Heat + barrel pays +1 over bare, spends one, ticks.
 *  F. Heat + compost (no barrel) does not save a bed and
 *     does not tick the tally.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives onNewDay. ui.js unread.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
const SHOT = process.env.HVHEATBED_SHOT || '';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const garden = /if\(G\.structures\.garden\)\{([\s\S]*?)\n  if\(G\.dog===2\)/.exec(loop);
const heat = garden && /else if\(G\.weather==='heat'\)\{([\s\S]*?)\n    \} else \{/.exec(garden[1]);
ok(/id:'garden'[\s\S]{0,220}?scorcher wilt/.test(cfg)
  && /id:'compost'[\s\S]{0,280}?through frost/.test(cfg)
  && /id:'barrel'[\s\S]{0,280}?dry garden days/.test(cfg),
  'the garden names the scorcher wilt; compost stays frost; barrel stays dry days');
ok(heat && /wilted the beds/.test(heat[1]) && !/compostDays/.test(heat[1])
  && /barrelWater/.test(heat[1]),
  'HV-165: the garden dawn reads heat — wilt, barrel water, no compost tally');

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
    if (!sessionStorage.getItem('hvheatbed-init')) {
      sessionStorage.setItem('hvheatbed-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const dawn = (weather) => page.evaluate((w) => {
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
    G.days = 1;
    G.warmth = 90;
    G.forecast = w;
    G.lastEventDay = G.days + 5;
    G.food = 20;
    onNewDay();
    Math.random = real;
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      food: G.food,
      weather: G.weather,
      water: G.barrelWater || 0,
      barrelDays: G.barrelDays || 0,
      compostDays: G.compostDays || 0,
      wilt: /wilted the beds/i.test(log),
      frost: /Frost on the beds/i.test(log),
      yielded: /Garden yielded/i.test(log),
    };
  }, weather);

  await page.evaluate(() => {
    G.structures.garden = false;
    G.structures.compost = false;
    G.structures.barrel = false;
    G.barrelWater = 0;
    G.barrelDays = 0;
    G.compostDays = 0;
  });
  const bareHeat = await dawn('heat');

  await page.evaluate(() => { G.structures.garden = true; });
  const wilt = await dawn('heat');
  ok(bareHeat.weather === 'heat' && wilt.weather === 'heat'
    && wilt.food === bareHeat.food && wilt.wilt && !wilt.yielded,
    `HV-165: a scorcher wilt matches a bare lot (${wilt.food} vs ${bareHeat.food}) and names it`);

  if (SHOT) {
    await page.screenshot({ path: path.join(SHOT, 'hv165-heat-wilt.png'), fullPage: true });
  }

  await page.evaluate(() => { G.structures.garden = false; });
  const bareClear = await dawn('clear');
  await page.evaluate(() => { G.structures.garden = true; });
  const clear = await dawn('clear');
  ok(clear.food > bareClear.food && clear.yielded && !clear.wilt,
    `a clear garden dawn still yields (${bareClear.food} vs ${clear.food})`);

  await page.evaluate(() => { G.structures.compost = false; G.compostDays = 0; });
  const frostBare = await dawn('cold');
  await page.evaluate(() => { G.structures.compost = true; G.compostDays = 0; });
  const frostFed = await dawn('cold');
  ok(frostFed.compostDays === 1 && frostFed.food - frostBare.food === 1 && frostFed.frost,
    `frost + compost is still exactly +1 (${frostBare.food} vs ${frostFed.food})`);

  await page.evaluate(() => {
    G.structures.compost = false;
    G.compostDays = 0;
    G.structures.barrel = true;
    G.barrelWater = 2;
    G.barrelDays = 0;
  });
  const watered = await dawn('heat');
  ok(watered.food - bareHeat.food === 1 && watered.water === 1 && watered.barrelDays === 1
    && !watered.wilt,
    `heat + barrel pays +1 and spends one (${bareHeat.food} vs ${watered.food}), water 2→1`);

  if (SHOT) {
    await page.screenshot({ path: path.join(SHOT, 'hv165-heat-barrel.png'), fullPage: true });
  }

  await page.evaluate(() => {
    G.structures.barrel = false;
    G.barrelWater = 0;
    G.structures.compost = true;
    G.compostDays = 0;
  });
  const compostHeat = await dawn('heat');
  ok(compostHeat.food === bareHeat.food && compostHeat.compostDays === 0 && compostHeat.wilt,
    `heat + compost does not save a bed and does not tick (${compostHeat.food} vs ${bareHeat.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
