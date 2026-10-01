/*
 * HV-244 — Sit on the Bench said once a session, then a
 * second click still ran the job.
 *
 * The tooltip says Sit once a session. finishAction already
 * logs "The bench got its sit today — the seat keeps." and
 * no-ops. Clicking 🪑 after benchSat still started the 2s
 * job and charged the 30s lock as if somebody sat down with
 * something warm again.
 *
 * Distinct from HV-222 / #916 (no bench stood by the fridge),
 * HV-242 / #937 (the notebook already got its leaf), HV-238 /
 * #933 (the reunion already went off), HV-113 / #797 (the sit
 * only paid food). This ticket is the bench after it already
 * got its sit. ui.js is not this ticket.
 *
 *  A. Source: doAction names the benchSat gate before
 *     setTimeout, only when the bench is built. The refuse
 *     log still says the seat keeps. ui.js is not this ticket.
 *  B. A built bench that already got its sit: no job, no
 *     extra tally, no food, and no cooldown even after the
 *     old 2s timer would have fired. The log names the
 *     already-sat seat.
 *  C. Rest still works after the refuse.
 *  D. A first sit still fills the pot and stamps benchSat.
 *     Two leafs still refuse. Trade still refuses a short
 *     purse.
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
const benchAt = doBlock.indexOf("a.id==='bench'");
const satAt = doBlock.indexOf('benchSat');

ok(/Sit once a session/.test(cfg) && /something warm/.test(cfg),
  'Sit on the Bench still promises one sit a session');
ok(/got its sit today/.test(finishBlock) && /the seat keeps/.test(finishBlock),
  'the refuse log still names the already-sat seat');
ok(/sit on the bench by the fridge/.test(finishBlock) && /something warm/.test(finishBlock),
  'the pay log still fills the pot from somebody sitting down');
ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(benchAt >= 0 && satAt >= 0 && benchAt < timeoutAt && satAt < timeoutAt
   && /hvBenchBuilt\(\)/.test(doBlock),
  'HV-244: doAction refuses a built already-sat bench before the timer');
ok(!/homeless-village\/js\/ui\.js/.test(player),
  'the already-sat gate lives in doAction — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvbenchsat-init')) {
      sessionStorage.setItem('hvbenchsat-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-guestbook');
      localStorage.removeItem('hv-bench');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    saveHvGb({ leafs: 3 });
    saveHvBench({ sits: 1 });
    benchSat = true;
    return {
      built: hvBenchBuilt(),
      dish: hvBenchDish(),
      sat: benchSat,
      label: ACTIONS.find(a => a.id === 'bench') && ACTIONS.find(a => a.id === 'bench').label,
    };
  });
  ok(boot.built && boot.dish === 8 && boot.sat,
    `a built bench that already got its sit still dishes 8 (${boot.dish})`);
  ok(boot.label === 'Sit on the Bench',
    `the row is still Sit on the Bench (${boot.label})`);

  const sat = await page.evaluate(() => {
    const a = ACTIONS.find(x => x.id === 'bench');
    saveHvGb({ leafs: 3 });
    saveHvBench({ sits: 1 });
    benchSat = true;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.bench) delete activeJobs.bench;
    const before = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    doAction(a);
    const after = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const added = after.filter((line, i) => line !== before[i]).join('\n');
    return {
      job: !!activeJobs.bench,
      sat: benchSat,
      food: G.food,
      tally: loadHvBench().sits,
      cd: G.cooldowns.bench || 0,
      added: added,
      btnOn: !!(document.getElementById('action-bench')
        && document.getElementById('action-bench').classList.contains('active-job')),
    };
  });
  ok(!sat.job && !sat.btnOn && sat.sat && sat.food === 10
     && sat.tally === 1 && sat.cd === 0,
    `HV-244: an already-sat bench does not start the job (job ${sat.job}, food ${sat.food}, sits ${sat.tally})`);
  ok(/sit today|seat keeps/i.test(sat.added),
    `the refuse names the already-sat seat — not a silent no-op (${sat.added.slice(-90)})`);

  await page.waitForTimeout(2500);
  const afterWait = await page.evaluate(() => ({
    cd: G.cooldowns.bench || 0,
    food: G.food,
    job: !!activeJobs.bench,
    sat: benchSat,
    tally: loadHvBench().sits,
  }));
  ok(afterWait.cd === 0 && afterWait.food === 10 && !afterWait.job
     && afterWait.sat && afterWait.tally === 1,
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
    saveHvGb({ leafs: 3 });
    saveHvBench({ sits: 0 });
    benchSat = false;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.bench) delete activeJobs.bench;
    finishAction(ACTIONS.find(x => x.id === 'bench'));
    return {
      food: G.food,
      sat: benchSat,
      tally: loadHvBench().sits,
      cd: G.cooldowns.bench || 0,
    };
  });
  ok(first.food === 18 && first.sat && first.tally === 1 && first.cd > Date.now(),
    `a first sit still fills the pot and still takes the lock (food ${first.food}, sits ${first.tally})`);

  const bare = await page.evaluate(() => {
    saveHvGb({ leafs: 2 });
    saveHvBench({ sits: 4 });
    benchSat = false;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.bench) delete activeJobs.bench;
    finishAction(ACTIONS.find(x => x.id === 'bench'));
    return {
      built: hvBenchBuilt(),
      food: G.food,
      sat: benchSat,
      tally: loadHvBench().sits,
    };
  });
  ok(!bare.built && bare.food === 10 && !bare.sat && bare.tally === 4,
    `two leafs still refuse (built ${bare.built}, sits ${bare.tally})`);

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
