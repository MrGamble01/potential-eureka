/*
 * HV-176 — the Radio said see tomorrow's sky, then the sweep left
 * the weather band standing.
 *
 * The Radio's card is "A crackly weather band — see tomorrow's sky
 * coming." City Sweep says they destroy shelters and confiscate
 * supplies. The radio sits in camp, the one way a camp without a
 * Lookout reads tomorrow. The sweep takes tents, the kitchen, the
 * bench, the garden. The weather band never moves. Tomorrow's sky
 * stays on the badge after the trucks leave.
 *
 *  A. Source: the sweep effect assigns G.structures.radio false;
 *     ui.js is untouched.
 *  B. The radio still promises tomorrow's sky. The sweep still
 *     promises confiscation.
 *  C. A pinned sweep with a live radio takes it. The forecast
 *     arrow leaves the badge.
 *  D. Tent still falls. Garden still falls. The buried stash
 *     still hides.
 *  E. A Lookout camp still sees tomorrow after the radio is gone.
 *  F. Theft still leaves the radio (control — different event).
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
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const block = /id:'sweep'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(src);
ok(!!block, 'city sweep is still in gameloop.js');
ok(block && /G\.structures\.radio\s*=\s*false/.test(block[1]),
  'HV-176: sweep effect confiscates the radio');
ok(/see tomorrow/.test(cfg) && /id:'radio'/.test(cfg),
  'the radio still promises tomorrow’s sky');
ok(/destroy shelters and confiscate supplies/.test(src),
  'the sweep still promises confiscation');
ok(!/G\.structures\.radio\s*=\s*false/.test(ui),
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
    if (!sessionStorage.getItem('hvradiosweep-init')) {
      sessionStorage.setItem('hvradiosweep-init', '1');
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
    G.workers.lookout = false;
    G.structures.radio = true;
    G.structures.tent = false;
    G.structures.garden = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.structures.stash = false;
    G.garageCover = false;
    G.packedUp = false;
    G.forecast = 'rain';
    G.food = 20; G.scraps = 20; G.morale = 50;
    Object.assign(G, extra || {});
    updateHUD();
    const before = {
      radio: !!G.structures.radio,
      badge: document.getElementById('season-badge').textContent,
      visible: forecastVisible(),
    };
    const ev = EVENTS_BAD.find(e => e.id === 'sweep');
    triggerEvent(ev, false);
    Math.random = real;
    return {
      before,
      radio: !!G.structures.radio,
      tent: !!G.structures.tent,
      garden: !!G.structures.garden,
      stash: !!G.structures.stash,
      lookout: !!G.workers.lookout,
      badge: document.getElementById('season-badge').textContent,
      visible: forecastVisible(),
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  }, extra);

  const live = await pinSweep({});
  ok(live.banner === 'City Sweep', `the card is still City Sweep (${live.banner})`);
  ok(/confiscate supplies/i.test(live.body), 'the body still confiscates supplies');
  ok(live.before.radio && live.before.visible && /→/.test(live.before.badge),
    `a live radio showed tomorrow before the trucks (${live.before.badge})`);
  ok(!live.radio,
    `HV-176: the sweep takes the radio (radio ${live.radio})`);
  ok(!live.visible && !/→/.test(live.badge),
    `tomorrow’s sky leaves the badge (${live.badge})`);
  ok(/radio|weather band/i.test(live.log),
    `the log names the confiscated radio (${live.log.slice(-80)})`);

  const tents = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    G.workers.lookout = false;
    G.structures.radio = true;
    G.structures.tent = true;
    G.structures.garden = true;
    G.structures.stash = true;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.garageCover = false;
    G.packedUp = false;
    G.food = 20; G.scraps = 20; G.morale = 50;
    triggerEvent(EVENTS_BAD.find(e => e.id === 'sweep'), false);
    Math.random = real;
    return {
      tent: !!G.structures.tent,
      garden: !!G.structures.garden,
      stash: !!G.structures.stash,
      radio: !!G.structures.radio,
    };
  });
  ok(!tents.tent && !tents.garden,
    `tent and garden still fall (${tents.tent}/${tents.garden})`);
  ok(tents.stash, 'the buried stash still hides');
  ok(!tents.radio, 'the radio still goes with the tents');

  const lookout = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    G.workers.lookout = true;
    G.structures.radio = true;
    G.structures.tent = false;
    G.structures.garden = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.garageCover = false;
    G.packedUp = false;
    G.forecast = 'cold';
    updateHUD();
    triggerEvent(EVENTS_BAD.find(e => e.id === 'sweep'), false);
    Math.random = real;
    return {
      radio: !!G.structures.radio,
      lookout: !!G.workers.lookout,
      visible: forecastVisible(),
      badge: document.getElementById('season-badge').textContent,
    };
  });
  ok(!lookout.radio && lookout.lookout && lookout.visible && /→/.test(lookout.badge),
    `a Lookout camp still sees tomorrow after the radio is gone (${lookout.badge})`);

  const theft = await page.evaluate(() => {
    const real = Math.random;
    Math.random = () => 0.5;
    G.structures.radio = true;
    G.workers.lookout = false;
    G.cans = 20; G.food = 20; G.scraps = 20; G.morale = 50;
    G.dog = 0; G.petitions = {};
    triggerEvent(EVENTS_BAD.find(e => e.id === 'theft'), false);
    Math.random = real;
    return { radio: !!G.structures.radio };
  });
  ok(theft.radio, 'theft still leaves the radio (control — different event)');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
