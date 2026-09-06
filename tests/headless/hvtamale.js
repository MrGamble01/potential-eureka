/*
 * HV-184 — Marisol said leftovers some mornings, then Biscuit
 * had already curled up hungry.
 *
 * Marisol's friendship perk is a bag of tamales some mornings.
 * Biscuit's keep is one food a day — fed, he earns it; empty,
 * he curls up hungry. onNewDay runs the dog's breakfast, then
 * regularFavorsAtDawn. A friend-Marisol drop on an empty pot
 * arrives after the hungry latch is already set. The tamales
 * sit in the pot. He already went without.
 *
 * Distinct from HV-92 (#759: a fed dawn stayed silent), HV-76
 * (#738: hungry Biscuit still chased thieves), HV-158 (#848:
 * dogwalk vs hungry Biscuit), and HV-73 (#731: join lost to
 * the drain). This is Marisol's leftovers × Biscuit's keep.
 *
 *  A. Source: regularFavorsAtDawn runs before the dog's breakfast.
 *  B. Marisol still promises leftovers some mornings.
 *  C. Biscuit still eats one food a day.
 *  D. Friend Marisol, empty pot, pinned drop: he eats, not hungry.
 *  E. A miss still leaves him hungry. dog=0 still pays 10.5.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives onNewDay on the production dawn path.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const onNew = /function onNewDay\(\)\{([\s\S]*?)\nfunction /.exec(loop);
const body = onNew ? onNew[1] : '';
const dogAt = body.indexOf('G.dog===2');
const mariAt = body.indexOf('regularFavorsAtDawn');
ok(!!onNew && dogAt >= 0 && mariAt >= 0, 'onNewDay still feeds Biscuit and calls regularFavorsAtDawn');
ok(mariAt < dogAt,
  'HV-184: Marisol\'s leftovers land before Biscuit\'s breakfast');
ok(/sends leftovers to the camp some mornings/.test(cfg),
  'Marisol still promises leftovers some mornings');
ok(/One food a day keeps him fed — he earns it/.test(loop),
  'Biscuit still eats one food a day');

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
    if (!sessionStorage.getItem('hvtamale-init')) {
      sessionStorage.setItem('hvtamale-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const dawn = (opts) => page.evaluate((o) => {
    const lines = [];
    const realLog = log;
    log = function (s) { lines.push(String(s)); realLog(s); };
    const real = Math.random;
    Math.random = () => o.roll;
    G.dog = o.dog;
    G.dogHungry = false;
    G.regulars = { marisol: o.mari, ray: 0, dee: 0 };
    G.food = o.food;
    G.population = 1;
    G.warmth = 80; G.morale = 50; G.health = 90;
    G.workers = { scrapper: false, builder: false, cook: false, lookout: false };
    G.structures.garden = false; G.structures.soup_kitchen = false;
    G.structures.pantry = false; G.structures.tent = false;
    G.structures.workbench = false;
    G.forecast = 'clear'; G.weather = 'clear'; G.season = 0;
    G.lastEventDay = G.days + 5;
    G.goalIndex = GOALS.length;
    G.snapUntil = null; G.friendDay = -1; G.rayDebt = 0; G.rainBetOn = false;
    onNewDay();
    Math.random = real;
    log = realLog;
    return {
      food: G.food,
      hungry: G.dogHungry,
      morale: G.morale,
      log: lines.join(' '),
    };
  }, opts);

  // roll 0.1: Marisol drops (0.1 < .3), rand(2,4) → 2
  const late = await dawn({ dog: 2, mari: 5, food: 0, roll: 0.1 });
  ok(/Marisol left a bag of tamales/.test(late.log),
    'friend Marisol still leaves tamales on the empty pot');
  ok(!late.hungry && late.food === 1,
    `the tamales feed him first (hungry=${late.hungry}, food=${late.food})`);
  ok(!/curls up hungry/.test(late.log),
    'the hungry line does not fire when the leftovers made breakfast');

  const miss = await dawn({ dog: 2, mari: 5, food: 0, roll: 0.9 });
  ok(miss.hungry && miss.food === 0 && /curls up hungry/.test(miss.log),
    `a missed drop still leaves him hungry (hungry=${miss.hungry}, food=${miss.food})`);

  const quiet = await dawn({ dog: 0, mari: 5, food: 10, roll: 0.1 });
  ok(quiet.food === 10.5 && /Marisol left a bag of tamales/.test(quiet.log),
    `dog=0 still pays 10 − 1.5 + 2 = 10.5 (${quiet.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
