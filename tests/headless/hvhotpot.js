/*
 * HV-264 — Soup night said everyone ate hot, then a scorcher
 * still fired the pot.
 *
 * The log is hot soup. A heat wave is the last sky for firing
 * a pot. The kitchen never read the sky.
 *
 * A clear stocked dawn still serves. Rain still serves. A
 * short pantry still stays cold. Illness is not this card.
 * Dusk is not this card. ui.js is not this ticket.
 *
 *  A. Source: soupNightAtDawn returns on heat before it spends food.
 *  B. A scorcher leaves the pantry and the tally untouched.
 *  C. A clear stocked dawn still serves.
 *  D. Rain still serves — a wet sky is not this card.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production soupNightAtDawn.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const at = loop.indexOf('function soupNightAtDawn()');
const end = loop.indexOf('function muralAtDawn()');
const body = at >= 0 && end > at ? loop.slice(at, end) : '';

ok(/everyone ate hot/.test(loop),
  'the night still says everyone ate hot');
ok(/weather==='heat'/.test(body) && /nobody wanted the pot fired/.test(body),
  'HV-264: soupNightAtDawn leaves the pot unfired on a scorcher');
ok(!/sickness|sickDay|sickUntil/.test(body),
  'illness is not this card');
ok(!/homeless-village\/js\/ui\.js/.test(loop),
  'the cut lives on the dawn pot — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvhotpot-init')) {
      sessionStorage.setItem('hvhotpot-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const dry = await t(() => {
    const oldR = Math.random; Math.random = () => 0.9;
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    G.structures.soup_kitchen = true;
    G.population = 4;
    G.food = 20;
    G.morale = 50;
    G.health = 60;
    G.soupNights = 0;
    G.weather = 'clear';
    soupNightAtDawn();
    window.log = prev;
    Math.random = oldR;
    return {
      food: G.food, morale: G.morale, health: G.health,
      nights: G.soupNights, last: captured[captured.length - 1] || '',
    };
  });
  ok(dry.food === 16 && dry.morale === 54 && dry.health === 62 && dry.nights === 1,
    `a clear stocked dawn still serves (food=${dry.food}, nights=${dry.nights})`);
  ok(/everyone ate hot/.test(dry.last),
    `the dry log still names the hot pot (${dry.last})`);

  const hot = await t(() => {
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    G.structures.soup_kitchen = true;
    G.population = 4;
    G.food = 20;
    G.morale = 50;
    G.health = 60;
    G.soupNights = 0;
    G.weather = 'heat';
    soupNightAtDawn();
    window.log = prev;
    return {
      food: G.food, morale: G.morale, health: G.health,
      nights: G.soupNights, last: captured[captured.length - 1] || '',
    };
  });
  ok(hot.food === 20 && hot.morale === 50 && hot.health === 60 && hot.nights === 0,
    `HV-264: a scorcher leaves the pantry (food=${hot.food}, nights=${hot.nights})`);
  ok(/nobody wanted the pot fired/.test(hot.last),
    `the last line names the scorcher (${hot.last})`);

  const wet = await t(() => {
    const oldR = Math.random; Math.random = () => 0.9;
    G.structures.soup_kitchen = true;
    G.population = 4;
    G.food = 20;
    G.morale = 50;
    G.health = 60;
    G.soupNights = 0;
    G.weather = 'rain';
    soupNightAtDawn();
    Math.random = oldR;
    return { food: G.food, nights: G.soupNights };
  });
  ok(wet.food === 16 && wet.nights === 1,
    `rain still serves — a wet sky is not this card (food=${wet.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
