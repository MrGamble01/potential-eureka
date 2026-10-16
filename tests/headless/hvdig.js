/*
 * HV-212 — Dig Up the Coffee Can ran a job when nothing
 * was buried by the piling.
 *
 * The 📦 button sits on the action list from day one. The
 * tooltip says three playings of the ballad bury a can.
 * doAction starts the 2s job anyway. finishAction then logs
 * Nothing buried by the piling yet, plays the success sound,
 * and charges the 30s cooldown as if the dig had paid.
 *
 * Distinct from HV-49 (the can's dish and once-a-session
 * latch), HV-61 (#707: Trade / Rain Bet / Garage / Fridge
 * refuse a short purse before the timer), HV-204 (#894:
 * Snapshot ran when the fridge door was bare), and HV-207
 * (#897: Anniversary ran when nobody had counted the
 * winters). This is the can's bury-gate × the timer.
 * Snapshot and Anniversary are not this card.
 *
 *  A. Source: doAction refuses !canBuried() before setTimeout.
 *  B. The can still promises three playings bury it.
 *  C. Live: two playings, click Dig — immediate refuse, no
 *     active job, no cooldown after 2s, food stays put.
 *  D. Three playings still start the job and pay.
 *  E. Trade's short-purse refuse is not this card.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives doAction() on the production can.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const doAt = player.indexOf('function doAction(a){');
const finishAt = player.indexOf('function finishAction(a){');
const doBlock = doAt >= 0 && finishAt > doAt ? player.slice(doAt, finishAt) : '';
const timeoutAt = doBlock.indexOf('setTimeout');
const canAt = doBlock.indexOf("a.id==='can'");
ok(/function doAction\(a\)\{/.test(doBlock) && timeoutAt > 0,
  'doAction still starts the job with setTimeout');
ok(/three playings of the ballad/.test(player) && /Nothing buried by the piling/.test(player),
  'the can still promises three playings bury it, and still names an empty piling');
ok(canAt >= 0 && canAt < timeoutAt && /canBuried\s*\(/.test(doBlock.slice(canAt, timeoutAt)),
  'HV-212: doAction refuses an unburied can before the timer');
ok(/a\.id==='trade'/.test(doBlock) && /G\.cans\s*<\s*3/.test(doBlock),
  'Trade\'s short-purse refuse is not this card');

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
    if (!sessionStorage.getItem('hvdig-init')) {
      sessionStorage.setItem('hvdig-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-song');
      localStorage.removeItem('hv-capsule');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const clickCan = (plays) => page.evaluate((p) => {
    const lines = [];
    const realLog = log;
    log = function (s) { lines.push(String(s)); realLog(s); };
    saveHvSong({ plays: p });
    saveHvCan({ digs: 0 });
    canDug = false;
    G.food = 10;
    G.cooldowns = {};
    const a = ACTIONS.find(x => x.id === 'can');
    doAction(a);
    const started = !!activeJobs.can;
    const cdNow = G.cooldowns.can || 0;
    log = realLog;
    return { started, cdNow, food: G.food, buried: canBuried(),
      empty: lines.some(s => /Nothing buried by the piling/i.test(s)) };
  }, plays);

  const empty = await clickCan(2);
  ok(!empty.buried && empty.empty && !empty.started && !empty.cdNow,
    `two playings: immediate refuse, no job (buried=${empty.buried}, started=${empty.started}, cd=${empty.cdNow})`);

  await page.waitForTimeout(2200);
  const after = await page.evaluate(() => ({
    cd: G.cooldowns.can || 0,
    food: G.food,
    jobs: !!activeJobs.can,
  }));
  ok(!after.cd && after.food === 10 && !after.jobs,
    `after 2s the miss still charged nothing (cd=${after.cd}, food=${after.food})`);

  const buried = await clickCan(3);
  ok(buried.buried && buried.started && !buried.empty,
    `three playings still start the dig (buried=${buried.buried}, started=${buried.started})`);

  await page.waitForTimeout(2200);
  const paid = await page.evaluate(() => ({
    food: G.food,
    digs: loadHvCan().digs,
    dug: !!canDug,
  }));
  ok(paid.food > 10 && paid.digs === 1 && paid.dug,
    `a buried can still pays (food=${paid.food}, digs=${paid.digs})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
