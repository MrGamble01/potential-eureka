/*
 * HV-204 — Look at the Snapshot ran a job when the fridge door was bare.
 *
 * The tooltip says a snapshot from the reunion is tucked into the
 * fridge door. snapshotHangs() is three reunions. finishAction already
 * logs "No snapshot in the fridge door yet — three reunions put one
 * there." doAction never asked. Clicking 📷 with two reunions started
 * the 2s job, then finishAction logged the bare door and locked the
 * button for the full 30s cooldown — the same lock a real look earns.
 * hvsnapshot.js only drives finishAction, so the timer seam stayed
 * invisible.
 *
 *  A. Source: doAction refuses a bare door before setTimeout, same
 *     log finishAction already uses. ui.js is not this ticket.
 *  B. A bare door (held < 3) does not start a job, does not stamp
 *     snapshotLooked, and takes no cooldown even after the old 2s
 *     timer would have fired.
 *  C. Three reunions still pay through finishAction and still take
 *     the lock. Trade still refuses a short purse.
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
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const doAt = player.indexOf('function doAction(a){');
const finishAt = player.indexOf('function finishAction(a){');
const doBlock = doAt >= 0 && finishAt > doAt ? player.slice(doAt, finishAt) : '';
const finishBlock = finishAt >= 0 ? player.slice(finishAt, player.indexOf('function doCraft')) : '';

ok(/tucked into the fridge door/.test(cfg),
  'Look at the Snapshot still says the picture is tucked into the fridge door');
ok(/function snapshotHangs\(\)\{ return loadHvReunion\(\)\.held>=3; \}/.test(cfg),
  'three reunions still tuck the snapshot in the door');
ok(doAt >= 0 && /function doAction\(a\)\{/.test(doBlock),
  'doAction is still in player.js — guards the guard');
ok(/No snapshot in the fridge door yet/.test(finishBlock),
  'finishAction still names the bare door');

const timeoutAt = doBlock.indexOf('setTimeout');
ok(timeoutAt > 0, 'doAction still starts the job with setTimeout');
const snapAt = doBlock.indexOf("a.id==='snapshot'");
ok(snapAt >= 0 && snapAt < timeoutAt && /snapshotHangs\(\)/.test(doBlock),
  'HV-204: doAction refuses a bare fridge door before the timer starts');
ok(!/homeless-village\/js\/ui\.js/.test(player) && !/function buildActionUI/.test(doBlock),
  'the refuse gate lives in doAction — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvsnapbare-init')) {
      sessionStorage.setItem('hvsnapbare-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-reunion');
      localStorage.removeItem('hv-portrait');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    const a = ACTIONS.find(x => x.id === 'snapshot');
    return {
      row: !!document.getElementById('action-snapshot'),
      time: a && a.time,
      cd: a && a.cooldown,
      hangs: snapshotHangs(),
      held: loadHvReunion().held,
    };
  });
  ok(boot.row && boot.time === 2000 && boot.cd === 30000,
    `📷 is on the bar — a 2s job with a 30s lock (${boot.time}/${boot.cd})`);
  ok(!boot.hangs && boot.held === 0,
    'a fresh camp has no snapshot in the fridge door');

  const bare = await page.evaluate(() => {
    saveHvReunion({ held: 2 });
    saveHvSnap({ looks: 0 });
    snapshotLooked = false;
    G.food = 10;
    G.cooldowns = {};
    if (typeof logFeed !== 'undefined') { logFeed.innerHTML = ''; }
    if (typeof logLines !== 'undefined') { logLines.length = 0; }
    doAction(ACTIONS.find(x => x.id === 'snapshot'));
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    const btn = document.getElementById('action-snapshot');
    return {
      hangs: snapshotHangs(),
      job: !!activeJobs.snapshot,
      cd: G.cooldowns.snapshot || 0,
      looked: !!snapshotLooked,
      food: G.food,
      looks: loadHvSnap().looks,
      log,
      btnOn: !!(btn && btn.classList.contains('active-job')),
    };
  });
  ok(!bare.hangs, 'two reunions still tuck no snapshot');
  ok(!bare.job && !bare.btnOn,
    'HV-204: a bare door does not start a job — the button is not active-job');
  ok(bare.cd === 0 && !bare.looked && bare.food === 10 && bare.looks === 0,
    `HV-204: a bare door takes no cooldown and does not stamp the look (cd ${bare.cd}, food ${bare.food})`);
  ok(/No snapshot in the fridge door yet/.test(bare.log),
    'the refuse is the same line finishAction already used — named, not silent');

  await page.waitForTimeout(2500);
  const afterWait = await page.evaluate(() => ({
    cd: G.cooldowns.snapshot || 0,
    job: !!activeJobs.snapshot,
    looked: !!snapshotLooked,
    food: G.food,
    looks: loadHvSnap().looks,
  }));
  ok(afterWait.cd === 0 && !afterWait.job && !afterWait.looked && afterWait.food === 10 && afterWait.looks === 0,
    `2.5s later the 30s lock still has not landed (cd ${afterWait.cd}) — reverting the guard fails this by name`);

  const hung = await page.evaluate(() => {
    saveHvReunion({ held: 3 });
    saveHvSnap({ looks: 0 });
    snapshotLooked = false;
    G.food = 10;
    G.cooldowns = {};
    finishAction(ACTIONS.find(x => x.id === 'snapshot'));
    return {
      hangs: snapshotHangs(),
      food: G.food,
      looks: loadHvSnap().looks,
      looked: !!snapshotLooked,
      cd: G.cooldowns.snapshot || 0,
    };
  });
  ok(hung.hangs && hung.food === 15 && hung.looks === 1 && hung.looked && hung.cd > Date.now(),
    `three reunions still pay the look and still take the lock (food ${hung.food}, looks ${hung.looks})`);

  const trade = await page.evaluate(() => {
    G.cans = 0; G.food = 0; G.cooldowns = {};
    doAction(ACTIONS.find(x => x.id === 'trade'));
    return { job: !!activeJobs.trade, cd: G.cooldowns.trade || 0, cans: G.cans };
  });
  ok(!trade.job && trade.cd === 0 && trade.cans === 0,
    'broke Trade still refuses before the timer — HV-61 stays put');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
