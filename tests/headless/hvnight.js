/*
 * HV-102 — dawn wrote the new day, then a reload put last night back.
 *
 * onNewDay does G.days++; saveGame(); and then spends the night:
 * yesterday's forecast becomes today's sky, the larder drains, the
 * fire cools, Ray's ledger ticks, a sweep can tear the tent. None of
 * that is written. Autosave is thirty seconds later. A refresh in
 * that window keeps the new day number and yesterday's food, weather,
 * and tents. The HUD already showed the morning. The save did not.
 *
 * Distinct from HV-95 (#763): loadGame wiping packedUp. Distinct from
 * HV-65 (hvfriend): a missing fade latch. Distinct from the dawn-order
 * tickets (Cook / Soup / Biscuit) — those are which line runs first,
 * not which write survives a reload. Not the bare-wall family (#768 /
 * #771).
 *
 * A. Source: onNewDay still increments the day. saveGame runs after
 *    the night drain (food / weather), not only before it. ui.js is
 *    not this ticket.
 * B. A quiet dawn: memory matches disk (food 8.5, weather rain).
 * C. Reload keeps the drained night, not last night's shelf.
 * D. Isolation: a mid-day saveGame still writes the current purse.
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
const nextAt = loop.indexOf('// ── The regulars', dawnAt);
const dawn = dawnAt >= 0 && nextAt > dawnAt ? loop.slice(dawnAt, nextAt) : '';

ok(dawnAt >= 0 && /G\.days\s*\+\+/.test(dawn),
  'onNewDay still increments the day');
const foodAt = dawn.indexOf('G.food');
const weatherAt = dawn.search(/G\.weather\s*=\s*G\.forecast/);
const lastSave = dawn.lastIndexOf('saveGame()');
ok(foodAt > 0 && weatherAt > 0 && lastSave > foodAt && lastSave > weatherAt,
  'HV-102: saveGame runs after the night drain, not only before it');
ok(!/onNewDay/.test(ui),
  'ui.js is not this ticket — dawn still lives in gameloop.js');

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvnight-init')) {
      sessionStorage.setItem('hvnight-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const quietDawn = () => page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.days = 5;
    G.timeOfDay = 0.05;
    G.food = 10;
    G.warmth = 80;
    G.health = 80;
    G.morale = 50;
    G.weather = 'clear';
    G.forecast = 'rain';
    G.population = 1;
    G.lastEventDay = 999;
    // Already met Biscuit so checkDog does not write a late save that
    // would hide the early-write hole. Not close enough to join.
    G.dog = 1;
    G.dogMetDay = 999;
    G.arcStage = 3;
    G.arcDone = true;
    G.goalIndex = 99;
    G.workers.scrapper = false;
    G.workers.cook = false;
    G.structures.tent = false;
    G.structures.garden = false;
    G.structures.barrel = false;
    G.structures.soup_kitchen = false;
    G.structures.pantry = false;
    G.structures.coats = false;
    G.rainBetOn = false;
    G.rayDebt = 0;
    G.friendDay = -1;
    G.snapUntil = null;
    G.rep = 0;
    G.petitions = {};
    saveGame();
    onNewDay();
    Math.random = real;
    const disk = JSON.parse(localStorage.getItem('homeless_village_v1') || '{}');
    return {
      mem: { days: G.days, food: G.food, weather: G.weather, warmth: G.warmth },
      disk: { days: disk.days, food: disk.food, weather: disk.weather, warmth: disk.warmth },
    };
  });

  const after = await quietDawn();
  ok(after.mem.days === 6 && after.mem.food === 8.5 && after.mem.weather === 'rain',
    `memory spent the night (days ${after.mem.days}, food ${after.mem.food}, weather ${after.mem.weather})`);
  ok(after.disk.days === 6 && after.disk.food === 8.5 && after.disk.weather === 'rain',
    `HV-102: the save spent the night too (days ${after.disk.days}, food ${after.disk.food}, weather ${after.disk.weather})`);

  await page.reload({ waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);
  const reloaded = await page.evaluate(() => ({
    days: G.days, food: G.food, weather: G.weather, warmth: G.warmth,
  }));
  ok(reloaded.days === 6 && reloaded.food === 8.5 && reloaded.weather === 'rain',
    `HV-102: a reload keeps the drained night (days ${reloaded.days}, food ${reloaded.food}, weather ${reloaded.weather})`);

  const mid = await page.evaluate(() => {
    G.food = 4;
    saveGame();
    const disk = JSON.parse(localStorage.getItem('homeless_village_v1') || '{}');
    return { food: disk.food };
  });
  ok(mid.food === 4, `a mid-day save still writes the current purse (food ${mid.food})`);

  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  await ctx.close();
  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
