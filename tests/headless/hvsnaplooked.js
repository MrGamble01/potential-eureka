/*
 * HV-230 — Look at the Snapshot ran a job when it already
 * got its look today.
 *
 * The tooltip says look at it once a session. finishAction
 * already logs "The snapshot got its look today — it fades
 * if you stare." doAction never asked. After a paid look,
 * clicking 📷 again started the 2s job, then finishAction
 * logged the fade line and locked the button for the full
 * 30s cooldown — the same lock a real look earns.
 * hvsnapshot.js only drives finishAction, so the timer
 * seam stayed invisible.
 *
 * HV-204 / #894 (bare fridge door — !snapshotHangs) is a
 * different gate. Rain on the visitor (#906) is another
 * card. This ticket is the same-session stamp vs the timer.
 * ui.js is not this ticket.
 *
 *  A. Source: doAction refuses when snapshotLooked before
 *     setTimeout, same log finishAction already uses.
 *     ui.js is not this ticket.
 *  B. Three reunions, one paid look, then Look at the
 *     Snapshot again: no job, no extra food, no extra look,
 *     and no cooldown even after the old 2s timer would
 *     have fired.
 *  C. Clearing the stamp still pays through finishAction
 *     and still takes the lock. Trade still refuses a
 *     short purse. A bare door is still finishAction's
 *     (HV-204).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives doAction() on the production action.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const config = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const doAt = player.indexOf('function doAction(a){');
const finishAt = player.indexOf('function finishAction(a){');
const doBlock = doAt >= 0 && finishAt > doAt ? player.slice(doAt, finishAt) : '';
const finishBlock = finishAt >= 0 ? player.slice(finishAt) : '';
const timeoutAt = doBlock.indexOf('setTimeout');
const snapAt = doBlock.indexOf("a.id==='snapshot'");
const lookedAt = doBlock.indexOf('snapshotLooked');

ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(snapAt >= 0 && lookedAt >= 0 && snapAt < timeoutAt && lookedAt < timeoutAt,
  'HV-230: doAction refuses Look at the Snapshot before the timer when it already got its look');
ok(/Look at it once a session/.test(config) && /Look at the Snapshot/.test(config),
  'the card still promises a look once a session');
ok(/got its look today/.test(finishBlock),
  'finishAction still names the fade-if-you-stare refuse — the line this gate copies');
ok(!/homeless-village\/js\/ui\.js/.test(player),
  'the refuse lives in doAction — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvsnaplooked-init')) {
      sessionStorage.setItem('hvsnaplooked-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-reunion');
      localStorage.removeItem('hv-portrait');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const paid = await t(() => {
    saveHvReunion({ held: 3 });
    saveHvSnap({ looks: 0 });
    snapshotLooked = false;
    G.food = 10;
    G.cooldowns = {};
    finishAction(ACTIONS.find(x => x.id === 'snapshot'));
    return {
      hangs: snapshotHangs(),
      looked: snapshotLooked,
      food: G.food,
      looks: loadHvSnap().looks,
      dish: snapshotDish(),
    };
  });
  ok(paid.hangs && paid.looked && paid.dish === 5 && paid.food === 15 && paid.looks === 1,
    `three reunions still hang the snapshot and pay +5 (food ${paid.food}, looks ${paid.looks})`);

  const again = await t(() => {
    G.cooldowns = {};
    if (activeJobs.snapshot) delete activeJobs.snapshot;
    const a = ACTIONS.find(x => x.id === 'snapshot');
    doAction(a);
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      job: !!activeJobs.snapshot,
      cd: G.cooldowns.snapshot || 0,
      food: G.food,
      looks: loadHvSnap().looks,
      looked: snapshotLooked,
      log,
      btnOn: !!(document.getElementById('action-snapshot')
        && document.getElementById('action-snapshot').classList.contains('active-job')),
    };
  });
  ok(!again.job && !again.btnOn,
    'a second look does not start a job — the button is not active-job');
  ok(again.cd === 0 && again.food === 15 && again.looks === 1 && again.looked,
    `a second look takes no cooldown and does not fill the pot (cd ${again.cd}, food ${again.food})`);
  ok(/got its look today/.test(again.log),
    'the refuse is the same line finishAction already used');

  await page.waitForTimeout(2500);
  const afterWait = await t(() => ({
    cd: G.cooldowns.snapshot || 0,
    food: G.food,
    job: !!activeJobs.snapshot,
    looks: loadHvSnap().looks,
    looked: snapshotLooked,
  }));
  ok(afterWait.cd === 0 && afterWait.food === 15 && !afterWait.job && afterWait.looks === 1 && afterWait.looked,
    `2.5s later the 30s lock still has not landed (cd ${afterWait.cd})`);

  const rearm = await t(() => {
    snapshotLooked = false;
    G.food = 10;
    G.cooldowns = {};
    finishAction(ACTIONS.find(x => x.id === 'snapshot'));
    return {
      food: G.food,
      looks: loadHvSnap().looks,
      looked: snapshotLooked,
      cd: G.cooldowns.snapshot || 0,
    };
  });
  ok(rearm.food === 15 && rearm.looks === 2 && rearm.looked && rearm.cd > Date.now(),
    `clearing the stamp still fills the pot and still takes the lock (food ${rearm.food}, looks ${rearm.looks})`);

  const trade = await t(() => {
    G.cans = 0; G.food = 0; G.cooldowns = {};
    doAction(ACTIONS.find(a => a.id === 'trade'));
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return { job: !!activeJobs.trade, cd: G.cooldowns.trade || 0, cans: G.cans, log };
  });
  ok(!trade.job && trade.cd === 0 && trade.cans === 0 && /Not enough cans to trade/.test(trade.log),
    'Trade still refuses a short purse before the timer');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
