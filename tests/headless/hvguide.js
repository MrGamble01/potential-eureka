/*
 * HV-97 — Walk a Newcomer Down said they stop being a stranger,
 * then left them at the edge of the light.
 *
 * The tooltip and the success log both promise the walk takes a
 * newcomer down the underpass and they stop being a stranger by
 * morning. finishAction only paid the food dish and flipped a
 * session latch. G.newcomerAsk stayed set. Population stayed put.
 * Make Room was still the only door in.
 *
 *  A. Source: the walk branch seats a waiting newcomer (clears the
 *     ask, increments population) when there is room.
 *  B. The tooltip still promises they stop being a stranger.
 *  C. A waiting stranger with room is seated; the dish still pays.
 *  D. No ask: the walk still pays food and does not invent a resident.
 *  E. A full camp (pop at the newcomer cap) keeps the ask and does
 *     not seat a seventh — Make Room's full-camp refuse stays honest.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction({id:'walk'}) on the production path.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const walk = /else if\(a\.id==='walk'\)\{([\s\S]*?)else if\(a\.id==='mark'\)/.exec(player);
ok(!!walk, 'the walk branch is still in player.js');
ok(walk && /newcomerAsk/.test(walk[1]) && /population/.test(walk[1]),
  'HV-97: the walk seats a waiting newcomer (clears the ask, grows the camp)');
ok(/id:'walk'[\s\S]{0,400}?stop being a stranger/.test(cfg),
  'the walk still promises they stop being a stranger');

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
    if (!sessionStorage.getItem('hvguide-init')) {
      sessionStorage.setItem('hvguide-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-docent');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const seated = await t(() => {
    saveHvPanel({ stands: 3 });
    saveHvWalk({ walks: 0 });
    walkGiven = false;
    G.goalIndex = GOALS.length;
    G.population = 3;
    G.peakPopulation = 3;
    G.welcomes = 0;
    G.newcomerAsk = { day: G.days };
    G.food = 10;
    const dish = walkDish();
    const figs0 = figures.filter(f => f.userData && f.userData.type === 'community').length;
    finishAction({ id: 'walk' });
    return {
      ask: !!G.newcomerAsk,
      pop: G.population,
      food: G.food,
      dish,
      welcomes: G.welcomes,
      walks: loadHvWalk().walks,
      figs: figures.filter(f => f.userData && f.userData.type === 'community').length - figs0,
      tip: ACTIONS.find(a => a.id === 'walk').tooltip,
    };
  });
  ok(/stop being a stranger/.test(seated.tip),
    'the live tooltip still says they stop being a stranger');
  ok(!seated.ask && seated.pop === 4 && seated.welcomes === 1 && seated.figs === 1,
    `HV-97: a waiting stranger is seated (ask=${seated.ask}, pop=${seated.pop}, welcomes=${seated.welcomes}, figs=${seated.figs})`);
  ok(seated.food === 10 + seated.dish && seated.walks === 1,
    `the walk still pays the dish and ticks the tally (food ${seated.food}, walks ${seated.walks})`);

  const alone = await t(() => {
    walkGiven = false;
    G.population = 3;
    G.welcomes = 0;
    G.newcomerAsk = null;
    G.food = 10;
    const dish = walkDish();
    finishAction({ id: 'walk' });
    return { ask: !!G.newcomerAsk, pop: G.population, food: G.food, dish, welcomes: G.welcomes };
  });
  ok(alone.pop === 3 && !alone.ask && alone.welcomes === 0 && alone.food === 10 + alone.dish,
    `no ask: the walk still pays and does not invent a resident (pop ${alone.pop}, food ${alone.food})`);

  const full = await t(() => {
    walkGiven = false;
    G.population = NEWCOMER_POP_MAX;
    G.welcomes = 0;
    G.newcomerAsk = { day: G.days };
    G.food = 10;
    const dish = walkDish();
    finishAction({ id: 'walk' });
    return {
      ask: !!G.newcomerAsk,
      pop: G.population,
      food: G.food,
      dish,
      welcomes: G.welcomes,
      cap: NEWCOMER_POP_MAX,
    };
  });
  ok(full.ask && full.pop === full.cap && full.welcomes === 0 && full.food === 10 + full.dish,
    `a full camp keeps the ask and does not seat a seventh (pop ${full.pop}, ask=${full.ask})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
