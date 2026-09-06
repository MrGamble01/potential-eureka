/* HV-92 — Biscuit said he earns his keep, and a fed dawn stayed silent.
 *
 * Join card / log: "One food a day keeps him fed — he earns it."
 * The keep is +2 morale and +3 warmth (hvdog already pins those
 * numbers). A broke dawn logs "No scraps left for Biscuit." A fed
 * dawn spent the food and paid the keep with no line — so the fire,
 * the mural, and the dog all move the same pills and only hunger
 * spoke. Distinct from HV-74 (join vs dawn-drain order) and HV-76
 * (hungry Biscuit still chased thieves).
 *
 * Hook-free. Reverting the fed log fails the named hold. ui.js
 * untouched.
 *
 * A. Source: the join line still promises he earns it; the fed dawn
 *    path logs the keep; ui.js was not given a dog API.
 * B. A controlled fed dawn writes the keep line and still pays
 *    +2 morale / +3 warmth. Isolation: no dog, no biscuit line.
 *    Hungry still curls up in the log.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

ok(/One food a day keeps him fed — he earns it/.test(loop),
  'the join line still promises one food a day — he earns it');

const dogAt = loop.indexOf('if(G.dog===2)');
const dogEnd = dogAt >= 0 ? loop.indexOf('regularFavorsAtDawn', dogAt) : -1;
const dog = dogAt >= 0 ? loop.slice(dogAt, dogEnd > 0 ? dogEnd : dogAt + 500) : '';
ok(/No scraps left for Biscuit/.test(dog),
  'a broke dawn still logs that Biscuit curls up hungry');
ok(/earned his keep/.test(dog) && /\+2 morale/.test(dog) && /\+3 warmth/.test(dog),
  'a fed dawn logs that Biscuit earned his keep — the +2 morale, +3 warmth');
ok(!/earned his keep|curls up hungry/.test(ui),
  'ui.js was not given a dog-keep API — the badge still just paints 🐕');

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

  const seed = () => {
    G.days = 6; G.season = 0; G.weather = 'clear'; G.forecast = 'clear';
    G.population = 1; G.rep = 0; G.favor = null; G.lastFavorDay = 999;
    G.lastEventDay = 999; G.friendDay = -1; G.rainBetOn = false; G.rayDebt = 0;
    G.snapUntil = null; G.arcStage = 0; G.arcDone = false;
    G.workers.cook = false; G.workers.scrapper = false;
    G.structures.tent = false; G.structures.workbench = false;
    G.structures.soup_kitchen = false; G.structures.garden = false;
    G.structures.barrel = false; G.structures.coats = false;
    G.petitions = {}; G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.mural = 0;
    Math.random = () => 0.99;
  };

  const none = await page.evaluate((seedSrc) => {
    const logs = [];
    const old = window.log;
    window.log = m => { logs.push(String(m)); old(m); };
    eval('(' + seedSrc + ')()');
    G.food = 10; G.morale = 50; G.health = 90; G.warmth = 80;
    G.dog = 0; G.dogHungry = false;
    onNewDay();
    window.log = old;
    return {
      logged: logs.some(m => /Biscuit|earned his keep/i.test(m)),
      morale: G.morale, warmth: G.warmth, food: G.food,
    };
  }, seed.toString());
  ok(!none.logged,
    `no dog — no biscuit keep line (logged=${none.logged})`);

  const fed = await page.evaluate((seedSrc) => {
    const logs = [];
    const old = window.log;
    window.log = m => { logs.push(String(m)); old(m); };
    eval('(' + seedSrc + ')()');
    G.food = 10; G.morale = 50; G.health = 90; G.warmth = 50;
    G.dog = 2; G.dogHungry = false;
    const food0 = G.food, morale0 = G.morale, warmth0 = G.warmth;
    onNewDay();
    window.log = old;
    const keep = logs.filter(m => /earned his keep/i.test(m));
    const hungry = logs.some(m => /curls up hungry/i.test(m));
    return {
      food: G.food, morale: G.morale, warmth: G.warmth,
      dFood: G.food - food0, dMorale: G.morale - morale0, dWarmth: G.warmth - warmth0,
      keep: keep[0] || '', hungry, dogHungry: G.dogHungry,
      join: DOG_EVENTS.joins.effect.toString(),
    };
  }, seed.toString());
  ok(/earns it/.test(fed.join),
    'the live join effect still says he earns it');
  ok(/earned his keep/.test(fed.keep) && /\+2 morale/.test(fed.keep) && /\+3 warmth/.test(fed.keep),
    `HV-92: a fed dawn logs that Biscuit earned his keep (got ${JSON.stringify(fed.keep)})`);
  ok(!fed.hungry && !fed.dogHungry,
    'a fed dawn does not also claim he curled up hungry');
  // camp drain is 1.5 food + 1 biscuit; season 0 warmth -8 +3 dog; morale -3 +2 dog
  ok(fed.dFood === -2.5 && fed.dMorale === -1 && fed.dWarmth === -5,
    `the keep still pays — food ${fed.dFood}, morale ${fed.dMorale}, warmth ${fed.dWarmth}`);

  const broke = await page.evaluate((seedSrc) => {
    const logs = [];
    const old = window.log;
    window.log = m => { logs.push(String(m)); old(m); };
    eval('(' + seedSrc + ')()');
    G.food = 0; G.morale = 50; G.health = 90; G.warmth = 80;
    G.dog = 2; G.dogHungry = false;
    onNewDay();
    window.log = old;
    return {
      hungry: logs.some(m => /curls up hungry/i.test(m)),
      keep: logs.some(m => /earned his keep/i.test(m)),
      dogHungry: G.dogHungry,
    };
  }, seed.toString());
  ok(broke.hungry && broke.dogHungry && !broke.keep,
    `a broke dawn still logs the empty bowl, not the keep (hungry=${broke.hungry}, keep=${broke.keep})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
