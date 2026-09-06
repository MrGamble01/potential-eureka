/* HV-94 — Hold a camp meeting said a day or two, then locked three.
 *
 * MEETING_EVERY is 3. After a circle, meetingDone() stays true until
 * G.days - meetingDay >= 3. doAction and the greyed-button tip both
 * said "a day or two." A player who waited two dawns still could not
 * convene.
 *
 * Write-first, hook-free.
 *
 *  A. Source: MEETING_EVERY is still 3. The rest copy cites that
 *     wait — not "a day or two." The live tooltip still sells +2
 *     a head (hvmeetcap / hvmeeting).
 *  B. Live: after a two-person circle, day+1 and day+2 stay locked
 *     and the refuse line names three days. Day+3 opens again.
 *     Two heads still pay +4 morale.
 *  Z. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg    = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui     = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const meetAt = cfg.indexOf('function meetingAction()');
const meet = meetAt >= 0 ? cfg.slice(meetAt, meetAt + 420) : '';
const restAt = player.indexOf("id==='meeting'");
const rest = restAt >= 0 ? player.slice(restAt, restAt + 220) : '';
const tipAt = ui.indexOf('meetingDone()');
const tip = tipAt >= 0 ? ui.slice(tipAt, tipAt + 280) : '';

ok(/MEETING_EVERY\s*=\s*3/.test(cfg),
  'A. MEETING_EVERY is still 3 — hvmeeting\'s three-day rest stays true');
ok(/\+2 morale a head/.test(meet),
  'A. the live tooltip still promises +2 morale a head');
ok(/function meetingRestLine/.test(cfg) && /MEETING_EVERY/.test(cfg.slice(cfg.indexOf('meetingRestLine'), cfg.indexOf('meetingRestLine') + 180)),
  'A. meetingRestLine() cites MEETING_EVERY — one wait, not a frozen "day or two"');
ok(/meetingRestLine/.test(rest) && !/day or two/i.test(rest),
  'A. doAction rest copy calls that helper, not "a day or two"');
ok(/meetingRestLine/.test(tip) && !/day or two/i.test(tip),
  'A. the greyed-button tip cites the same helper, not "a day or two"');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {}
    try { localStorage.removeItem('homeless_village_v1'); } catch (e) {}
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2200);

  const held = await page.evaluate(() => {
    G.goalIndex = GOALS.length;
    G.meetingDay = -9;
    G.days = 10;
    G.population = 2;
    G.morale = 50;
    G.food = 0; G.cans = 0; G.scraps = 0; G.wood = 0; G.cardboard = 0;
    finishAction(meetingAction());
    return { morale: G.morale, gain: G.morale - 50, day: G.meetingDay, done: meetingDone() };
  });
  ok(held.gain === 4 && held.morale === 54,
    `B. two heads still pay +4 morale (got +${held.gain})`);
  ok(held.done && held.day === 10,
    `B. the circle stamps the day and rests (${held.day}, done=${held.done})`);

  const wait = await page.evaluate(() => {
    const refuse = (d) => {
      G.days = d;
      for (var i = 0; i < 6; i++) log('---');
      doAction(meetingAction());
      const lines = Array.from(document.querySelectorAll('.log-line')).map(x => x.textContent);
      return {
        done: meetingDone(),
        line: (lines.find(l => /camp met|reconvene|days|day or two/i.test(l)) || ''),
        meetings: G.meetings
      };
    };
    const plus1 = refuse(11);
    const plus2 = refuse(12);
    G.days = 13;
    const opened = !meetingDone();
    const before = G.meetings;
    finishAction(meetingAction());
    return { plus1, plus2, opened, meetings: G.meetings, before };
  });
  ok(wait.plus1.done && wait.plus2.done && wait.plus1.meetings === wait.plus2.meetings,
    `B. day+1 and day+2 stay locked (done ${wait.plus1.done}/${wait.plus2.done})`);
  ok(/3|three/i.test(wait.plus1.line) && !/day or two/i.test(wait.plus1.line),
    `B. the refuse line names three days (${wait.plus1.line || 'no line'})`);
  ok(wait.opened && wait.meetings === wait.before + 1,
    `B. day+3 opens the circle again (opened=${wait.opened}, meetings=${wait.meetings})`);

  await browser.close();
  ok(errs.length === 0, `Z. no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
