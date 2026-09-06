/*
 * HV-150 — City Sweep said confiscate supplies, then left the cardboard.
 *
 * The card body is "Police are clearing the camp. They destroy shelters
 * and confiscate supplies." The effect demolishes tents / kitchens /
 * workbenches / the garden and takes scraps and food. Cardboard is a
 * camp supply — blankets, patch-shelters, the tent, the stash, the
 * dry corner all spend it — and the sweep never touched the stack.
 * Cans are a different open ticket. Wood is a different event.
 *
 *  A. Source: the sweep effect assigns G.cardboard.
 *  B. The card still promises they confiscate supplies.
 *  C. A pinned sweep with 20 cardboard takes some of it.
 *  D. Scraps and food still go. Cans still sit (not this ticket).
 *  E. Theft still leaves the cardboard (control — different event).
 *  F. Church Donated Supplies still leaves the cardboard.
 *  G. Marisol's garage still zeroes the cardboard take.
 *  H. The tent still falls.
 *  Z. Zero page errors. ui.js untouched.
 *
 * Hook-free. Drives triggerEvent() on the production sweep.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const block = /id:'sweep'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(src);
ok(!!block, 'sweep event is still in gameloop.js');
ok(block && /G\.cardboard\s*=\s*Math\.max\s*\(\s*0\s*,\s*G\.cardboard/.test(block[1]),
  'HV-150: sweep effect confiscates cardboard');
ok(/confiscate supplies/.test(src),
  'the card still promises they confiscate supplies');
ok(!/G\.cardboard\s*=/.test(ui),
  'ui.js untouched — the take lives on the sweep effect');

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
    if (!sessionStorage.getItem('hvsweepbox-init')) {
      sessionStorage.setItem('hvsweepbox-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const pinSweep = () => page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    G.packedUp = false;
    G.garageCover = false;
    G.structures.tent = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.structures.garden = false;
    G.structures.stash = false;
    G.scraps = 20; G.food = 20; G.cans = 20; G.wood = 20; G.cardboard = 20;
    G.morale = 50;
    const ev = EVENTS_BAD.find(e => e.id === 'sweep');
    triggerEvent(ev, false);
    Math.random = real;
    return {
      cardboard: G.cardboard, scraps: G.scraps, food: G.food,
      cans: G.cans, wood: G.wood, tent: G.structures.tent,
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
    };
  });

  const hit = await pinSweep();
  ok(hit.banner === 'City Sweep', `the card still titles itself City Sweep (${hit.banner})`);
  ok(/confiscate supplies/i.test(hit.body), 'the body still confiscates supplies');
  ok(hit.cardboard < 20,
    `a pinned sweep takes cardboard (20 → ${hit.cardboard})`);
  ok(hit.scraps < 20 && hit.food < 20,
    `scraps and food still go (scraps ${hit.scraps}, food ${hit.food})`);
  ok(hit.cans === 20,
    `cans still sit — that is a different ticket (cans ${hit.cans})`);

  const theft = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.dog = 0; G.petitions = {};
    G.structures.stash = false;
    G.cans = 20; G.food = 20; G.scraps = 20; G.cardboard = 20; G.wood = 20;
    G.morale = 50;
    G.lastEventDay = G.days;
    G.goalIndex = GOALS.length;
    triggerEvent(EVENTS_BAD.find(e => e.id === 'theft'), false);
    Math.random = real;
    return { cardboard: G.cardboard, cans: G.cans };
  });
  ok(theft.cardboard === 20,
    `Theft still leaves the cardboard (control — ${theft.cardboard})`);

  const church = await t(() => {
    G.cardboard = 20; G.food = 10; G.scraps = 10; G.morale = 50;
    G.lastEventDay = G.days;
    G.goalIndex = GOALS.length;
    triggerEvent(EVENTS_GOOD.find(e => e.id === 'church_donation'), true);
    return { cardboard: G.cardboard, food: G.food };
  });
  ok(church.cardboard === 20 && church.food > 10,
    `Church Donated Supplies still leaves the cardboard (${church.cardboard})`);

  const garage = await t(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.garageCover = true; G.packedUp = false;
    G.structures.tent = true;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.structures.garden = false;
    G.structures.stash = false;
    G.scraps = 20; G.food = 20; G.cardboard = 20; G.morale = 80;
    G.lastEventDay = G.days;
    G.goalIndex = GOALS.length;
    triggerEvent(EVENTS_BAD.find(e => e.id === 'sweep'), false);
    Math.random = real;
    return { cardboard: G.cardboard, scraps: G.scraps, tent: G.structures.tent, cover: G.garageCover };
  });
  ok(garage.cardboard === 20 && garage.scraps === 20 && !garage.cover,
    `Marisol's garage still zeroes the cardboard take (${garage.cardboard})`);
  ok(!garage.tent, 'the tent still falls — the garage holds goods, not shelter');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
