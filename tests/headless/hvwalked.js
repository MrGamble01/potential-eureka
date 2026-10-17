/*
 * HV-285 — Walk a Newcomer Down said once a session, then a
 * second click still ran the job.
 *
 * The tooltip says do it once a session. finishAction already
 * logs "Somebody already got the walk tonight — the next
 * newcomer gets theirs tomorrow." and no-ops. Clicking 🧭
 * after walkGiven still started the 2s job and charged the
 * 30s lock as if the next newcomer had already been walked.
 *
 * Distinct from HV-219 / #912 (nobody walks the wall yet),
 * HV-133 (first-night copy), HV-249 / #944 (the fire story
 * already got its telling), HV-250 / #983 (the dry corner
 * already got its sit). This ticket is the walk after
 * somebody already got it tonight. ui.js is not this ticket.
 *
 *  A. Source: doAction names the walkGiven gate before
 *     setTimeout, only when the walk is up. The refuse log
 *     still says the next newcomer gets theirs tomorrow.
 *  B. A walk that already went out tonight: no job, no extra
 *     tally, no food, and no cooldown even after the old 2s
 *     timer would have fired. The log names the already-walked
 *     night.
 *  C. Rest still works after the refuse.
 *  D. A first walk still fills the pot and stamps walkGiven.
 *     Two panel stands still refuse. Trade still refuses a
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
const walkAt = doBlock.indexOf("a.id==='walk'");
const givenAt = doBlock.indexOf('walkGiven');

ok(/Do it once a session/.test(cfg) && /stop being a stranger by morning/.test(cfg),
  'Walk a Newcomer Down still promises one walk a session');
ok(/already got the walk tonight/.test(finishBlock) && /next newcomer gets theirs tomorrow/.test(finishBlock),
  'the refuse log still names the already-walked night');
ok(/THE WALK DOWN/.test(finishBlock) && /stop being a stranger by morning/.test(finishBlock),
  'the pay log still fills the pot when they stop being a stranger');
ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(walkAt >= 0 && givenAt >= 0 && walkAt < timeoutAt && givenAt < timeoutAt
   && /walkUp\(\)/.test(doBlock),
  'HV-285: doAction refuses an already-given walk before the timer');
ok(!/homeless-village\/js\/ui\.js/.test(player),
  'the already-walked gate lives in doAction — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvwalked-init')) {
      sessionStorage.setItem('hvwalked-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-mural');
      localStorage.removeItem('hv-docent');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    saveHvPanel({ stands: 3 });
    saveHvWalk({ walks: 1 });
    walkGiven = true;
    return {
      up: walkUp(),
      dish: walkDish(),
      given: walkGiven,
      label: ACTIONS.find(a => a.id === 'walk') && ACTIONS.find(a => a.id === 'walk').label,
    };
  });
  ok(boot.up && boot.dish === 13 && boot.given,
    `a walk that already went out tonight still dishes 13 (${boot.dish})`);
  ok(boot.label === 'Walk a Newcomer Down',
    `the row is still Walk a Newcomer Down (${boot.label})`);

  const given = await page.evaluate(() => {
    const a = ACTIONS.find(x => x.id === 'walk');
    saveHvPanel({ stands: 3 });
    saveHvWalk({ walks: 1 });
    walkGiven = true;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.walk) delete activeJobs.walk;
    const before = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    doAction(a);
    const after = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const added = after.filter((line, i) => line !== before[i]).join('\n');
    return {
      job: !!activeJobs.walk,
      given: walkGiven,
      food: G.food,
      tally: loadHvWalk().walks,
      cd: G.cooldowns.walk || 0,
      added: added,
      btnOn: !!(document.getElementById('action-walk')
        && document.getElementById('action-walk').classList.contains('active-job')),
    };
  });
  ok(!given.job && !given.btnOn && given.given && given.food === 10
     && given.tally === 1 && given.cd === 0,
    `HV-285: an already-given walk does not start the job (job ${given.job}, food ${given.food}, walks ${given.tally})`);
  ok(/already got the walk tonight|next newcomer gets theirs tomorrow/i.test(given.added),
    `the refuse names the already-walked night — not a silent no-op (${given.added.slice(-90)})`);

  await page.waitForTimeout(2500);
  const afterWait = await page.evaluate(() => ({
    cd: G.cooldowns.walk || 0,
    food: G.food,
    job: !!activeJobs.walk,
    given: walkGiven,
    tally: loadHvWalk().walks,
  }));
  ok(afterWait.cd === 0 && afterWait.food === 10 && !afterWait.job
     && afterWait.given && afterWait.tally === 1,
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
    saveHvPanel({ stands: 3 });
    saveHvWalk({ walks: 0 });
    walkGiven = false;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.walk) delete activeJobs.walk;
    finishAction(ACTIONS.find(x => x.id === 'walk'));
    return {
      food: G.food,
      given: walkGiven,
      tally: loadHvWalk().walks,
      cd: G.cooldowns.walk || 0,
    };
  });
  ok(first.food === 23 && first.given && first.tally === 1 && first.cd > Date.now(),
    `a first walk still fills the pot and still takes the lock (food ${first.food}, walks ${first.tally})`);

  const bare = await page.evaluate(() => {
    saveHvPanel({ stands: 2 });
    saveHvWalk({ walks: 4 });
    walkGiven = false;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.walk) delete activeJobs.walk;
    finishAction(ACTIONS.find(x => x.id === 'walk'));
    return {
      up: walkUp(),
      food: G.food,
      given: walkGiven,
      tally: loadHvWalk().walks,
    };
  });
  ok(!bare.up && bare.food === 10 && !bare.given && bare.tally === 4,
    `two panel stands still refuse (up ${bare.up}, walks ${bare.tally})`);

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
