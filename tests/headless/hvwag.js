/*
 * HV-267 — Walk the neighbor's dogs said fresh air, then a
 * cold snap still paid the quiet-day walk.
 *
 * The posting promises fresh air and wagging tails. HV-18's
 * named snap says two brutal days and foot traffic thins.
 * Panhandle already reads snapActive. The dog walk never did,
 * so a brutal dawn still paid the +2 goodwill / +6 morale
 * as if the neighbor had sent the pack out.
 *
 * A quiet day still pays the posted walk. Depot (and the
 * other board jobs) still pay inside a snap. Hungry Biscuit
 * is not this card. Heat is not this card. ui.js is not
 * this ticket.
 *
 *  A. Source: the walk posting still says fresh air; the snap
 *     still says two brutal days; odd-job finish / start now
 *     reads snapActive for dogwalk.
 *  B. A quiet day still pays the posted walk.
 *  C. A named snap refuses the walk before the timer and
 *     does not pay; finishAction does not stamp the day.
 *  D. Unload at the depot still pays inside the same snap.
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

const jobAt = cfg.indexOf("{id:'dogwalk'");
const job = jobAt >= 0 ? cfg.slice(jobAt, jobAt + 280) : '';
const snapAt = loop.indexOf('A cold snap grips the block');
const doAt = player.indexOf('function doAction');
const doBody = doAt >= 0 ? player.slice(doAt, player.indexOf('function finishAction')) : '';
const finAt = player.indexOf("} else if(a.id==='oddjob')");
const finEnd = player.indexOf("} else if(a.id==='mural')");
const fin = finAt >= 0 && finEnd > finAt ? player.slice(finAt, finEnd) : '';

ok(/[Ff]resh air/.test(job) && /wagging tails/.test(job),
  'the walk posting still promises fresh air and wagging tails');
ok(/two brutal days/.test(loop) && snapAt >= 0,
  'HV-18 still names two brutal days when the snap grips the block');
ok(/snapActive\s*\(/.test(doBody) && /dogwalk/.test(doBody),
  'HV-267: doAction reads snapActive before it starts a dog walk');
ok(/snapActive\s*\(/.test(fin) && /dogwalk/.test(fin) && /kept the dogs in/.test(fin),
  'HV-267: finishAction reads the snap before it pays the walk');
ok(!/dogHungry/.test(doBody) && !/dogHungry/.test(fin),
  'hungry Biscuit is not this card');
ok(!/homeless-village\/js\/ui\.js/.test(player),
  'the cut lives on the board walk — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvwag-init')) {
      sessionStorage.setItem('hvwag-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = (fn, arg) => page.evaluate(fn, arg);

  const quiet = await t(() => {
    G.days = 4;
    G.weather = 'clear';
    G.snapUntil = null;
    G.oddJobDay = -1;
    G.goodwill = 0;
    G.morale = 50;
    G.goalIndex = GOALS.length;
    G.structures.toolbox = false;
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    finishAction(oddJobAction());
    window.log = prev;
    return {
      job: todaysJob().id,
      gw: G.goodwill,
      morale: G.morale,
      day: G.oddJobDay,
      last: captured[captured.length - 1] || '',
    };
  });
  ok(quiet.job === 'dogwalk' && quiet.gw === 2 && quiet.morale === 56 && quiet.day === 4,
    `a quiet day still pays the posted walk (gw=${quiet.gw}, morale=${quiet.morale}, day=${quiet.day})`);
  ok(/odd job done/i.test(quiet.last),
    `the quiet log still names the walk (${quiet.last})`);

  const brutal = await t(() => {
    G.days = 4;
    G.weather = 'clear';
    G.snapUntil = G.days + 2;
    G.oddJobDay = -1;
    G.goodwill = 0;
    G.morale = 50;
    G.goalIndex = GOALS.length;
    G.structures.toolbox = false;
    delete activeJobs.oddjob;
    G.cooldowns = {};
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    doAction(oddJobAction());
    const started = !!activeJobs.oddjob;
    delete activeJobs.oddjob;
    finishAction(oddJobAction());
    window.log = prev;
    return {
      active: snapActive(),
      started,
      gw: G.goodwill,
      morale: G.morale,
      day: G.oddJobDay,
      last: captured[captured.length - 1] || '',
      all: captured.join(' | '),
    };
  });
  ok(brutal.active && !brutal.started,
    `HV-267: a named snap refuses the walk before the timer (started=${brutal.started}, active=${brutal.active})`);
  ok(brutal.gw === 0 && brutal.morale === 50 && brutal.day === -1,
    `HV-267: the snap does not pay or stamp the day (gw=${brutal.gw}, morale=${brutal.morale}, day=${brutal.day})`);
  ok(/kept the dogs in/.test(brutal.all) && !/odd job done/i.test(brutal.all),
    `the last line names the neighbor keeping the dogs in (${brutal.last})`);

  const depot = await t(() => {
    G.days = 0;
    G.weather = 'clear';
    G.snapUntil = 99;
    G.oddJobDay = -1;
    G.goodwill = 0;
    G.morale = 50;
    G.goalIndex = GOALS.length;
    G.structures.toolbox = false;
    finishAction(oddJobAction());
    return { job: todaysJob().id, gw: G.goodwill, day: G.oddJobDay, active: snapActive() };
  });
  ok(depot.job === 'depot' && depot.active && depot.gw === 5 && depot.day === 0,
    `Unload at the depot still pays inside the same snap (job=${depot.job}, gw=${depot.gw})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
