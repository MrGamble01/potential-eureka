/*
 * HV-194 — Kind Stranger said someone left a bag of food near
 * the bridge, then a rainy day still delivered it dry.
 *
 * The card is a bag of food left outside, next to the bridge.
 * Rain halves the corner and soaks anything left in the open.
 * The effect always added rand(3,8) food. The sky never ran.
 *
 * Distinct from HV-191 (#881: Marisol leftovers on the fence
 * post — a dawn perk, not this event), HV-86 (#751: the
 * morale line on the same receipt), HV-70 (Found $5 is money),
 * and HV-67 (Good Weather clears the sky; this card does not).
 *
 *  A. Source: kind_stranger still exists and still promises a bag
 *     near the bridge.
 *  B. HV-194: the effect reads the sky and does not add food in rain.
 *  C. Live rain: the bag is named soaked; food stays put; morale
 *     still rises (the mercy landed).
 *  D. Live clear: the same roll still pays food.
 *  E. Found $5 in the rain is still five goodwill — a bill spends
 *     wet. Marisol leftovers are not this card.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent() on the production event.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const block = /id:'kind_stranger'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(src);
ok(!!block && /bag of food near the bridge/.test(src),
  'kind_stranger is still a bag of food near the bridge');
ok(block && /G\.weather\s*===\s*['"]rain['"]/.test(block[1]),
  'HV-194: the bag reads the sky and does not add food in rain');

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
    if (!sessionStorage.getItem('hvbag-init')) {
      sessionStorage.setItem('hvbag-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const drop = (weather, roll) => page.evaluate(({ w, r }) => {
    const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
    const real = Math.random;
    Math.random = () => r;
    G.weather = w;
    G.food = 10;
    G.morale = 50;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, true);
    Math.random = real;
    return {
      food: G.food,
      morale: G.morale,
      weather: G.weather,
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  }, { w: weather, r: roll });

  const wet = await drop('rain', 0);
  ok(wet.banner === 'Kind Stranger', `the card is still Kind Stranger (${wet.banner})`);
  ok(/bag of food near the bridge/i.test(wet.body), 'the body is still a bag near the bridge');
  ok(wet.food === 10,
    `HV-194: rain soaks the bag — food stays 10, not ${wet.food}`);
  ok(wet.morale > 50,
    `the mercy still lifts morale (${wet.morale})`);
  ok(/soak|rain|wet/i.test(wet.log),
    `the log names the rain (${wet.log.slice(-100)})`);

  const dry = await drop('clear', 0);
  ok(dry.food === 13,
    `a clear drop still pays +3 food (10 → ${dry.food})`);
  ok(dry.weather === 'clear',
    `Kind Stranger does not clear or start the rain (weather=${dry.weather})`);

  const five = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'found_money');
    G.weather = 'rain';
    G.goodwill = 10;
    G.morale = 50;
    triggerEvent(ev, true);
    return { goodwill: G.goodwill, weather: G.weather };
  });
  ok(five.goodwill === 15 && five.weather === 'rain',
    `Found $5 in the rain is still five goodwill (${five.goodwill})`);

  const leftovers = await t(() => {
    const real = Math.random;
    Math.random = () => 0.1;
    G.regulars = { marisol: 5, ray: 0, dee: 0 };
    G.weather = 'rain';
    G.food = 10;
    G.population = 1;
    G.dog = 0;
    G.workers = { scrapper: false, builder: false, cook: false, lookout: false };
    G.structures.garden = false;
    G.structures.soup_kitchen = false;
    G.structures.pantry = false;
    G.forecast = 'rain';
    G.lastEventDay = G.days + 5;
    G.health = 90; G.warmth = 90; G.morale = 50;
    G.snapUntil = null;
    if (typeof SNAP_CHANCE !== 'undefined') SNAP_CHANCE = 0;
    onNewDay();
    Math.random = real;
    return {
      food: G.food,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  });
  ok(leftovers.log.includes('Marisol left a bag of tamales') && leftovers.food >= 10,
    `Marisol leftovers are not this card (food=${leftovers.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
