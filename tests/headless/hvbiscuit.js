/* HV-74 — Biscuit never joined because dawn ate breakfast first.
 *
 * After "A Stray Dog" the log says "Keep some food on hand and he may
 * come closer." Two days later the join card says he "eats what's
 * offered" and the effect spends 2 food. checkDog gated on
 * `G.food >= 3` *after* onNewDay drained `population * 1.5` (and
 * after the Cook, if hired).
 *
 * A camp that kept 5 food for two people wakes with leftover 2.
 * 2 is enough to "eat what's offered." The gate still fails. Biscuit
 * stays at the fence. The befriend goal never completes. The player
 * did what the card asked.
 *
 * Distinct from HV-6 (the dog arc itself), HV-64 (Soup Night vs the
 * drain), HV-67 (Cook vs the drain), HV-71 (Lookout warning vs
 * Biscuit's bark). ui.js is not this ticket.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: checkDog's join gate reads food kept overnight — a
 *    snapshot taken before the population drain — not leftover after
 *    breakfast. ui.js is untouched.
 * B. Named: day 6, dog=1, food=5, population=2. Biscuit joins.
 *    Reverting the snapshot fails that named assertion (dog stays 1).
 * C. Isolation: overnight 2 is still not enough. A well-stocked 10
 *    still joins — HV-6 is not this ticket.
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

const dawnAt = loop.indexOf('function onNewDay(){');
const dogAt  = loop.indexOf('function checkDog');
ok(dawnAt >= 0 && dogAt > dawnAt, 'onNewDay and checkDog still live in gameloop.js');

const dawn = dawnAt >= 0 && dogAt > dawnAt ? loop.slice(dawnAt, dogAt) : '';
const dog  = dogAt >= 0 ? loop.slice(dogAt, dogAt + 500) : '';

const drainAt = dawn.search(/G\.food\s*=\s*Math\.max\(0,\s*G\.food\s*-\s*G\.population\s*\*\s*1\.5\)/);
const snapAt  = dawn.search(/foodOnHand\s*=\s*G\.food/);
ok(drainAt >= 0, 'the population breakfast drain is still in onNewDay');
ok(snapAt >= 0 && snapAt < drainAt,
  'onNewDay snapshots food on hand before the camp eats breakfast');

ok(/foodOnHand\s*>=\s*3/.test(dog) && /dogMetDay/.test(dog),
  'checkDog joins on food kept overnight, not leftover after the drain');

ok(/checkDog\(\s*foodOnHand\s*\)/.test(dawn),
  'onNewDay hands checkDog the overnight snapshot');

ok(!/checkDog/.test(ui) && !/foodOnHand/.test(ui),
  'ui.js is not this ticket — no checkDog, no foodOnHand');

(async () => {
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

  // --- B. named: kept 5 food for two people, join morning --------------
  const named = await page.evaluate(() => {
    SNAP_CHANCE = 0;
    G.days = 5;
    G.dog = 1;
    G.dogMetDay = 4;
    G.dogHungry = false;
    G.food = 5;
    G.population = 2;
    G.workers = { scrapper: false, builder: false, cook: false, lookout: false };
    G.structures.soup_kitchen = false;
    G.structures.garden = false;
    G.structures.pantry = false;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.lastEventDay = 99;
    G.forecast = 'clear';
    G.weather = 'clear';
    G.health = 90;
    G.warmth = 80;
    G.morale = 50;
    onNewDay();
    const ev = document.getElementById('ev-title');
    return {
      days: G.days,
      dog: G.dog,
      food: G.food,
      title: ev ? ev.textContent : '',
    };
  });
  ok(named.days === 6 && named.dog === 2 && named.title === 'Biscuit Comes Closer',
    `HV-74: Biscuit joins when 5 food was on hand for two people (days=${named.days}, dog=${named.dog}, leftover=${named.food}, title=${named.title})`);

  // --- C. isolation -----------------------------------------------------
  const broke = await page.evaluate(() => {
    SNAP_CHANCE = 0;
    G.days = 5;
    G.dog = 1;
    G.dogMetDay = 4;
    G.food = 2;
    G.population = 1;
    G.workers.cook = false;
    G.structures.soup_kitchen = false;
    G.structures.garden = false;
    G.structures.pantry = false;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.lastEventDay = 99;
    G.forecast = 'clear';
    onNewDay();
    return { dog: G.dog, days: G.days };
  });
  ok(broke.dog === 1 && broke.days === 6,
    `overnight 2 is still not enough — a broke camp does not get Biscuit (dog=${broke.dog})`);

  const stocked = await page.evaluate(() => {
    SNAP_CHANCE = 0;
    G.days = 5;
    G.dog = 1;
    G.dogMetDay = 4;
    G.food = 10;
    G.population = 1;
    G.workers.cook = false;
    G.structures.soup_kitchen = false;
    G.structures.garden = false;
    G.structures.pantry = false;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.lastEventDay = 99;
    G.forecast = 'clear';
    onNewDay();
    const ev = document.getElementById('ev-title');
    return { dog: G.dog, title: ev ? ev.textContent : '' };
  });
  ok(stocked.dog === 2 && stocked.title === 'Biscuit Comes Closer',
    'a well-stocked 10 still joins — HV-6 is not this ticket');

  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
