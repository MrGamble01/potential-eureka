/* HV-85 — the Cook's meals actually feed the camp.
 *
 * Hire tooltip: "Makes meals from food automatically." Dawn log:
 * "The Cook prepared meals. +2 goodwill." The effect only spent 3 food
 * and added 2 goodwill — no morale, no health, nobody fed. Distinct
 * from HV-67 (cook vs dawn drain order) and HV-71 (Hot Meal recipe).
 *
 * Hook-free. Reverting the meal payoff fails the named hold. ui.js
 * untouched: it still only prints WORKER_DEFS.desc on the hire button.
 *
 * A. Source: Cook desc still promises meals; the dawn line raises
 *    morale and health, not just goodwill.
 * B. A controlled dawn with a Cook feeds morale/health vs the same
 *    dawn without one. Goodwill still ticks +2. Isolation: no Cook,
 *    no meal.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg  = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

ok(/id:'cook'[\s\S]{0,80}Makes meals from food automatically/.test(cfg),
  'Cook hire copy still promises meals from food automatically');

const cookAt = loop.indexOf("if(G.workers.cook&&G.food>=3)");
const cookEnd = cookAt >= 0 ? loop.indexOf('log(\'The Cook prepared meals. +2 goodwill.\');', cookAt) : -1;
const cook = cookAt >= 0 ? loop.slice(cookAt, (cookEnd >= 0 ? cookEnd : cookAt) + 80) : '';
ok(cookAt >= 0 && /prepared meals/.test(cook) && /\+2 goodwill/.test(cook),
  'dawn still logs that the Cook prepared meals and paid +2 goodwill');
ok(/G\.morale\s*=\s*Math\.min\(100,\s*G\.morale\s*\+\s*4\)/.test(cook)
  && /G\.health\s*=\s*Math\.min\(100,\s*G\.health\s*\+\s*2\)/.test(cook),
  'the Cook dawn line raises morale and health — the meal, not just goodwill');
ok(!/function onNewDay|workers\.cook/.test(ui),
  'ui.js was not given a cook API — it still only prints the hire tooltip');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => { try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {} });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const none = await page.evaluate(() => {
    const logs = [];
    const old = window.log;
    window.log = m => { logs.push(String(m)); old(m); };
    (function seed(){
      G.days = 1; G.season = 0; G.weather = 'clear'; G.forecast = 'clear';
      G.food = 20; G.goodwill = 4; G.morale = 50; G.health = 70; G.warmth = 80;
      G.population = 1; G.rep = 0; G.dog = 0; G.favor = null; G.lastFavorDay = 999;
      G.lastEventDay = 999; G.friendDay = -1; G.rainBetOn = false; G.rayDebt = 0;
      G.snapUntil = null; G.arcStage = 0; G.arcDone = false;
      G.workers.cook = false; G.workers.scrapper = false;
      G.structures.tent = false; G.structures.workbench = false;
      G.structures.soup_kitchen = false; G.structures.garden = false;
      G.structures.barrel = false; G.structures.coats = false;
      G.petitions = {}; G.regulars = { marisol: 0, ray: 0, dee: 0 };
      Math.random = () => 0.99;
    })();
    onNewDay();
    window.log = old;
    const hire = document.querySelector('.w-hire[onclick*="cook"]');
    return {
      food: G.food, goodwill: G.goodwill, morale: G.morale, health: G.health,
      logged: logs.some(m => /Cook prepared meals/.test(m)),
      title: hire ? hire.getAttribute('title') : '',
    };
  });
  ok(!none.logged && none.goodwill === 4 && none.health === 70,
    `no Cook → no meal log, goodwill and health stay put (${none.goodwill}/${none.health})`);
  ok(none.title.indexOf('Makes meals from food automatically') >= 0,
    'the hire button quotes the meals promise');

  const cooked = await page.evaluate(() => {
    const logs = [];
    const old = window.log;
    window.log = m => { logs.push(String(m)); old(m); };
    (function seed(){
      G.days = 1; G.season = 0; G.weather = 'clear'; G.forecast = 'clear';
      G.food = 20; G.goodwill = 4; G.morale = 50; G.health = 70; G.warmth = 80;
      G.population = 1; G.rep = 0; G.dog = 0; G.favor = null; G.lastFavorDay = 999;
      G.lastEventDay = 999; G.friendDay = -1; G.rainBetOn = false; G.rayDebt = 0;
      G.snapUntil = null; G.arcStage = 0; G.arcDone = false;
      G.workers.cook = true; G.workers.scrapper = false;
      G.structures.tent = false; G.structures.workbench = false;
      G.structures.soup_kitchen = false; G.structures.garden = false;
      G.structures.barrel = false; G.structures.coats = false;
      G.petitions = {}; G.regulars = { marisol: 0, ray: 0, dee: 0 };
      Math.random = () => 0.99;
    })();
    onNewDay();
    window.log = old;
    return {
      food: G.food, goodwill: G.goodwill, morale: G.morale, health: G.health,
      logged: logs.some(m => /Cook prepared meals/.test(m) && /\+2 goodwill/.test(m)),
    };
  });
  ok(cooked.logged && cooked.goodwill === none.goodwill + 2,
    `the Cook still spends the night and pays +2 goodwill (${none.goodwill}→${cooked.goodwill})`);
  ok(cooked.food === none.food - 3,
    `three food still become the pot (${none.food}→${cooked.food})`);
  ok(cooked.morale === none.morale + 4 && cooked.health === none.health + 2,
    `HV-85: the Cook's meals feed the camp (morale ${none.morale}→${cooked.morale}, health ${none.health}→${cooked.health})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
