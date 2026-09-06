/*
 * HV-166 — City Sweep said confiscate supplies, then left the wood.
 *
 * The card body is "Police are clearing the camp. They destroy shelters
 * and confiscate supplies." The effect demolishes tents / kitchens /
 * workbenches / the garden and takes scraps and food. Wood is the
 * firewood pile — Firewood, the Workbench, the Tent, the Soup Kitchen
 * all spend it — and the sweep never touched the stack. Cans and
 * cardboard are different tickets. Theft taking wood is a different
 * event.
 *
 *  A. Source: the sweep effect assigns G.wood; ui.js is untouched.
 *  B. The card still promises they confiscate supplies.
 *  C. A pinned sweep with 20 wood takes some of it.
 *  D. Scraps and food still go. Cans still sit (not this ticket).
 *  E. Theft still leaves the wood (control — different event).
 *  F. Church Donated Supplies still leaves the wood.
 *  G. Marisol's garage still zeroes the wood take.
 *  H. The tent still falls.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent() on the production sweep.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const block = /id:'sweep'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(src);
ok(!!block, 'sweep event is still in gameloop.js');
ok(block && /G\.wood\s*=\s*Math\.max\s*\(\s*0\s*,\s*G\.wood/.test(block[1]),
  'HV-166: sweep effect confiscates wood');
ok(/confiscate supplies/.test(src),
  'the card still promises they confiscate supplies');
ok(!/G\.wood\s*=/.test(ui),
  'ui.js untouched — the take lives on the sweep effect');

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
    if (!sessionStorage.getItem('hvsweepwood-init')) {
      sessionStorage.setItem('hvsweepwood-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const pinSweep = (extra) => page.evaluate((extra) => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    G.packedUp = false;
    G.garageCover = false;
    G.structures.tent = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.structures.garden = false;
    G.structures.stash = false;
    G.scraps = 20; G.food = 20; G.cans = 20; G.wood = 20; G.cardboard = 20;
    G.morale = 50;
    Object.assign(G, extra || {});
    const ev = EVENTS_BAD.find(e => e.id === 'sweep');
    triggerEvent(ev, false);
    Math.random = real;
    return {
      scraps: G.scraps,
      food: G.food,
      cans: G.cans,
      wood: G.wood,
      cardboard: G.cardboard,
      tent: !!G.structures.tent,
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  }, extra);

  const sweep = await pinSweep();
  ok(sweep.banner === 'City Sweep',
    `the card still titles itself City Sweep (${sweep.banner})`);
  ok(/confiscate supplies/i.test(sweep.body),
    'the body still names confiscated supplies');
  ok(sweep.wood < 20,
    `HV-166: a pinned sweep takes some of the woodpile (20 → ${sweep.wood})`);
  ok(sweep.wood === 10,
    `HV-166: the 0.5 roll takes half the wood like scraps (20 → ${sweep.wood})`);
  ok(sweep.scraps < 20 && sweep.food < 20,
    `scraps and food still go (${sweep.scraps}/${sweep.food})`);
  ok(sweep.cans === 20,
    `cans still sit — not this ticket (${sweep.cans})`);
  ok(/woodpile/i.test(sweep.log),
    `the log names the woodpile (${sweep.log.slice(-80)})`);

  const theft = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.wood = 20; G.cardboard = 20; G.cans = 20; G.food = 20; G.scraps = 20;
    G.dog = 0; G.structures.stash = false;
    if (G.petitions) G.petitions.streetlight = false;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(EVENTS_BAD.find(e => e.id === 'theft'), false);
    Math.random = real;
    return { wood: G.wood, cardboard: G.cardboard };
  });
  ok(theft.wood === 20,
    `Theft still leaves the wood — different event (${theft.wood})`);

  const church = await page.evaluate(() => {
    G.wood = 20;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(EVENTS_GOOD.find(e => e.id === 'church_donation'), true);
    return G.wood;
  });
  ok(church === 20,
    `Church Donated Supplies still leaves the wood (${church})`);

  const garage = await pinSweep({ garageCover: true, wood: 20, scraps: 20, food: 20 });
  ok(garage.wood === 20,
    `Marisol's garage still zeroes the wood take (${garage.wood})`);

  const tentFell = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    G.packedUp = false;
    G.garageCover = false;
    G.structures.tent = true;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.structures.garden = false;
    G.structures.stash = false;
    triggerEvent(EVENTS_BAD.find(e => e.id === 'sweep'), false);
    Math.random = real;
    return !G.structures.tent;
  });
  ok(tentFell, 'the tent still falls');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
