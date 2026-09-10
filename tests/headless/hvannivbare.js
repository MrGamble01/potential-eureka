/*
 * HV-207 — Mark the Anniversary ran a job when nobody had counted
 * the winters yet.
 *
 * The tooltip says three looks at the snapshot and somebody counts
 * the winters. annivCounts() is three looks. finishAction already
 * logs "Nobody has counted the winters yet — three looks at the
 * snapshot and the year adds up." doAction never asked. Clicking 🕯️
 * with two looks started the 2s job, then finishAction logged the
 * uncounted year and locked the button for the full 30s cooldown —
 * the same lock a real candle earns. hvanniv.js only drives
 * finishAction, so the timer seam stayed invisible.
 *
 *  A. Source: doAction refuses an uncounted year before setTimeout,
 *     same log finishAction already uses. ui.js is not this ticket.
 *  B. Two looks do not start a job, do not stamp annivMarked, and
 *     take no cooldown even after the old 2s timer would have fired.
 *  C. Three looks still pay through finishAction and still take the
 *     lock. Trade still refuses a short purse.
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

ok(/counts the winters/.test(cfg),
  'Mark the Anniversary still says somebody counts the winters');
ok(/function annivCounts\(\)\{ return loadHvSnap\(\)\.looks>=3; \}/.test(cfg),
  'three snapshot looks still count the year');
ok(doAt >= 0 && /function doAction\(a\)\{/.test(doBlock),
  'doAction is still in player.js — guards the guard');
ok(/Nobody has counted the winters yet/.test(finishBlock),
  'finishAction still names the uncounted year');

const timeoutAt = doBlock.indexOf('setTimeout');
ok(timeoutAt > 0, 'doAction still starts the job with setTimeout');
const annivAt = doBlock.indexOf("a.id==='anniv'");
ok(annivAt >= 0 && annivAt < timeoutAt && /annivCounts\(\)/.test(doBlock),
  'HV-207: doAction refuses an uncounted year before the timer starts');
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
    if (!sessionStorage.getItem('hvannivbare-init')) {
      sessionStorage.setItem('hvannivbare-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-portrait');
      localStorage.removeItem('hv-anniversary');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    const a = ACTIONS.find(x => x.id === 'anniv');
    return {
      row: !!document.getElementById('action-anniv'),
      time: a && a.time,
      cd: a && a.cooldown,
      counts: annivCounts(),
      looks: loadHvSnap().looks,
    };
  });
  ok(boot.row && boot.time === 2000 && boot.cd === 30000,
    `🕯️ is on the bar — a 2s job with a 30s lock (${boot.time}/${boot.cd})`);
  ok(!boot.counts && boot.looks === 0,
    'a fresh camp has not counted the winters');

  const bare = await page.evaluate(() => {
    saveHvSnap({ looks: 2 });
    saveHvAnniv({ toasts: 0 });
    annivMarked = false;
    G.food = 10;
    G.cooldowns = {};
    if (typeof logFeed !== 'undefined') { logFeed.innerHTML = ''; }
    if (typeof logLines !== 'undefined') { logLines.length = 0; }
    doAction(ACTIONS.find(x => x.id === 'anniv'));
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    const btn = document.getElementById('action-anniv');
    return {
      counts: annivCounts(),
      job: !!activeJobs.anniv,
      cd: G.cooldowns.anniv || 0,
      marked: !!annivMarked,
      food: G.food,
      toasts: loadHvAnniv().toasts,
      log,
      btnOn: !!(btn && btn.classList.contains('active-job')),
    };
  });
  ok(!bare.counts, 'two snapshot looks still add up to no year');
  ok(!bare.job && !bare.btnOn,
    'HV-207: an uncounted year does not start a job — the button is not active-job');
  ok(bare.cd === 0 && !bare.marked && bare.food === 10 && bare.toasts === 0,
    `HV-207: an uncounted year takes no cooldown and does not stamp the candle (cd ${bare.cd}, food ${bare.food})`);
  ok(/Nobody has counted the winters yet/.test(bare.log),
    'the refuse is the same line finishAction already used — named, not silent');

  await page.waitForTimeout(2500);
  const afterWait = await page.evaluate(() => ({
    cd: G.cooldowns.anniv || 0,
    job: !!activeJobs.anniv,
    marked: !!annivMarked,
    food: G.food,
    toasts: loadHvAnniv().toasts,
  }));
  ok(afterWait.cd === 0 && !afterWait.job && !afterWait.marked && afterWait.food === 10 && afterWait.toasts === 0,
    `2.5s later the 30s lock still has not landed (cd ${afterWait.cd}) — reverting the guard fails this by name`);

  const counted = await page.evaluate(() => {
    saveHvSnap({ looks: 3 });
    saveHvAnniv({ toasts: 0 });
    annivMarked = false;
    G.food = 10;
    G.cooldowns = {};
    finishAction(ACTIONS.find(x => x.id === 'anniv'));
    return {
      counts: annivCounts(),
      food: G.food,
      toasts: loadHvAnniv().toasts,
      marked: !!annivMarked,
      cd: G.cooldowns.anniv || 0,
    };
  });
  ok(counted.counts && counted.food === 16 && counted.toasts === 1 && counted.marked && counted.cd > Date.now(),
    `three looks still light the candle and still take the lock (food ${counted.food}, toasts ${counted.toasts})`);

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
