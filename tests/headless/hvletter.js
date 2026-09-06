/* HV-96 — a letter from the city tucked a little something inside,
 * and the +2 morale never made the log.
 *
 * After someone goes home, ticketAtDawn sends a letter every
 * LETTER_EVERY dawns: +2 food / scraps / cans, and G.morale += 2.
 * The log names the tucked-in goods. It never names the morale.
 * Soup night names both. A cold snap breaking names +4 morale.
 * This letter names the emoji and walks away.
 *
 * Not HV-17 (the bus-ticket arc itself — hvticket E already proves
 * the numbers). Not HV-86 (Kind Stranger is an event card). This is
 * the dawn letter after a send: a friend in the city, a half-written
 * line.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: the letter still grants +2 morale; the letter log names
 *    +2 morale next to the goods. ui.js is not touched.
 * B. A pinned food letter pays +2 food and +2 morale, and the log
 *    names both. A quiet next dawn brings nothing.
 * C. Isolation: a scraps letter and a cans letter also name +2 morale.
 *    Kind Stranger is not this ticket.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const cfg  = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const fnAt = loop.indexOf('function ticketAtDawn(){');
const pantryAt = loop.indexOf('function pantryAtDawn(){');
const ticket = fnAt >= 0 && pantryAt > fnAt ? loop.slice(fnAt, pantryAt) : '';
const tucked = /Tucked inside, a little something:[\s\S]*?\);/.exec(ticket);

ok(fnAt >= 0 && /ticketsSent/.test(ticket) && /lastLetterDay/.test(ticket),
  'the city letter still lives in ticketAtDawn');
ok(/LETTER_EVERY\s*=\s*6/.test(cfg),
  'letters still come every 6 days after a send');
ok(/G\.morale\s*=\s*Math\.min\(100,\s*G\.morale\+2\)/.test(ticket),
  'the letter still lifts morale by 2 — that is the half that went missing');
ok(tucked && /\+2 morale/.test(tucked[0]),
  'HV-96: the city letter names +2 morale next to the tucked-in goods');
ok(!/lastLetterDay/.test(ui) && !/A letter from the city/.test(ui),
  'ui.js is not this ticket — it still only draws the ticket button');

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
    try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {}
    try { localStorage.removeItem('homeless_village_v1'); } catch (e) {}
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => ({
    intro: !!(document.getElementById('intro-modal') && document.getElementById('intro-modal').classList.contains('open')),
    every: typeof LETTER_EVERY === 'number' ? LETTER_EVERY : 0,
  }));
  ok(!boot.intro && boot.every === 6,
    'a returning camp can receive a letter — not behind the crash course');

  // B. A pinned food letter. Park the ask so ticketAtDawn only writes mail.
  const food = await page.evaluate(() => {
    G.ticketsSent = 1;
    G.lastLetterDay = G.days - LETTER_EVERY;
    G.ticketAsk = null;
    G.ticketLastDay = G.days;
    G.population = 1;
    G.rep = 0;
    G.food = 10; G.scraps = 10; G.cans = 10; G.morale = 50;
    const heard = [];
    const prev = log;
    log = function (msg) { heard.push(String(msg)); prev(msg); };
    const real = Math.random;
    Math.random = () => 0;          // rand(0,2) → 0 → food
    ticketAtDawn();
    Math.random = real;
    log = prev;
    return {
      food: G.food, scraps: G.scraps, cans: G.cans, morale: G.morale,
      day: G.lastLetterDay, ask: !!G.ticketAsk,
      log: heard.join(' '),
    };
  });
  ok(food.food === 12 && food.scraps === 10 && food.cans === 10 && food.morale === 52,
    `a food letter still pays +2 food and +2 morale (${food.food}/${food.morale})`);
  ok(/letter from the city/i.test(food.log) && /🍞/.test(food.log),
    'the log still names the city letter and the tucked-in food');
  ok(/\+2 morale/.test(food.log),
    'HV-96: the food-letter log names +2 morale');
  ok(!food.ask, 'the letter does not reopen a bus-ticket ask');

  const quiet = await page.evaluate(() => {
    const before = { food: G.food, morale: G.morale, day: G.lastLetterDay };
    const heard = [];
    const prev = log;
    log = function (msg) { heard.push(String(msg)); prev(msg); };
    ticketAtDawn();
    log = prev;
    return {
      food: G.food, morale: G.morale, day: G.lastLetterDay,
      lettered: heard.some(l => /letter from the city/i.test(l)),
      before,
    };
  });
  ok(quiet.food === quiet.before.food && quiet.morale === quiet.before.morale
    && quiet.day === quiet.before.day && !quiet.lettered,
    'a quiet next dawn brings nothing');

  // C. Scraps and cans letters also name the morale. Kind Stranger is not us.
  const scraps = await page.evaluate(() => {
    G.lastLetterDay = G.days - LETTER_EVERY;
    G.food = 10; G.scraps = 10; G.cans = 10; G.morale = 50;
    const heard = [];
    const prev = log;
    log = function (msg) { heard.push(String(msg)); prev(msg); };
    const real = Math.random;
    Math.random = () => 0.5;        // rand(0,2) → 1 → scraps
    ticketAtDawn();
    Math.random = real;
    log = prev;
    return { scraps: G.scraps, food: G.food, cans: G.cans, morale: G.morale, log: heard.join(' ') };
  });
  ok(scraps.scraps === 12 && scraps.food === 10 && scraps.cans === 10 && scraps.morale === 52,
    `a scraps letter still pays +2 scraps and +2 morale (${scraps.scraps}/${scraps.morale})`);
  ok(/🧱/.test(scraps.log) && /\+2 morale/.test(scraps.log),
    'HV-96: the scraps-letter log names +2 morale');

  const cans = await page.evaluate(() => {
    G.lastLetterDay = G.days - LETTER_EVERY;
    G.food = 10; G.scraps = 10; G.cans = 10; G.morale = 50;
    const heard = [];
    const prev = log;
    log = function (msg) { heard.push(String(msg)); prev(msg); };
    const real = Math.random;
    Math.random = () => 0.9;        // rand(0,2) → 2 → cans
    ticketAtDawn();
    Math.random = real;
    log = prev;
    return { cans: G.cans, food: G.food, scraps: G.scraps, morale: G.morale, log: heard.join(' ') };
  });
  ok(cans.cans === 12 && cans.food === 10 && cans.scraps === 10 && cans.morale === 52,
    `a cans letter still pays +2 cans and +2 morale (${cans.cans}/${cans.morale})`);
  ok(/🫙/.test(cans.log) && /\+2 morale/.test(cans.log),
    'HV-96: the cans-letter log names +2 morale');

  const stranger = await page.evaluate(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
    return !!(ev && /bag of food/.test(ev.desc));
  });
  ok(stranger, 'Kind Stranger is still the bag-of-food card — not this ticket');

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
