/*
 * HV-196 — Good Weather said a rare easy day, then the
 * Community Garden had already frosted.
 *
 * onNewDay promotes the forecast, harvests the beds, then
 * maybeEvent. Good Weather (HV-67) now assigns G.weather =
 * 'clear', but the garden already ran under the old sky. A
 * frost morning that the card then calls easy has already
 * given nothing.
 *
 * Distinct from HV-67 (#720: the sky never changed), HV-193
 * (#883: a named snap still harvested under a clear sky —
 * the opposite miss), HV-165 / HV-168 (heat / winter leftover),
 * and HV-190 (#880: empty-larder order). This is the card ×
 * the beds the same dawn.
 *
 *  A. Source: good_weather still clears the sky, and pays the
 *     beds when the sky it replaced was frost.
 *  B. The card still promises a rare easy day.
 *  C. Live frost, garden, pinned yield: the beds pay after
 *     the card. Weather is Clear. Warmth and morale still rise.
 *  D. No garden: frost still clears, food stays put.
 *  E. Rain or heat + garden: no second harvest (those mornings
 *     already grew). Kind Stranger is not this card.
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
const block = /id:'good_weather'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(src);
ok(!!block && /G\.weather\s*=\s*['"]clear['"]/.test(block[1]),
  'good_weather still assigns G.weather = \'clear\'');
ok(/Clear skies and mild temps/.test(src) && /rare easy day/.test(src),
  'the card still promises a rare easy day');
ok(block && /garden/.test(block[1]) && /cold/.test(block[1]),
  'HV-196: Good Weather pays the beds when it clears a frost morning');

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
    if (!sessionStorage.getItem('hveasy-init')) {
      sessionStorage.setItem('hveasy-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const sky = (opts) => page.evaluate((o) => {
    const ev = EVENTS_GOOD.find(e => e.id === o.id);
    const lines = [];
    const realLog = log;
    log = function (s) { lines.push(String(s)); realLog(s); };
    const real = Math.random;
    Math.random = () => o.roll;
    G.weather = o.weather;
    G.food = o.food;
    G.warmth = 50;
    G.morale = 50;
    G.structures.garden = !!o.garden;
    G.structures.compost = false;
    G.barrelWater = 0;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, true);
    Math.random = real;
    log = realLog;
    return {
      food: G.food,
      weather: G.weather,
      name: weatherDef().name,
      warmth: G.warmth,
      morale: G.morale,
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
      log: lines.join(' '),
    };
  }, opts);

  const frost = await sky({
    id: 'good_weather', weather: 'cold', food: 10, garden: true, roll: 0,
  });
  ok(frost.banner === 'Good Weather', `the card is still Good Weather (${frost.banner})`);
  ok(/rare easy day/i.test(frost.body), 'the body is still a rare easy day');
  ok(frost.weather === 'clear' && frost.name === 'Clear',
    `the sky still clears (weather=${frost.weather})`);
  ok(frost.food === 11,
    `HV-196: frost then Good Weather pays the beds (10 → ${frost.food})`);
  ok(/Garden yielded/i.test(frost.log),
    `the log names the harvest (${frost.log.slice(-90)})`);
  ok(frost.warmth > 50 && frost.morale > 50,
    `warmth and morale still rise (${frost.warmth}/${frost.morale})`);

  const bare = await sky({
    id: 'good_weather', weather: 'cold', food: 10, garden: false, roll: 0,
  });
  ok(bare.weather === 'clear' && bare.food === 10,
    `no garden: frost still clears, food stays 10 (${bare.food})`);

  const wet = await sky({
    id: 'good_weather', weather: 'rain', food: 10, garden: true, roll: 0,
  });
  ok(wet.weather === 'clear' && wet.food === 10,
    `rain + garden does not pay a second harvest (${wet.food})`);

  const hot = await sky({
    id: 'good_weather', weather: 'heat', food: 10, garden: true, roll: 0,
  });
  ok(hot.weather === 'clear' && hot.food === 10,
    `heat + garden does not pay a second harvest (${hot.food})`);

  const stranger = await sky({
    id: 'kind_stranger', weather: 'cold', food: 10, garden: true, roll: 0,
  });
  ok(stranger.weather === 'cold' && stranger.food > 10 && !/Garden yielded/i.test(stranger.log),
    `Kind Stranger is not this card (weather=${stranger.weather}, food=${stranger.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
