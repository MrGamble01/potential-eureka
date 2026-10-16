/*
 * HV-263 — Hold a Camp Meeting said gather around the fire,
 * then a scorcher still hosted the circle.
 *
 * The tooltip and the log say the camp circles the fire.
 * A heat wave is the last sky for sitting by a barrel. The
 * circle never read the sky.
 *
 * A clear evening still holds. Rain is not this card. A dead
 * barrel is not this card (#851). ui.js is not this ticket.
 *
 *  A. Source: doAction and finishAction refuse a scorcher circle.
 *  B. A heat-wave evening starts no job and spends no cadence.
 *  C. A clear evening still holds.
 *  D. Rain still holds — a wet sky is not this card.
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

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const doAt = player.indexOf('function doAction(a)');
const finAt = player.indexOf('function finishAction(a)');
const doBody = doAt >= 0 ? player.slice(doAt, finAt > doAt ? finAt : doAt + 2400) : '';
const meetAt = player.indexOf("} else if(a.id==='meeting'){");
const depAt = player.indexOf("} else if(a.id==='deposit'){");
const meetBody = meetAt >= 0 && depAt > meetAt ? player.slice(meetAt, depAt) : '';

ok(/circles the fire/.test(player) && /Gather everyone around the fire/.test(fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8')),
  'the circle still says it gathers around the fire');
ok(/weather==='heat'/.test(doBody) && /circle the fire on a scorcher/.test(doBody),
  'HV-263: doAction refuses the scorcher circle before the timer');
ok(/weather==='heat'/.test(meetBody) && /circle the fire on a scorcher/.test(meetBody),
  'HV-263: finishAction refuses the scorcher circle too');
ok(!/fireOutUntil/.test(meetBody),
  'a dead barrel is not this card');
ok(!/homeless-village\/js\/ui\.js/.test(player),
  'the cut lives on the circle — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvscorch-init')) {
      sessionStorage.setItem('hvscorch-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const dry = await t(() => {
    G.goalIndex = GOALS.length;
    G.days = 12;
    G.meetingDay = -9;
    G.meetings = 0;
    G.population = 3;
    G.morale = 50;
    G.rep = 0;
    G.weather = 'clear';
    G.fireOutUntil = 0;
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    finishAction(meetingAction());
    window.log = prev;
    return { meetings: G.meetings, stamp: G.meetingDay, last: captured[captured.length - 1] || '' };
  });
  ok(dry.meetings === 1 && dry.stamp === 12,
    `a clear evening still holds (meetings=${dry.meetings})`);
  ok(/circles the fire/.test(dry.last),
    `the dry log still names the fire (${dry.last})`);

  const hot = await t(() => {
    G.days = 20;
    G.meetingDay = -9;
    G.meetings = 0;
    G.population = 3;
    G.morale = 50;
    G.weather = 'heat';
    G.fireOutUntil = 0;
    delete activeJobs.meeting;
    const captured = [];
    const prev = window.log;
    window.log = function (m) { captured.push(String(m)); prev(m); };
    doAction(meetingAction());
    const queued = !!activeJobs.meeting;
    finishAction(meetingAction());
    window.log = prev;
    return {
      meetings: G.meetings,
      stamp: G.meetingDay,
      queued,
      last: captured[captured.length - 1] || '',
    };
  });
  ok(!hot.queued && hot.meetings === 0 && hot.stamp === -9,
    `HV-263: a scorcher starts no job (queued=${hot.queued}, meetings=${hot.meetings}, stamp=${hot.stamp})`);
  ok(/circle the fire on a scorcher/.test(hot.last),
    `the last line names the scorcher (${hot.last})`);

  const wet = await t(() => {
    G.days = 28;
    G.meetingDay = -9;
    G.meetings = 0;
    G.population = 3;
    G.morale = 50;
    G.weather = 'rain';
    G.fireOutUntil = 0;
    finishAction(meetingAction());
    return { meetings: G.meetings, stamp: G.meetingDay };
  });
  ok(wet.meetings === 1 && wet.stamp === 28,
    `rain still holds — a wet sky is not this card (meetings=${wet.meetings})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
