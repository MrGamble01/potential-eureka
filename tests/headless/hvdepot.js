/*
 * HV-155 — Unload at the depot said a morning of honest lifting,
 * then night still paid.
 *
 * The bulletin board rotates the depot posting onto day 0, 5, 10…
 * The tooltip says "A morning of honest lifting. +5 goodwill."
 * The HUD already names six hours (Dawn → Night) from G.timeOfDay.
 * Clicking the row at Night still started the 8s job and paid +5
 * as if the loading dock never closed.
 *
 * Distinct from #774 (the bus ticket said morning and boarded at
 * night) and from HV-8 (once-per-day latch). This ticket is the
 * depot shift vs the clock. ui.js is not this ticket.
 *
 *  A. Source: doAction names the depot + timeOfDay gate before setTimeout.
 *  B. Night (timeOfDay 0.85): no job, no oddJobDay, same morning line.
 *  C. Dawn (timeOfDay 0.1): the job still starts; finishAction still pays +5.
 *  D. A night flyers posting still pays — only depot is a morning shift.
 *  Z. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const doAt = player.indexOf('function doAction(a){');
const finishAt = player.indexOf('function finishAction(a){');
const doBlock = doAt >= 0 && finishAt > doAt ? player.slice(doAt, finishAt) : '';
const timeoutAt = doBlock.indexOf('setTimeout');
const depotAt = doBlock.indexOf('depot');
const clockAt = doBlock.search(/timeOfDay/);

ok(/id:'depot'[\s\S]{0,180}?morning of honest lifting/.test(cfg),
  'the depot posting still promises a morning of honest lifting');
ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(depotAt >= 0 && clockAt >= 0 && depotAt < timeoutAt && clockAt < timeoutAt,
  'HV-155: doAction refuses a night depot shift before the timer');
ok(/homeless-village\/js\/ui\.js/.test(player) === false,
  'the morning gate lives in doAction — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvdepot-init')) {
      sessionStorage.setItem('hvdepot-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    G.days = 0;
    G.oddJobDay = -1;
    buildActionUI();
    const j = todaysJob();
    const hour = ['Dawn','Morning','Midday','Afternoon','Dusk','Night'][Math.floor(0.85 * 6)];
    return {
      job: j.id,
      desc: j.desc,
      time: j.time,
      hour: hour,
      btn: !!document.getElementById('action-oddjob'),
    };
  });
  ok(boot.job === 'depot' && /morning of honest lifting/.test(boot.desc),
    'day 0 posts Unload at the depot — a morning of honest lifting');
  ok(boot.btn && boot.time === 8000 && boot.hour === 'Night',
    `the HUD still names Night at 0.85 and the job is still 8s (${boot.hour}, ${boot.time})`);

  const night = await page.evaluate(() => {
    G.days = 0;
    G.timeOfDay = 0.85;
    G.oddJobDay = -1;
    G.goodwill = 0;
    G.cooldowns = {};
    if (activeJobs.oddjob) delete activeJobs.oddjob;
    doAction(oddJobAction());
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      job: !!activeJobs.oddjob,
      day: G.oddJobDay,
      gw: G.goodwill,
      log: log,
    };
  });
  ok(!night.job && night.day === -1 && night.gw === 0,
    `HV-155: a night depot shift does not start a job or stamp the day (job ${night.job}, day ${night.day})`);
  ok(/morning|dock|depot/i.test(night.log),
    'the refuse names the morning shift — not a silent no-op');

  const dawn = await page.evaluate(() => {
    G.days = 0;
    G.timeOfDay = 0.1;
    G.oddJobDay = -1;
    G.goodwill = 0;
    G.cooldowns = {};
    if (activeJobs.oddjob) delete activeJobs.oddjob;
    doAction(oddJobAction());
    const started = !!activeJobs.oddjob;
    if (activeJobs.oddjob) delete activeJobs.oddjob;
    finishAction(oddJobAction());
    return {
      started: started,
      gw: G.goodwill,
      day: G.oddJobDay,
    };
  });
  ok(dawn.started,
    'HV-155: a dawn depot shift still starts the job');
  ok(dawn.gw === 5 && dawn.day === 0,
    `a morning lift still pays +5 goodwill and still closes the day (${dawn.gw}, day ${dawn.day})`);

  const flyers = await page.evaluate(() => {
    G.days = 1;
    G.timeOfDay = 0.85;
    G.oddJobDay = -1;
    G.goodwill = 0;
    G.morale = 50;
    G.cooldowns = {};
    if (activeJobs.oddjob) delete activeJobs.oddjob;
    const j = todaysJob();
    finishAction(oddJobAction());
    return { id: j.id, gw: G.goodwill, morale: G.morale, day: G.oddJobDay };
  });
  ok(flyers.id === 'flyers' && flyers.gw === 3 && flyers.morale === 54 && flyers.day === 1,
    `a night flyers posting still pays — only depot is a morning shift (${flyers.id}, +${flyers.gw} gw)`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
