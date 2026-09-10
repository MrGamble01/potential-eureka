/*
 * HV-248 — Theft said they raided your stash, then left the weather band.
 *
 * The Radio's card says a crackly weather band — see tomorrow's sky
 * coming. Theft says someone raided your stash in the night. A radio
 * sitting in camp is a supply thieves can carry. The raid took cans,
 * food, scraps and morale, and left the band humming.
 *
 * City Sweep leaving the weather band is not this card. Trust fading
 * Word is not this card. Stored rainfall is not this card. A Lookout
 * still names tomorrow's sky without a radio.
 *
 *  A. Source: the Radio still claims tomorrow's sky.
 *  B. Source: the theft effect takes the radio.
 *  C. A radio-only camp loses tomorrow's sky after the raid.
 *  D. A Lookout still sees the forecast once the band is gone.
 *  E. No radio: the raid still takes goods and does not invent a band.
 *  F. Biscuit's last line still names the chase.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent() on the production theft card.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const config = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const theftAt = loop.indexOf("id:'theft'");
const injuryAt = loop.indexOf("id:'injury'");
const theftBlock = theftAt >= 0 && injuryAt > theftAt ? loop.slice(theftAt, injuryAt) : '';
const radioRec = /id:'radio'[\s\S]{0,280}?desc:'([^']+)'/.exec(config);

ok(!!radioRec && /tomorrow/.test(radioRec[1]),
  'the Radio still claims tomorrow\'s sky');
ok(theftAt >= 0 && /raided your stash/.test(theftBlock),
  'the theft card still says they raided your stash');
ok(/structures\.radio\s*=\s*false/.test(theftBlock),
  'HV-248: the theft effect takes the weather band');
ok(!/homeless-village\/js\/ui\.js/.test(loop) && !/homeless-village\/js\/ui\.js/.test(config),
  'the raid lives on the theft card — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvband-init')) {
      sessionStorage.setItem('hvband-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const raid = await t(() => {
    const real = Math.random; Math.random = () => 0.5;
    G.structures.radio = true;
    G.workers.lookout = false;
    G.dog = 0;
    G.cans = 20; G.food = 20; G.scraps = 20; G.morale = 50;
    G.forecast = 'rain';
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(EVENTS_BAD.find(e => e.id === 'theft'), false);
    Math.random = real;
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    return {
      radio: !!G.structures.radio,
      sky: forecastVisible(),
      cans: G.cans,
      log: lines.join(' '),
      last: lines[lines.length - 1] || '',
    };
  });
  ok(!raid.radio && !raid.sky,
    `HV-248: a radio-only camp loses tomorrow's sky (radio=${raid.radio}, sky=${raid.sky})`);
  ok(raid.cans < 20, `the raid still takes goods (cans 20→${raid.cans})`);
  ok(/weather band/i.test(raid.log),
    `the log names the weather band (${raid.last.slice(-80)})`);

  const lookout = await t(() => {
    const real = Math.random; Math.random = () => 0.5;
    G.structures.radio = true;
    G.workers.lookout = true;
    G.dog = 0;
    G.forecast = 'cold';
    triggerEvent(EVENTS_BAD.find(e => e.id === 'theft'), false);
    Math.random = real;
    return { radio: !!G.structures.radio, sky: forecastVisible() };
  });
  ok(!lookout.radio && lookout.sky,
    `a Lookout still names tomorrow's sky without the band (radio=${lookout.radio}, sky=${lookout.sky})`);

  const none = await t(() => {
    const real = Math.random; Math.random = () => 0.5;
    G.structures.radio = false;
    G.workers.lookout = false;
    G.dog = 0;
    G.cans = 20;
    triggerEvent(EVENTS_BAD.find(e => e.id === 'theft'), false);
    Math.random = real;
    return { radio: !!G.structures.radio, cans: G.cans };
  });
  ok(!none.radio && none.cans < 20,
    `no radio: the raid still takes goods and does not invent a band (cans=${none.cans})`);

  const dog = await t(() => {
    const real = Math.random; Math.random = () => 0.5;
    G.dog = 2;
    G.structures.radio = true;
    G.workers.lookout = false;
    triggerEvent(EVENTS_BAD.find(e => e.id === 'theft'), false);
    Math.random = real;
    const last = Array.from(document.querySelectorAll('.log-line')).pop();
    return { last: last ? last.textContent : '', radio: !!G.structures.radio };
  });
  ok(/Biscuit chased/.test(dog.last) && /weather band/i.test(dog.last) && !dog.radio,
    `Biscuit's last line still names the chase and the band (${dog.last.slice(-90)})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
