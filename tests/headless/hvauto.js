/*
 * HV-142 — the Scrapper said auto-scavenges, then never found food.
 *
 * The crash course and the Scavenge tooltip say dumpster work brings
 * cans, scraps, or food. The hire card says "Auto-scavenges every day."
 * Dawn only adds scraps and cans. Food never moves.
 *
 *  A. Source: the Scrapper dawn line assigns food.
 *  B. The hire card still says Auto-scavenges every day.
 *  C. A pinned low roll finds food, not just scraps.
 *  D. A pinned high roll still finds scraps and can skip food.
 *  E. The Cook still spends 3 food for +2 goodwill.
 *  Z. Zero page errors. ui.js untouched.
 *
 * Hook-free. Drives onNewDay() on the production dawn path.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'homeless-village.html'), 'utf8');

const scrap = /if\(G\.workers\.scrapper\)\{([^}]+)\}/.exec(loop);
ok(!!scrap, 'the Scrapper dawn line is still in gameloop.js');
ok(scrap && /G\.food\s*\+=/.test(scrap[1]),
  'HV-142: the Scrapper dawn line assigns food');
ok(/id:'scrapper'[\s\S]{0,80}?Auto-scavenges every day/.test(cfg),
  'the hire card still says Auto-scavenges every day');
ok(/SCRAPPER_FOOD_CHANCE\s*=\s*0\.45/.test(cfg),
  'SCRAPPER_FOOD_CHANCE matches Scavenge\'s food roll');
ok(/scavenge \(cans, scraps, food\)/.test(html) || /cans, scraps, food/.test(html),
  'the crash course still names food as a scavenge haul');
ok(/workers\.cook&&G\.food>=3/.test(loop) && /goodwill\+=2/.test(loop),
  'the Cook still spends 3 food for +2 goodwill');
ok(!/SCRAPPER_FOOD/.test(ui),
  'ui.js is untouched');

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
    if (!sessionStorage.getItem('hvauto-init')) {
      sessionStorage.setItem('hvauto-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const haul = (roll) => page.evaluate((r) => {
    const real = Math.random;
    Math.random = () => r;
    SNAP_CHANCE = 0;
    G.goalIndex = GOALS.length;
    G.workers.scrapper = true;
    G.workers.cook = false;
    G.workers.lookout = false;
    G.structures.garden = false;
    G.structures.pantry = false;
    G.structures.tent = false;
    G.structures.workbench = false;
    G.structures.barrel = false;
    G.structures.soup_kitchen = false;
    G.dog = 0;
    G.snapUntil = null;
    G.season = 0;
    G.weather = 'clear';
    G.forecast = 'clear';
    G.days = 3;
    G.lastEventDay = 3;
    G.population = 1;
    G.food = 10;
    G.scraps = 5;
    G.cans = 5;
    G.warmth = 80;
    G.morale = 50;
    G.health = 80;
    G.rep = 0;
    G.mural = 0;
    G.favor = null;
    G.ticketAsk = null;
    G.newcomerAsk = null;
    onNewDay();
    Math.random = real;
    return { food: G.food, scraps: G.scraps, cans: G.cans, days: G.days };
  }, roll);

  const low = await haul(0);
  ok(low.scraps > 5, `a low roll still finds scraps (5 → ${low.scraps})`);
  ok(low.food > 8.5,
    `HV-142: a low scrapper roll finds food, not just scraps (10 − 1.5 drain → ${low.food})`);

  const high = await haul(0.99);
  ok(high.scraps > 5, `a high roll still finds scraps (5 → ${high.scraps})`);
  ok(high.food === 8.5,
    `a high roll can skip food the way Scavenge does (10 − 1.5 drain → ${high.food})`);

  const cook = await t(() => {
    const real = Math.random;
    Math.random = () => 0.99;
    SNAP_CHANCE = 0;
    G.workers.scrapper = false;
    G.workers.cook = true;
    G.structures.garden = false;
    G.structures.pantry = false;
    G.dog = 0;
    G.snapUntil = null;
    G.season = 0;
    G.weather = 'clear';
    G.forecast = 'clear';
    G.days = 3;
    G.lastEventDay = 3;
    G.population = 1;
    G.food = 10;
    G.goodwill = 4;
    G.warmth = 80;
    G.morale = 50;
    G.health = 80;
    G.rep = 0;
    G.mural = 0;
    onNewDay();
    Math.random = real;
    return { food: G.food, goodwill: G.goodwill };
  });
  ok(cook.goodwill === 6 && cook.food === 5.5,
    `the Cook still spends 3 food for +2 goodwill after the drain (food=${cook.food}, gw=${cook.goodwill})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
