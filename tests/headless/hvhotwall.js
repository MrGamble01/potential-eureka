/*
 * HV-268 — Paint the mural said one session on the underpass
 * wall, then a scorcher still laid the panel.
 *
 * The session is outdoor work on the underpass wall. A heat
 * wave logs a scorcher. Flyers and the depot already feel
 * the heat. The mural never read G.weather, so a scorcher
 * still spent 2 scraps, painted a panel, and stamped the day.
 *
 * A clear day still paints. Rain still paints — wet paint is
 * not this card. The fire circle is not this card. ui.js is
 * not this ticket.
 *
 *  A. Source: the mural tooltip still names the underpass wall;
 *     heat still names a scorcher; start / finish now read heat.
 *  B. A clear day still paints a panel.
 *  C. A scorcher refuses before the timer and does not paint
 *     or stamp the day.
 *  D. A rainy day still paints — wet paint is not this card.
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

const tipAt = cfg.indexOf('function muralAction');
const tip = tipAt >= 0 ? cfg.slice(tipAt, tipAt + 420) : '';
const doAt = player.indexOf('function doAction');
const doBody = doAt >= 0 ? player.slice(doAt, player.indexOf('function finishAction')) : '';
const finAt = player.indexOf("} else if(a.id==='mural')");
const finEnd = player.indexOf("} else if(a.id==='meeting')");
const fin = finAt >= 0 && finEnd > finAt ? player.slice(finAt, finEnd) : '';

ok(/underpass wall/.test(tip),
  'the mural session still names the underpass wall');
ok(/A scorcher/.test(loop),
  'a heat-wave dawn still names a scorcher');
ok(/weather\s*===\s*['"]heat['"]/.test(doBody) && /underpass wall is too hot/.test(doBody),
  'HV-268: doAction reads a scorcher before it starts a session');
ok(/weather\s*===\s*['"]heat['"]/.test(fin) && /The panel waits/.test(fin),
  'HV-268: finishAction reads a scorcher before it lays a panel');
ok(!/dogwalk/.test(fin) && !/soupNightAtDawn/.test(fin) && !/The fire held/.test(fin),
  'the fire circle is not this card');
ok(!/homeless-village\/js\/ui\.js/.test(player),
  'the cut lives on the mural session — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvhotwall-init')) {
      sessionStorage.setItem('hvhotwall-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  const clear = await t(() => {
    G.rep = 30; G.days = 2; G.mural = 0; G.muralDay = -1;
    G.scraps = 10; G.morale = 50; G.goalIndex = GOALS.length;
    G.dog = 1; G.dogMetDay = 99;
    delete activeJobs.mural; G.cooldowns = {};
    G.weather = 'clear';
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    finishAction(muralAction());
    window.log = prev;
    return {
      scraps: G.scraps, mural: G.mural, day: G.muralDay, morale: G.morale,
      last: captured[captured.length - 1] || '',
    };
  });
  ok(clear.scraps === 8 && clear.mural === 1 && clear.day === 2 && clear.morale === 53,
    `a clear day still paints a panel (scraps=${clear.scraps}, mural=${clear.mural}, day=${clear.day})`);
  ok(/first panel/.test(clear.last),
    `the clear log still narrates the panel (${clear.last})`);

  const heat = await t(() => {
    G.rep = 30; G.days = 2; G.mural = 0; G.muralDay = -1;
    G.scraps = 10; G.morale = 50; G.goalIndex = GOALS.length;
    G.dog = 1; G.dogMetDay = 99;
    delete activeJobs.mural; G.cooldowns = {};
    G.weather = 'heat';
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    doAction(muralAction());
    const started = !!activeJobs.mural;
    delete activeJobs.mural;
    finishAction(muralAction());
    window.log = prev;
    return {
      started,
      scraps: G.scraps, mural: G.mural, day: G.muralDay, morale: G.morale,
      last: captured[captured.length - 1] || '',
      all: captured.join(' | '),
    };
  });
  ok(!heat.started,
    `HV-268: a scorcher refuses the session before the timer (started=${heat.started})`);
  ok(heat.scraps === 10 && heat.mural === 0 && heat.day === -1 && heat.morale === 50,
    `HV-268: the scorcher does not paint or stamp the day (scraps=${heat.scraps}, mural=${heat.mural}, day=${heat.day})`);
  ok(/too hot to paint/.test(heat.all) && !/first panel/.test(heat.all),
    `the last line names the wall waiting (${heat.last})`);

  const rain = await t(() => {
    G.rep = 30; G.days = 2; G.mural = 0; G.muralDay = -1;
    G.scraps = 10; G.morale = 50; G.goalIndex = GOALS.length;
    G.dog = 1; G.dogMetDay = 99;
    delete activeJobs.mural; G.cooldowns = {};
    G.weather = 'rain';
    finishAction(muralAction());
    return { scraps: G.scraps, mural: G.mural, day: G.muralDay };
  });
  ok(rain.scraps === 8 && rain.mural === 1 && rain.day === 2,
    `a rainy day still paints — wet paint is not this card (mural=${rain.mural})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
