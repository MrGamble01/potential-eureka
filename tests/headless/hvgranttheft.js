/*
 * HV-283 — Community Grant said civic infrastructure no thief
 * can carry off, then the same day's Theft raided the delivery
 * as ordinary supplies.
 *
 * HV-15: petitions are civic. Sweeps cannot tear them down;
 * thieves cannot carry them off. HV-225 / #891 stamped grantDay
 * so today's City Sweep cannot confiscate the +8 food and +8
 * scraps. The comment left Theft as another card. The raid
 * still took a cut of the pot the same day the city delivered.
 *
 * HV-225's same-day sweep is not this card. Tomorrow's raid
 * is not this card. Church extras, coats, the radio, and the
 * dumped rainfall are not this card. Word fade is not this card.
 *
 *  A. Source: doPetition still stamps grantDay and still names
 *     a thief who cannot carry the delivery off.
 *  B. Source: theft still raids food and scraps. The civic
 *     latch is missing on that raid — the assignment.
 *  C. A same-day raid leaves the delivery in the pot.
 *  D. Ordinary supplies the same day still leave.
 *  E. Tomorrow's raid can take yesterday's delivery.
 *  F. Same-day sweep still protects (HV-225).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives doPetition / the production theft effect.
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
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const petAt = player.indexOf('function doPetition(id){');
const petBlock = petAt >= 0 ? player.slice(petAt, petAt + 1400) : '';
const theft = /id:'theft'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(loop);
const theftBlock = theft ? theft[1] : '';
const applyAt = Math.min(
  ...['G.food', 'G.scraps'].map(k => {
    const i = theftBlock.indexOf(k + '=Math.max');
    return i < 0 ? Infinity : i;
  })
);
const sweepAt = loop.indexOf("id:'sweep'");
const coldAt = loop.indexOf("id:'cold_snap'");
const sweepBlock = sweepAt >= 0 && coldAt > sweepAt ? loop.slice(sweepAt, coldAt) : '';

ok(petAt >= 0 && /id==='grant'/.test(petBlock) && /G\.grantDay\s*=\s*G\.days/.test(petBlock),
  'doPetition still delivers the community grant and stamps grantDay');
ok(/thief can carry/.test(player) && /no thief can carry/.test(config),
  'HV-15 still says a thief cannot carry civic infrastructure off');
ok(theftBlock && /G\.food/.test(theftBlock) && /G\.scraps/.test(theftBlock),
  'Theft still raids food and scraps');
ok(/grantDay/.test(theftBlock) && /cannot carry off the delivery/.test(theftBlock)
    && theftBlock.indexOf('grantDay') < applyAt,
  'HV-283: theft protects the civic delivery before it subtracts the pot');
ok(/grantDay/.test(sweepBlock) && /cannot confiscate the delivery/.test(sweepBlock),
  'HV-225: the same-day sweep still protects the delivery');
ok(!/homeless-village\/js\/ui\.js/.test(player) && !/homeless-village\/js\/ui\.js/.test(loop)
    && !/grantDay/.test(ui) && !/cannot carry off the delivery/.test(ui),
  'the civic latch lives on the theft effect — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvgranttheft-init')) {
      sessionStorage.setItem('hvgranttheft-init', '1');
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
    G.weather = 'clear';
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
    G.food = 8; G.wood = 8; G.scraps = 8; G.cans = 8;
    G.grantDay = G.days;
    return (function(){
      G.dog = 0; G.dogHungry = false;
      G.garageCover = false;
      G.structures.stash = false;
      G.structures.coats = false;
      G.structures.radio = false;
      G.barrelWater = 0;
      if (G.petitions) G.petitions.streetlight = false;
      G.morale = 80; G.rep = 20;
      const ev = EVENTS_BAD.find(e => e.id === 'theft');
      const real = Math.random; Math.random = () => 0.5;
      ev.effect();
      Math.random = real;
      const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
      return { food: G.food, wood: G.wood, scraps: G.scraps, cans: G.cans, log };
    })();
  });
  ok(sameDay.food === 8 && sameDay.scraps === 8 && sameDay.wood === 8,
    `HV-283: same-day theft leaves the civic delivery in the pot (food ${sameDay.food}, scraps ${sameDay.scraps})`);
  ok(/cannot carry off the delivery/.test(sameDay.log),
    'the raid names the civic delivery it could not carry off');
  ok(sameDay.cans < 8,
    `cans are not the grant — the raid still takes them (cans ${sameDay.cans})`);

  const ordinary = await t(() => {
    G.food = 8; G.wood = 8; G.scraps = 8; G.cans = 8;
    G.grantDay = -1;
    G.dog = 0; G.dogHungry = false;
    G.garageCover = false;
    G.structures.stash = false;
    G.structures.coats = false;
    G.structures.radio = false;
    G.barrelWater = 0;
    if (G.petitions) G.petitions.streetlight = false;
    G.morale = 80; G.rep = 20;
    const ev = EVENTS_BAD.find(e => e.id === 'theft');
    const real = Math.random; Math.random = () => 0.5;
    ev.effect();
    Math.random = real;
    return { food: G.food, scraps: G.scraps, wood: G.wood, cans: G.cans };
  });
  ok(ordinary.food < 8 && ordinary.scraps < 8 && ordinary.wood === 8,
    `ordinary supplies the same day still leave (food ${ordinary.food}, scraps ${ordinary.scraps})`);

  const extra = await t(() => {
    G.food = 16; G.wood = 8; G.scraps = 16; G.cans = 8;
    G.grantDay = G.days;
    G.dog = 0; G.dogHungry = false;
    G.garageCover = false;
    G.structures.stash = false;
    G.structures.coats = false;
    G.structures.radio = false;
    G.barrelWater = 0;
    if (G.petitions) G.petitions.streetlight = false;
    G.morale = 80; G.rep = 20;
    const ev = EVENTS_BAD.find(e => e.id === 'theft');
    const real = Math.random; Math.random = () => 0.5;
    ev.effect();
    Math.random = real;
    return { food: G.food, scraps: G.scraps };
  });
  ok(extra.food < 16 && extra.food >= 8 && extra.scraps < 16 && extra.scraps >= 8,
    `ordinary extras the same day still leave; the eight stay (food ${extra.food}, scraps ${extra.scraps})`);

  const tomorrow = await t(() => {
    G.food = 8; G.wood = 8; G.scraps = 8; G.cans = 8;
    G.grantDay = G.days;
    G.days = G.days + 1;
    G.dog = 0; G.dogHungry = false;
    G.garageCover = false;
    G.structures.stash = false;
    G.structures.coats = false;
    G.structures.radio = false;
    G.barrelWater = 0;
    if (G.petitions) G.petitions.streetlight = false;
    G.morale = 80; G.rep = 20;
    const ev = EVENTS_BAD.find(e => e.id === 'theft');
    const real = Math.random; Math.random = () => 0.5;
    ev.effect();
    Math.random = real;
    return { food: G.food, scraps: G.scraps };
  });
  ok(tomorrow.food < 8 && tomorrow.scraps < 8,
    `tomorrow's raid can take yesterday's delivery (food ${tomorrow.food}, scraps ${tomorrow.scraps})`);

  const sweep = await t(() => {
    G.food = 8; G.wood = 8; G.scraps = 8;
    G.grantDay = G.days;
    G.garageCover = false;
    G.packedUp = false;
    G.structures.stash = false;
    G.structures.tent = false;
    G.structures.garden = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.structures.pantry = false;
    G.structures.coats = false;
    G.structures.guitar = false;
    G.structures.toolbox = false;
    G.mural = 0;
    G.morale = 80;
    const ev = EVENTS_BAD.find(e => e.id === 'sweep');
    const real = Math.random; Math.random = () => 0.5;
    ev.effect();
    Math.random = real;
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return { food: G.food, scraps: G.scraps, wood: G.wood, log };
  });
  ok(sweep.food === 8 && sweep.scraps === 8 && sweep.wood === 8,
    `HV-225: same-day sweep still leaves the delivery (food ${sweep.food})`);
  ok(/cannot confiscate the delivery/.test(sweep.log),
    'the sweep still names the civic delivery it could not take');

  await page.screenshot({ path: '/opt/cursor/artifacts/hv283_grant_theft.png' });

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
