/* HV-99 — Soup Kitchen said at dusk, then fed at dawn.
 *
 * The recipe tooltip is the thing you read before spending 10 wood,
 * 8 scraps, 5 cans and 5 goodwill: "feeds everyone at dusk (1 food
 * each)". The HUD even has a Dusk label (timeOfDay 4/6). Soup night
 * lives in soupNightAtDawn(), called from onNewDay. Crossing dusk
 * does nothing. The pot comes due with the dawn log.
 *
 * Distinct from HV-64 / #716 (soup vs the dawn drain *order* — that
 * ticket keeps soup at dawn). This ticket is the clock the recipe
 * sold. ui.js is not this ticket; it still only paints r.desc.
 *
 * Write-first. Hook-free.
 *
 *  A. Source: the recipe no longer says "at dusk"; it names dawn /
 *     overnight. 1 food each, +4 morale, +2 health stay. soupNightAtDawn
 *     is still the feeder.
 *  B. Live: #craft-soup_kitchen's tip matches that clock.
 *  C. Isolation: walking afternoon → dusk does not take the food.
 *  D. Isolation: soupNightAtDawn still serves the camp.
 *  Z. Zero page errors.
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

const recAt = cfg.indexOf("id:'soup_kitchen'");
const rec = recAt >= 0 ? cfg.slice(recAt, recAt + 420) : '';

ok(recAt >= 0 && /id:'soup_kitchen'/.test(rec),
  'Soup Kitchen is still a workbench recipe — guards the guard');
ok(/1 food each/.test(rec) && /\+4 morale/.test(rec) && /\+2 health/.test(rec),
  'the recipe still sells 1 food each, +4 morale, +2 health');
ok(!/at dusk/.test(rec) && (/at dawn/.test(rec) || /overnight/.test(rec)),
  'HV-99: the recipe names dawn/overnight, not dusk');
ok(/function soupNightAtDawn\s*\(/.test(loop) && /soupNightAtDawn\s*\(\s*\)/.test(loop),
  'soupNightAtDawn() is still the feeder onNewDay calls');
ok(!/soupNightAtDawn/.test(ui) && !/at dusk/.test(ui),
  'ui.js is not this ticket — it still only paints r.desc');

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
    localStorage.setItem('hv-intro-seen', '1');
    if (!sessionStorage.getItem('hvsoupdusk-init')) {
      sessionStorage.setItem('hvsoupdusk-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2200);

  const tip = await page.evaluate(() => {
    const el = document.getElementById('craft-soup_kitchen');
    return el ? el.getAttribute('data-tip') || '' : '';
  });
  ok(!!tip && /1 food/.test(tip) && /\+4 morale/.test(tip),
    'B. the craft tip still quotes the pot');
  ok(!/at dusk/i.test(tip) && (/dawn/i.test(tip) || /overnight/i.test(tip)),
    'HV-99: the craft tip no longer sells dusk');

  const dusk = await page.evaluate(() => {
    const logs = [];
    const oldLog = window.log;
    window.log = m => { logs.push(String(m)); oldLog(m); };
    G.structures.soup_kitchen = true;
    G.population = 4;
    G.food = 20;
    G.morale = 50;
    G.health = 60;
    G.days = 12;
    G.timeOfDay = 0.64; // afternoon, just before dusk (4/6 ≈ 0.667)
    G.dog = 1;
    G.dogMetDay = 999;
    G.goalIndex = 9999;
    G.lastEventDay = 9999;
    G.arcStage = 2;
    G.arcDone = true;
    const food0 = G.food;
    const label0 = document.getElementById('time-label').textContent;
    tickDay(DAY_LENGTH_MS * 0.08); // cross 0.667 into dusk, stay under night
    const label1 = document.getElementById('time-label').textContent;
    window.log = oldLog;
    return {
      food0: food0,
      food: G.food,
      tod: G.timeOfDay,
      label0: label0,
      label1: label1,
      souped: logs.some(m => /Soup night/.test(m)),
    };
  });
  ok(dusk.tod > 4 / 6 && dusk.tod < 5 / 6 && /Dusk/i.test(dusk.label1),
    `C. the clock actually landed on Dusk (${dusk.label0} → ${dusk.label1}, tod=${dusk.tod.toFixed(3)})`);
  ok(dusk.food === dusk.food0 && !dusk.souped,
    `C. dusk does not take the pot (food ${dusk.food0}→${dusk.food})`);

  const dawn = await page.evaluate(() => {
    const oldR = Math.random;
    Math.random = () => 0.9;
    const logs = [];
    const oldLog = window.log;
    window.log = m => { logs.push(String(m)); oldLog(m); };
    G.structures.soup_kitchen = true;
    G.population = 4;
    G.food = 20;
    G.morale = 50;
    G.health = 60;
    soupNightAtDawn();
    Math.random = oldR;
    window.log = oldLog;
    return {
      food: G.food,
      morale: G.morale,
      health: G.health,
      logged: logs.some(m => /Soup night/.test(m)),
    };
  });
  ok(dawn.food === 16 && dawn.morale === 54 && dawn.health === 62 && dawn.logged,
    `D. dawn still serves four bowls (food ${dawn.food}, morale ${dawn.morale}, health ${dawn.health})`);

  ok(errs.length === 0, `live path: no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
