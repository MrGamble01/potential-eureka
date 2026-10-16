/*
 * HV-262 — Around the fire, one of the residents talks about a
 * sister two towns over, then a rainy dawn still opened the ask.
 *
 * The ask is a talk around the fire. Rain already keeps people
 * off the sidewalk. The post never read the sky.
 *
 * An ask already standing still holds through rain. A clear
 * respected dawn still opens one. A letter from the city is
 * not this card — it can still arrive on a wet morning. A
 * named snap is not this card. ui.js is not this ticket.
 *
 *  A. Source: ticketAtDawn skips the fire talk in the rain.
 *  B. A rainy eligible dawn leaves no ask and names the rain.
 *  C. A clear eligible dawn still opens one.
 *  D. An ask already standing still holds through rain.
 *  E. A letter from the city can still arrive on a wet dawn.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production ticketAtDawn.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const at = loop.indexOf('function ticketAtDawn()');
const end = loop.indexOf('function pantryAtDawn()');
const body = at >= 0 && end > at ? loop.slice(at, end) : '';

ok(/Around the fire/.test(loop) && /sister two towns over/.test(loop),
  'the ask still says someone talks around the fire about a sister');
ok(/weather==='rain'/.test(body) && /kept the circle off the fire/.test(body),
  'HV-262: ticketAtDawn keeps the fire circle quiet in the rain');
ok(!/snapActive/.test(body),
  'a named snap is not this card');
ok(/letter from the city/.test(body),
  'a letter from the city is not this card — the path still lives here');
ok(!/homeless-village\/js\/ui\.js/.test(loop),
  'the cut lives on the dawn ask — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvtalk-init')) {
      sessionStorage.setItem('hvtalk-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const dry = await t(() => {
    G.days = 20;
    G.ticketLastDay = -9;
    G.ticketAsk = null;
    G.rep = 60;
    G.population = 3;
    G.weather = 'clear';
    G.snapUntil = null;
    G.ticketsSent = 0;
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    ticketAtDawn();
    window.log = prev;
    return { ask: !!G.ticketAsk, last: captured[captured.length - 1] || '', lastDay: G.ticketLastDay };
  });
  ok(dry.ask && dry.lastDay === 20,
    `a clear eligible dawn still opens one (ask=${dry.ask})`);
  ok(/Around the fire/.test(dry.last),
    `the dry log still names the fire (${dry.last})`);

  const wet = await t(() => {
    G.days = 30;
    G.ticketLastDay = -9;
    G.ticketAsk = null;
    G.rep = 60;
    G.population = 3;
    G.weather = 'rain';
    G.snapUntil = null;
    G.ticketsSent = 0;
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    ticketAtDawn();
    window.log = prev;
    return { ask: !!G.ticketAsk, last: captured[captured.length - 1] || '', lastDay: G.ticketLastDay };
  });
  ok(!wet.ask && wet.lastDay === -9,
    `HV-262: a rainy eligible dawn leaves no ask (ask=${wet.ask}, lastDay=${wet.lastDay})`);
  ok(/kept the circle off the fire/.test(wet.last),
    `the last line names the rain (${wet.last})`);

  const held = await t(() => {
    G.days = 31;
    G.ticketAsk = { day: 30 };
    G.ticketLastDay = 30;
    G.weather = 'rain';
    ticketAtDawn();
    return { ask: !!G.ticketAsk, day: G.ticketAsk && G.ticketAsk.day };
  });
  ok(held.ask && held.day === 30,
    `an ask already standing still holds through rain (day=${held.day})`);

  const letter = await t(() => {
    G.days = 40;
    G.ticketAsk = null;
    G.ticketLastDay = -9;
    G.rep = 60;
    G.population = 3;
    G.weather = 'rain';
    G.ticketsSent = 1;
    G.lastLetterDay = 30;
    G.food = 10;
    G.morale = 50;
    const real = Math.random; Math.random = () => 0;
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    ticketAtDawn();
    window.log = prev;
    Math.random = real;
    return {
      ask: !!G.ticketAsk,
      lastDay: G.ticketLastDay,
      food: G.food,
      letterDay: G.lastLetterDay,
      last: captured[captured.length - 1] || '',
    };
  });
  ok(!letter.ask && letter.lastDay === -9 && letter.food === 12 && letter.letterDay === 40,
    `a letter can still arrive on a wet dawn (ask=${letter.ask}, food=${letter.food})`);
  ok(/letter from the city/.test(letter.last),
    `the letter line still names the city (${letter.last})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
