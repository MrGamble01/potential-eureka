/*
 * HV-161 — Hold a Camp Meeting said gather around the fire,
 * then Fire Went Out still hosted the circle.
 *
 * The meeting tooltip says "Gather everyone around the fire."
 * finishAction logs "The camp circles the fire." Fire Went Out
 * dims the barrel for 30s (G.fireOutUntil) and logs that it is
 * cold and dark. Clicking the circle while the barrel was dark
 * still started the 6s job and paid +2 morale a head as if the
 * fire were still there to sit around.
 *
 * Distinct from HV-69 (Firewood relights the barrel), #842
 * (Fire Went Out vs the sky), #802 (Tell the Fire Story with
 * no story yet), and HV-14 / HV-64 (who shows up, and the
 * per-head pay). This ticket is the circle vs a dead fire.
 * ui.js is not this ticket.
 *
 *  A. Source: doAction names the meeting + fireOutUntil gate
 *     before setTimeout. The tooltip still promises the fire.
 *  B. Fire Went Out, then Hold a Camp Meeting: no job, no
 *     meetingDay stamp, the log names the dead barrel.
 *  C. Rest still works while the barrel is dark.
 *  D. Once the fire is lit, the circle still starts and still
 *     pays +2 morale a head.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent + doAction + finishAction
 * on the production path.
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
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const doAt = player.indexOf('function doAction(a){');
const finishAt = player.indexOf('function finishAction(a){');
const doBlock = doAt >= 0 && finishAt > doAt ? player.slice(doAt, finishAt) : '';
const timeoutAt = doBlock.indexOf('setTimeout');
const meetAt = doBlock.search(/a\.id==='meeting'/);
const fireAt = doBlock.search(/fireOutUntil/);

ok(/Gather everyone around the fire/.test(cfg),
  'Hold a Camp Meeting still promises to gather everyone around the fire');
ok(/id:'fire_out'[\s\S]{0,220}?fireOutUntil/.test(loop),
  'Fire Went Out still dims the barrel with fireOutUntil');
ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(meetAt >= 0 && fireAt >= 0 && meetAt < timeoutAt && fireAt < timeoutAt,
  'HV-161: doAction refuses a meeting around a dead fire before the timer');
ok(/homeless-village\/js\/ui\.js/.test(player) === false,
  'the dead-fire gate lives in doAction — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvmeetfire-init')) {
      sessionStorage.setItem('hvmeetfire-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    G.population = 2;
    G.meetingDay = -9;
    buildActionUI();
    const tip = meetingAction().tooltip;
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    return {
      tip: tip,
      avail: meetingAvailable(),
      btn: !!document.getElementById('action-meeting'),
      banner: ev && ev.title,
      desc: ev && ev.desc,
    };
  });
  ok(/around the fire/.test(boot.tip),
    `the tooltip still gathers everyone around the fire (${boot.tip.slice(0, 48)})`);
  ok(boot.avail && boot.btn,
    'two residents still offer Hold a Camp Meeting');
  ok(boot.banner === 'Fire Went Out' && /colder/i.test(boot.desc),
    `the card is still Fire Went Out — everything is colder (${boot.banner})`);

  const dark = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    G.population = 2;
    G.meetingDay = -9;
    G.meetings = 0;
    G.morale = 50;
    G.warmth = 60;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    G.cooldowns = {};
    if (activeJobs.meeting) delete activeJobs.meeting;
    triggerEvent(ev, false);
    const out = Date.now() < (G.fireOutUntil || 0);
    const warmthAfter = G.warmth;
    const before = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    doAction(meetingAction());
    const after = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const added = after.filter((line, i) => line !== before[i]).join('\n');
    return {
      out: out,
      warmthAfter: warmthAfter,
      job: !!activeJobs.meeting,
      meetings: G.meetings,
      stamp: G.meetingDay,
      morale: G.morale,
      added: added,
    };
  });
  ok(dark.out && dark.warmthAfter < 60,
    `Fire Went Out leaves the barrel dark and colder (${dark.warmthAfter})`);
  ok(!dark.job && dark.meetings === 0 && dark.stamp === -9 && dark.morale === 50,
    `HV-161: a dead fire does not start a circle (job ${dark.job}, meetings ${dark.meetings}, morale ${dark.morale})`);
  ok(/circle|lit|barrel/i.test(dark.added),
    `the refuse names the dead fire — not a silent no-op (${dark.added.slice(-80)})`);

  const rest = await page.evaluate(() => {
    G.health = 70;
    G.morale = 50;
    G.cooldowns = {};
    if (activeJobs.rest) delete activeJobs.rest;
    const a = ACTIONS.find(x => x.id === 'rest');
    doAction(a);
    const started = !!activeJobs.rest;
    if (activeJobs.rest) delete activeJobs.rest;
    finishAction(a);
    return { started: started, health: G.health };
  });
  ok(rest.started && rest.health > 70,
    `Rest still works while the barrel is dark (health ${rest.health})`);

  const lit = await page.evaluate(() => {
    G.fireOutUntil = 0;
    G.population = 2;
    G.meetingDay = -9;
    G.meetings = 0;
    G.morale = 50;
    G.food = 0; G.cans = 0; G.scraps = 0; G.wood = 0; G.cardboard = 0;
    G.goalIndex = GOALS.length;
    G.cooldowns = {};
    if (activeJobs.meeting) delete activeJobs.meeting;
    doAction(meetingAction());
    const started = !!activeJobs.meeting;
    if (activeJobs.meeting) delete activeJobs.meeting;
    finishAction(meetingAction());
    const pot = G.food + G.cans + G.scraps + G.wood + G.cardboard;
    return {
      started: started,
      morale: G.morale,
      pot: pot,
      meetings: G.meetings,
      stamp: G.meetingDay === G.days,
    };
  });
  ok(lit.started, 'a lit barrel still starts the circle');
  ok(lit.morale === 54 && lit.pot === 1 && lit.meetings === 1 && lit.stamp,
    `two heads still pay +4 morale and one pot item (morale ${lit.morale}, pot ${lit.pot})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
