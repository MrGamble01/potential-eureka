/*
 * HV-110 — Community Garden said each day, then frost gave nothing.
 *
 * The recipe says "Slowly generates food each day." On a cold dawn
 * the beds logged "the garden gave nothing today" unless the compost
 * was already built. Compost is the extra bed ("keeps one bed alive
 * through frost"). The garden's own day still belongs to the garden.
 *
 * Distinct from HV-25 (compost's +1 on frost), HV-5 (hvweather's
 * frost drain), and open coat / snap / scrapper tickets.
 *
 *  A. Source: the frost branch adds food without requiring compost.
 *     The "gave nothing today" line is gone.
 *  B. The recipe still promises food each day.
 *  C. Live: a frosty garden with no bin yields +1 more than no
 *     garden. The bin still adds exactly one extra bed.
 *  D. A clear day is unchanged — this is not a compost rewrite.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives onNewDay() on the production path.
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
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const gardenAt = loop.indexOf('if(G.structures.garden)');
const garden = gardenAt >= 0 ? loop.slice(gardenAt, gardenAt + 900) : '';
ok(gardenAt >= 0 && /weather==='cold'/.test(garden),
  'the garden frost branch is still in gameloop.js');
ok(garden && /G\.food\s*\+=/.test(garden) && !/gave nothing today/.test(garden),
  'HV-110: frost still feeds — the garden gives every day, bin or not');
ok(/id:'garden'[\s\S]{0,220}?Slowly generates food each day/.test(cfg),
  'the garden recipe still promises food each day');
ok(!/gave nothing today/.test(ui), 'ui.js is untouched');

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
    if (!sessionStorage.getItem('hvgarden-init')) {
      sessionStorage.setItem('hvgarden-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const dawn = (weather, garden, compost) => t(new Function(`
    const real = Math.random;
    Math.random = () => 0.5;
    SNAP_CHANCE = 0;
    G.snapUntil = null;
    G.population = 1; G.dog = 0;
    G.workers.scrapper = false; G.workers.cook = false;
    G.structures.tent = false;
    G.structures.workbench = false; G.structures.toolbox = false;
    G.structures.garden = ${garden};
    G.structures.compost = ${compost};
    G.structures.pantry = false; G.structures.soup_kitchen = false;
    G.structures.barrel = false; G.barrelWater = 0;
    G.rep = 0; G.days = 1; G.warmth = 90; G.health = 90; G.morale = 50;
    G.forecast = '${weather}'; G.lastEventDay = G.days + 9;
    G.goalIndex = GOALS.length;
    G.food = 20;
    onNewDay();
    Math.random = real;
    return { food: G.food, days: G.compostDays || 0, weather: G.weather };
  `));

  const bareFrost = await dawn('cold', false, false);
  const gardenFrost = await dawn('cold', true, false);
  const compostFrost = await dawn('cold', true, true);
  ok(gardenFrost.weather === 'cold', 'the controlled dawn is a frost');
  ok(gardenFrost.food === bareFrost.food + 1,
    `HV-110: a frosty garden with no bin still yields +1 (${bareFrost.food} → ${gardenFrost.food})`);
  ok(compostFrost.food === gardenFrost.food + 1 && compostFrost.days === 1,
    `the compost still keeps one extra bed (+1, tally ${compostFrost.days})`);

  const bareClear = await dawn('clear', false, false);
  const gardenClear = await dawn('clear', true, false);
  ok(gardenClear.food > bareClear.food,
    `a clear garden day still yields (${bareClear.food} → ${gardenClear.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
