/*
 * HV-225 — Community Grant said civic infrastructure no sweep
 * can take, then the same day's City Sweep confiscated the
 * delivery as ordinary supplies.
 *
 * HV-15: petitions are civic. Sweeps cannot tear them down;
 * thieves cannot carry them off. Sanitation and the street
 * light are flags, so the rule held. The grant *is* the
 * delivery — +8 food, +8 wood, +8 scraps on the spot. Those
 * eight sit in the pot as ordinary supplies. The next City
 * Sweep confiscates a cut of them the same day the city
 * "delivered" them.
 *
 * Church extras, Found $5, and Theft are not this card.
 * Tomorrow's sweep is not this card. Garage cover is not
 * this card.
 *
 *  A. Source: doPetition stamps grantDay; sweep protects the
 *     delivery before it subtracts food and scraps.
 *  B. The petition still names +8 food, +8 wood, +8 scraps.
 *  C. A same-day sweep leaves the delivery in the pot.
 *  D. Ordinary supplies the same day still get confiscated.
 *  E. Tomorrow's sweep can take yesterday's delivery.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives doPetition / the production sweep effect.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const config = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');

const petAt = player.indexOf('function doPetition(id){');
const petBlock = petAt >= 0 ? player.slice(petAt, petAt + 900) : '';
const sweepAt = loop.indexOf("id:'sweep'");
const nextBad = loop.indexOf("id:'cold_snap'");
const sweepBlock = sweepAt >= 0 && nextBad > sweepAt ? loop.slice(sweepAt, nextBad) : '';
const applyAt = sweepBlock.indexOf('G.food');

ok(petAt >= 0 && /id==='grant'/.test(petBlock),
  'doPetition still delivers the community grant');
ok(/G\.grantDay\s*=\s*G\.days/.test(petBlock),
  'HV-225: doPetition stamps grantDay the day the delivery lands');
ok(sweepAt >= 0 && applyAt > 0, 'City Sweep still confiscates food and scraps');
ok(/grantDay/.test(sweepBlock) && /cannot confiscate the delivery/.test(sweepBlock)
    && sweepBlock.indexOf('grantDay') < applyAt,
  'HV-225: the sweep protects the civic delivery before it subtracts the pot');
ok(/id:'grant'/.test(config) && /\+8 food, \+8 wood, \+8 scraps/.test(config),
  'the petition still names +8 food, +8 wood, +8 scraps delivered');
ok(!/homeless-village\/js\/ui\.js/.test(player) && !/homeless-village\/js\/ui\.js/.test(loop),
  'the civic latch lives in doPetition / the sweep — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvgrant-init')) {
      sessionStorage.setItem('hvgrant-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const delivered = await t(() => {
    G.rep = 50;
    G.goodwill = 30;
    G.food = 0; G.wood = 0; G.scraps = 0;
    G.petitions = {};
    doPetition('grant');
    return {
      food: G.food, wood: G.wood, scraps: G.scraps,
      day: G.grantDay, days: G.days, won: !!G.petitions.grant,
    };
  });
  ok(delivered.won && delivered.food === 8 && delivered.wood === 8 && delivered.scraps === 8,
    `the grant still delivers +8 food / wood / scraps (food ${delivered.food})`);
  ok(delivered.day === delivered.days,
    `grantDay is stamped the day the city delivered (${delivered.day})`);

  const sameDay = await t(() => {
    G.food = 8; G.wood = 8; G.scraps = 8;
    G.grantDay = G.days;
    G.garageCover = false;
    G.packedUp = false;
    G.structures.stash = false;
    G.structures.tent = false;
    G.structures.garden = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.mural = 0;
    G.morale = 80;
    const ev = EVENTS_BAD.find(e => e.id === 'sweep');
    const real = Math.random; Math.random = () => 0.5;
    ev.effect();
    Math.random = real;
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return { food: G.food, wood: G.wood, scraps: G.scraps, log };
  });
  ok(sameDay.food === 8 && sameDay.scraps === 8 && sameDay.wood === 8,
    `same-day sweep leaves the civic delivery in the pot (food ${sameDay.food}, scraps ${sameDay.scraps})`);
  ok(/cannot confiscate the delivery/.test(sameDay.log),
    'the sweep names the civic delivery it could not take');

  const ordinary = await t(() => {
    G.food = 8; G.wood = 8; G.scraps = 8;
    G.grantDay = -1;
    G.garageCover = false;
    G.packedUp = false;
    G.structures.stash = false;
    G.structures.tent = false;
    G.structures.garden = false;
    G.morale = 80;
    const ev = EVENTS_BAD.find(e => e.id === 'sweep');
    const real = Math.random; Math.random = () => 0.5;
    ev.effect();
    Math.random = real;
    return { food: G.food, scraps: G.scraps, wood: G.wood };
  });
  ok(ordinary.food < 8 && ordinary.scraps < 8 && ordinary.wood === 8,
    `ordinary supplies the same day still get confiscated (food ${ordinary.food}, scraps ${ordinary.scraps})`);

  const tomorrow = await t(() => {
    G.food = 8; G.wood = 8; G.scraps = 8;
    G.grantDay = G.days;
    G.days = G.days + 1;
    G.garageCover = false;
    G.packedUp = false;
    G.structures.stash = false;
    G.structures.tent = false;
    G.structures.garden = false;
    G.morale = 80;
    const ev = EVENTS_BAD.find(e => e.id === 'sweep');
    const real = Math.random; Math.random = () => 0.5;
    ev.effect();
    Math.random = real;
    return { food: G.food, scraps: G.scraps };
  });
  ok(tomorrow.food < 8 && tomorrow.scraps < 8,
    `tomorrow's sweep can take yesterday's delivery (food ${tomorrow.food}, scraps ${tomorrow.scraps})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
