/*
 * HV-255 — the Potluck said folding tables by the fridge, then a
 * rainy opening still paid a dry-day dish.
 *
 * The potluck is folding tables by the fridge, everyone brings a
 * dish: +4 food and +5 morale. Rain soaks an outdoor table. The
 * opening still paid the full dry-day plate.
 *
 * Kind Stranger rain is not this card. Marisol's casserole rain is
 * not this card. A clear opening still pays +4. Heat is not this
 * card. ui.js is not this ticket.
 *
 *  A. Source: the potluck still claims folding tables and +4 / +5.
 *  B. Source: a rainy opening halves the food.
 *  C. A rainy board-camp opening pays +2 food, +5 morale.
 *  D. A clear board-camp opening still pays +4 food, +5 morale.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production fridge-seed potluck on boot.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const main = fs.readFileSync(path.join(ROOT, 'homeless-village/js/main.js'), 'utf8');
const config = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const seedAt = main.indexOf('HV-37: the board means the potluck');
const seed = seedAt >= 0 ? main.slice(seedAt, seedAt + 900) : '';

ok(/POTLUCK_FOOD\s*=\s*4/.test(config) && /POTLUCK_MORALE\s*=\s*5/.test(config),
  'the potluck is still +4 food and +5 morale');
ok(/folding tables by the fridge/.test(config) || /folding tables by the fridge/.test(main),
  'the potluck still claims folding tables by the fridge');
ok(/weather==='rain'/.test(seed) && /POTLUCK_FOOD\/2/.test(seed),
  'HV-255: a rainy opening halves the dish');
ok(!/homeless-village\/js\/ui\.js/.test(main) && !/homeless-village\/js\/ui\.js/.test(config),
  'the cut lives on the potluck seed — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvwetluck-init')) {
      sessionStorage.setItem('hvwetluck-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-festival');
      localStorage.setItem('hv-fridge', JSON.stringify({ built: true, camps: 2 }));
      localStorage.setItem('homeless_village_v1', JSON.stringify({
        weather: 'rain', fridgeSeeded: false, food: 0, morale: 50, health: 100,
      }));
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const wet = await t(() => {
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    return {
      weather: G.weather,
      food: G.food,
      morale: G.morale,
      days: loadPotluck().days,
      board: fridgeHasBoard(),
      log: lines.join(' '),
    };
  });
  ok(wet.board && wet.weather === 'rain',
    `the rainy boot is a board camp under rain (board=${wet.board}, sky=${wet.weather})`);
  ok(wet.food === 2 && wet.morale === 55,
    `HV-255: rain soaks the dish — +2 food, +5 morale (food=${wet.food}, morale=${wet.morale})`);
  ok(/rain got into the dishes/.test(wet.log),
    'the log names the rain on the tables');
  ok(wet.days === 1, `the potluck still tallies the day (${wet.days})`);

  await t(() => {
    localStorage.setItem('hv-fridge', JSON.stringify({ built: true, camps: 2 }));
    savePotluck({ days: 0 });
    G.weather = 'clear';
    G.fridgeSeeded = false;
    G.food = 0;
    G.morale = 50;
    saveGame();
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const dry = await t(() => {
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    return {
      weather: G.weather,
      food: G.food,
      morale: G.morale,
      log: lines.join(' '),
    };
  });
  ok(dry.weather === 'clear' && dry.food === 4 && dry.morale === 55,
    `a clear opening still pays the dry-day dish (food=${dry.food}, morale=${dry.morale})`);
  ok(/everyone brings a dish/.test(dry.log),
    'the clear log still names a dry dish');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
