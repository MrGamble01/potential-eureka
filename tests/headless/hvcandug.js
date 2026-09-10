/*
 * HV-253 — Dig Up the Coffee Can said once a session, then a
 * second click still ran the job.
 *
 * The tooltip says Dig it up once a session. finishAction already
 * logs "The can got its dig today — the piling keeps it."
 * and no-ops. Clicking 📦 after canDug still started the
 * 2s job and charged the 30s lock as if the can filled again.
 *
 * Distinct from HV-212 / #905 (nothing was buried), HV-214 /
 * #907 (rain on an unroofed piling), HV-251 / #947 (the
 * ballad already got its playing), HV-248 / #944 (the fire
 * story already got its telling). This ticket is the can
 * after it already got its dig. ui.js is not this ticket.
 *
 *  A. Source: doAction names the canDug gate before
 *     setTimeout, only when the can is buried. The refuse log
 *     still says the piling keeps it. ui.js is not this ticket.
 *  B. A buried can that already got its dig: no job, no
 *     extra tally, no food, and no cooldown even after the
 *     old 2s timer would have fired. The log names the
 *     already-dug day.
 *  C. Rest still works after the refuse.
 *  D. A first dig still fills the pot and stamps canDug.
 *     Two playings still refuse. Trade still refuses a
 *     short purse.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives doAction + finishAction.
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
const finishBlock = finishAt >= 0 ? player.slice(finishAt) : '';
const timeoutAt = doBlock.indexOf('setTimeout');
const canAt = doBlock.indexOf("a.id==='can'");
const dugAt = doBlock.indexOf('canDug');

ok(/Dig it up once a session/.test(cfg) && /tucked in with it/.test(cfg),
  'Dig Up the Coffee Can still promises one dig a session');
ok(/got its dig today/.test(finishBlock) && /the piling keeps it/.test(finishBlock),
  'the refuse log still names the already-dug day');
ok(/THE COFFEE CAN/.test(finishBlock) && /tucked in with it/.test(finishBlock),
  'the pay log still tucks something in before the last verse');
ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(canAt >= 0 && dugAt >= 0 && canAt < timeoutAt && dugAt < timeoutAt
   && /canBuried\(\)/.test(doBlock),
  'HV-253: doAction refuses a buried already-dug can before the timer');
ok(!/homeless-village\/js\/ui\.js/.test(player),
  'the already-dug gate lives in doAction — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvcandug-init')) {
      sessionStorage.setItem('hvcandug-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-song');
      localStorage.removeItem('hv-capsule');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    saveHvSong({ plays: 3 });
    saveHvCan({ digs: 1 });
    canDug = true;
    return {
      buried: canBuried(),
      dish: canDish(),
      dug: canDug,
      label: ACTIONS.find(a => a.id === 'can') && ACTIONS.find(a => a.id === 'can').label,
    };
  });
  ok(boot.buried && boot.dish === 11 && boot.dug,
    `a buried can that already got its dig still dishes 11 (${boot.dish})`);
  ok(boot.label === 'Dig Up the Coffee Can',
    `the row is still Dig Up the Coffee Can (${boot.label})`);

  const dug = await page.evaluate(() => {
    const a = ACTIONS.find(x => x.id === 'can');
    saveHvSong({ plays: 3 });
    saveHvCan({ digs: 1 });
    canDug = true;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.can) delete activeJobs.can;
    const before = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    doAction(a);
    const after = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const added = after.filter((line, i) => line !== before[i]).join('\n');
    return {
      job: !!activeJobs.can,
      dug: canDug,
      food: G.food,
      tally: loadHvCan().digs,
      cd: G.cooldowns.can || 0,
      added: added,
      btnOn: !!(document.getElementById('action-can')
        && document.getElementById('action-can').classList.contains('active-job')),
    };
  });
  ok(!dug.job && !dug.btnOn && dug.dug && dug.food === 10
     && dug.tally === 1 && dug.cd === 0,
    `HV-253: an already-dug can does not start the job (job ${dug.job}, food ${dug.food}, digs ${dug.tally})`);
  ok(/dig today|piling keeps/i.test(dug.added),
    `the refuse names the already-dug day — not a silent no-op (${dug.added.slice(-90)})`);

  await page.waitForTimeout(2500);
  const afterWait = await page.evaluate(() => ({
    cd: G.cooldowns.can || 0,
    food: G.food,
    job: !!activeJobs.can,
    dug: canDug,
    tally: loadHvCan().digs,
  }));
  ok(afterWait.cd === 0 && afterWait.food === 10 && !afterWait.job
     && afterWait.dug && afterWait.tally === 1,
    `2.5s later the 30s lock still has not landed (cd ${afterWait.cd})`);

  const rest = await page.evaluate(() => {
    G.health = 70;
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
    `Rest still works after the refuse (health ${rest.health})`);

  const first = await page.evaluate(() => {
    saveHvSong({ plays: 3 });
    saveHvCan({ digs: 0 });
    canDug = false;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.can) delete activeJobs.can;
    finishAction(ACTIONS.find(x => x.id === 'can'));
    return {
      food: G.food,
      dug: canDug,
      tally: loadHvCan().digs,
      cd: G.cooldowns.can || 0,
    };
  });
  ok(first.food === 21 && first.dug && first.tally === 1 && first.cd > Date.now(),
    `a first dig still fills the pot and still takes the lock (food ${first.food}, digs ${first.tally})`);

  const bare = await page.evaluate(() => {
    saveHvSong({ plays: 2 });
    saveHvCan({ digs: 4 });
    canDug = false;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.can) delete activeJobs.can;
    finishAction(ACTIONS.find(x => x.id === 'can'));
    return {
      buried: canBuried(),
      food: G.food,
      dug: canDug,
      tally: loadHvCan().digs,
    };
  });
  ok(!bare.buried && bare.food === 10 && !bare.dug && bare.tally === 4,
    `two playings still refuse (buried ${bare.buried}, digs ${bare.tally})`);

  const trade = await page.evaluate(() => {
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
