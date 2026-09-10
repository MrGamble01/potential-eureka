/*
 * HV-269 — Forage Area said cardboard and wood, then a
 * scorcher still paid a cool-day haul.
 *
 * Forage is a walk through the surroundings for cardboard
 * and wood. A heat wave already names a scorcher. Dumpsters
 * feel the sky; the woods never read G.weather, so a scorcher
 * still paid rand(1,4) wood and rand(2,6) cardboard.
 *
 * A clear day still pays. Rain still pays — a wet woods is
 * not this card. The dumpsters are not this card. ui.js is
 * not this ticket.
 *
 *  A. Source: Forage Area still names the surroundings;
 *     heat still names a scorcher; start / finish now read heat.
 *  B. A clear day still pays wood and cardboard.
 *  C. A scorcher refuses before the timer and does not pay.
 *  D. A rainy day still pays — a wet woods is not this card.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production doAction / finishAction.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');

const actAt = cfg.indexOf("id:'forage'");
const tip = actAt >= 0 ? cfg.slice(actAt, actAt + 220) : '';
const doAt = player.indexOf('function doAction');
const doBody = doAt >= 0 ? player.slice(doAt, player.indexOf('function finishAction')) : '';
const finAt = player.indexOf("} else if(a.id==='forage')");
const finEnd = player.indexOf("} else if(a.id==='panhandle')");
const fin = finAt >= 0 && finEnd > finAt ? player.slice(finAt, finEnd) : '';

ok(/surroundings/.test(tip) && /cardboard/.test(tip),
  'Forage Area still names the surroundings for cardboard and wood');
ok(/A scorcher/.test(loop),
  'a heat-wave dawn still names a scorcher');
ok(/a\.id==='forage'/.test(doBody) && /weather\s*===\s*['"]heat['"]/.test(doBody)
  && /too hot to search/.test(doBody),
  'HV-269: doAction reads a scorcher before it starts a search');
ok(/weather\s*===\s*['"]heat['"]/.test(fin) && /The woods wait/.test(fin),
  'HV-269: finishAction reads a scorcher before it pays a haul');
ok(!/scavenge/.test(fin) && !/dumpster/.test(fin),
  'the dumpsters are not this card');
ok(!/homeless-village\/js\/ui\.js/.test(player),
  'the cut lives on Forage Area — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvhotwoods-init')) {
      sessionStorage.setItem('hvhotwoods-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  const forage = () => ({ id: 'forage', time: 4000, cooldown: 12000 });

  const clear = await t((a) => {
    G.days = 2; G.goalIndex = GOALS.length;
    G.dog = 1; G.dogMetDay = 99;
    G.wood = 0; G.cardboard = 0;
    G.dumpsterLockDay = -1;
    delete activeJobs.forage; G.cooldowns = {};
    G.weather = 'clear';
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    finishAction(a);
    window.log = prev;
    return {
      wood: G.wood, card: G.cardboard,
      last: captured[captured.length - 1] || '',
    };
  }, forage());
  ok(clear.wood >= 1 && clear.wood <= 4 && clear.card >= 2 && clear.card <= 6,
    `a clear day still pays wood and cardboard (wood=${clear.wood}, card=${clear.card})`);
  ok(/Found/.test(clear.last) && /wood/.test(clear.last),
    `the clear log still narrates the haul (${clear.last})`);

  const heat = await t((a) => {
    G.days = 2; G.goalIndex = GOALS.length;
    G.dog = 1; G.dogMetDay = 99;
    G.wood = 0; G.cardboard = 0;
    G.dumpsterLockDay = -1;
    delete activeJobs.forage; G.cooldowns = {};
    G.weather = 'heat';
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    doAction(a);
    const started = !!activeJobs.forage;
    delete activeJobs.forage;
    finishAction(a);
    window.log = prev;
    return {
      started,
      wood: G.wood, card: G.cardboard,
      last: captured[captured.length - 1] || '',
      all: captured.join(' | '),
    };
  }, forage());
  ok(!heat.started,
    `HV-269: a scorcher refuses the search before the timer (started=${heat.started})`);
  ok(heat.wood === 0 && heat.card === 0,
    `HV-269: the scorcher does not pay a cool-day haul (wood=${heat.wood}, card=${heat.card})`);
  ok(/too hot to search/.test(heat.all) && !/Found/.test(heat.all),
    `the last line names the woods waiting (${heat.last})`);

  const rain = await t((a) => {
    G.days = 2; G.goalIndex = GOALS.length;
    G.dog = 1; G.dogMetDay = 99;
    G.wood = 0; G.cardboard = 0;
    G.dumpsterLockDay = -1;
    delete activeJobs.forage; G.cooldowns = {};
    G.weather = 'rain';
    finishAction(a);
    return { wood: G.wood, card: G.cardboard };
  }, forage());
  ok(rain.wood >= 1 && rain.wood <= 4 && rain.card >= 2 && rain.card <= 6,
    `a rainy day still pays — a wet woods is not this card (wood=${rain.wood}, card=${rain.card})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
