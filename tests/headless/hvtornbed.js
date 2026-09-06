/*
 * HV-172 — Make room said a bed by the fire,
 * then seated them after the tent tore.
 *
 * The ask only opens when a tent stands (warm enough to share).
 * #821 is the word "tonight". #735 is a full camp. #827 is Keys
 * tent size. #746 / #749 are the tent's own roof and patch.
 * #861 took HV-171 (dogwalk scorcher). finishAction still
 * spent the bed and grew the camp with no tent left.
 *
 *  A. Source: the ask still needs a tent; the welcome and the
 *     tear/sweep now refuse or lapse without one.
 *  B. A funded welcome with a tent still seats them.
 *  C. The same welcome with the tent already gone does not
 *     spend food/wood or grow the camp.
 *  D. doAction does not start the job once the tent is gone.
 *  E. A wind-tear while the ask is open sends the stranger on.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction(newcomer) + doAction + the
 * tent-tear line. ui.js unread.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
const SHOT = process.env.HVTORNBED_SHOT || '';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');

const door = /if\(a\.id==='newcomer'\)\{([\s\S]*?)\n  if\(a\.id==='ticket'/.exec(player);
const welcome = /else if\(a\.id==='newcomer'\)\{([\s\S]*?)\n  \} else if\(a\.id==='ticket'/.exec(player);

ok(/newcomerAtDawn[\s\S]{0,400}?structures\.tent/.test(loop) && /NEWCOMER_COST_FOOD/.test(cfg),
  'the ask still opens only when a tent stands; the bed still costs food and wood');
ok(door && /structures\.tent/.test(door[1]) && welcome && /structures\.tent/.test(welcome[1])
  && /tent tore[\s\S]{0,120}lapseNewcomerNoTent/.test(loop)
  && /tent was demolished[\s\S]{0,120}lapseNewcomerNoTent/.test(loop),
  'HV-172: doAction and finishAction refuse a torn tent; a tear or sweep lapses the ask');

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
    if (!sessionStorage.getItem('hvtornbed-init')) {
      sessionStorage.setItem('hvtornbed-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const withTent = await page.evaluate(() => {
    G.rep = 60;
    G.dog = 1;
    G.dogMetDay = 99;
    G.goalIndex = GOALS.length;
    G.population = 2;
    G.structures.tent = true;
    G.newcomerAsk = { day: G.days };
    G.food = 10;
    G.wood = 10;
    G.morale = 50;
    const pop0 = G.population;
    finishAction(newcomerAction());
    return { pop: G.population - pop0, food: G.food, wood: G.wood, ask: !!G.newcomerAsk };
  });
  ok(withTent.pop === 1 && withTent.food === 4 && withTent.wood === 6 && !withTent.ask,
    `a funded welcome with a tent still seats them (pop +${withTent.pop})`);

  const torn = await page.evaluate(() => {
    G.population = 2;
    G.structures.tent = false;
    G.newcomerAsk = { day: G.days };
    G.food = 10;
    G.wood = 10;
    G.morale = 50;
    G.rep = 60;
    finishAction(newcomerAction());
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      pop: G.population,
      food: G.food,
      wood: G.wood,
      ask: !!G.newcomerAsk,
      seated: /bed by the fire/i.test(log) && /one bigger/i.test(log),
    };
  });
  ok(torn.pop === 2 && torn.food === 10 && torn.wood === 10 && !torn.seated,
    `HV-172: no tent, no bed (pop ${torn.pop}, food ${torn.food}, wood ${torn.wood})`);

  if (SHOT) {
    await page.screenshot({ path: path.join(SHOT, 'hv172-no-tent-no-bed.png'), fullPage: true });
  }

  const doorLive = await page.evaluate(() => {
    G.weather = 'clear';
    G.structures.tent = false;
    G.newcomerAsk = { day: G.days };
    G.food = 10;
    G.wood = 10;
    G.rep = 60;
    G.population = 2;
    delete activeJobs.newcomer;
    G.cooldowns = {};
    doAction(newcomerAction());
    const started = !!activeJobs.newcomer;
    delete activeJobs.newcomer;
    return { started, pop: G.population, food: G.food };
  });
  ok(!doorLive.started && doorLive.pop === 2 && doorLive.food === 10,
    'doAction does not start Make room once the tent is gone');

  const wind = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0;
    G.days = 21;
    G.structures.tent = true;
    G.newcomerAsk = { day: G.days };
    G.season = 3;
    G.forecast = 'clear';
    G.lastEventDay = G.days + 5;
    G.food = 20;
    G.warmth = 40;
    G.population = 2;
    G.dog = 1;
    G.rep = 60;
    G.friendDay = -1;
    G.snapUntil = null;
    SNAP_CHANCE = 0;
    G.workers.scrapper = null;
    G.workers.cook = null;
    G.structures.garden = false;
    G.structures.workbench = false;
    onNewDay();
    Math.random = real;
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      tent: !!G.structures.tent,
      ask: !!G.newcomerAsk,
      moved: /stranger moved on/i.test(log) || /no bed/i.test(log) || /tent is gone/i.test(log),
    };
  });
  ok(!wind.tent && !wind.ask && wind.moved,
    'a wind-tear while the ask is open sends the stranger on');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
