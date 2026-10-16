/*
 * HV-238 — Throw the Reunion said once a session, then a
 * second click still ran the job.
 *
 * The tooltip says the camp throws the bridge reunion once a
 * session. finishAction already logs "The reunion already went
 * off today — people have places to be." and no-ops. Clicking
 * 🎂 after bridgeReunionHeld still started the 2s job and
 * charged the 30s lock as if everyone came back through again.
 *
 * Distinct from HV-218 / #911 (the whole story wasn't standing),
 * HV-230 / #924 (the snapshot already got its look), HV-227 /
 * #921 (Marisol already came by), HV-236 / #931 (the thermos
 * already made its round), and HV-237 / #932 (scrapyard vs
 * rain). This ticket is the standing reunion after it already
 * went off. ui.js is not this ticket.
 *
 *  A. Source: doAction names the bridgeReunionHeld gate before
 *     setTimeout, only when the whole story stands. The refuse
 *     log still says people have places to be. ui.js is not
 *     this ticket.
 *  B. A standing reunion that already went off: no job, no
 *     extra tally, no food, and no cooldown even after the old
 *     2s timer would have fired. The log names the already-
 *     thrown party.
 *  C. Rest still works after the refuse.
 *  D. A first throw still fills the pot and stamps
 *     bridgeReunionHeld. A half story still refuses. Trade
 *     still refuses a short purse.
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
const reunionAt = doBlock.indexOf("a.id==='reunion'");
const heldAt = doBlock.indexOf('bridgeReunionHeld');

ok(/throws the bridge reunion once a session/.test(cfg) && /comes back through/.test(cfg),
  'Throw the Reunion still promises one party a session');
ok(/already went off today/.test(finishBlock) && /places to be/.test(finishBlock),
  'the refuse log still names the already-thrown party');
ok(/THE BRIDGE REUNION/.test(finishBlock) && /something for the pot/.test(finishBlock),
  'the pay log still fills the pot from everyone who comes back');
ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(reunionAt >= 0 && heldAt >= 0 && reunionAt < timeoutAt && heldAt < timeoutAt
   && /hvReunionStands\(\)/.test(doBlock),
  'HV-238: doAction refuses a standing already-thrown reunion before the timer');
ok(!/homeless-village\/js\/ui\.js/.test(player),
  'the already-thrown gate lives in doAction — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvreunionheld-init')) {
      sessionStorage.setItem('hvreunionheld-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-plaque');
      localStorage.removeItem('hv-visitor');
      localStorage.removeItem('hv-reunion');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    saveHvStar({ cheers: 3 });
    saveMarisol({ visits: 3 });
    saveHvReunion({ held: 1 });
    bridgeReunionHeld = true;
    return {
      stands: hvReunionStands(),
      dish: hvReunionDish(),
      held: bridgeReunionHeld,
      label: ACTIONS.find(a => a.id === 'reunion') && ACTIONS.find(a => a.id === 'reunion').label,
    };
  });
  ok(boot.stands && boot.dish === 8 && boot.held,
    `a standing reunion that already went off still dishes 8 (${boot.dish})`);
  ok(boot.label === 'Throw the Reunion',
    `the row is still Throw the Reunion (${boot.label})`);

  const thrown = await page.evaluate(() => {
    const a = ACTIONS.find(x => x.id === 'reunion');
    saveHvStar({ cheers: 3 });
    saveMarisol({ visits: 3 });
    saveHvReunion({ held: 1 });
    bridgeReunionHeld = true;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.reunion) delete activeJobs.reunion;
    const before = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    doAction(a);
    const after = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const added = after.filter((line, i) => line !== before[i]).join('\n');
    return {
      job: !!activeJobs.reunion,
      held: bridgeReunionHeld,
      food: G.food,
      tally: loadHvReunion().held,
      cd: G.cooldowns.reunion || 0,
      added: added,
      btnOn: !!(document.getElementById('action-reunion')
        && document.getElementById('action-reunion').classList.contains('active-job')),
    };
  });
  ok(!thrown.job && !thrown.btnOn && thrown.held && thrown.food === 10
     && thrown.tally === 1 && thrown.cd === 0,
    `HV-238: an already-thrown reunion does not start the job (job ${thrown.job}, food ${thrown.food}, held ${thrown.tally})`);
  ok(/already went off|places to be/i.test(thrown.added),
    `the refuse names the already-thrown party — not a silent no-op (${thrown.added.slice(-90)})`);

  await page.waitForTimeout(2500);
  const afterWait = await page.evaluate(() => ({
    cd: G.cooldowns.reunion || 0,
    food: G.food,
    job: !!activeJobs.reunion,
    held: bridgeReunionHeld,
    tally: loadHvReunion().held,
  }));
  ok(afterWait.cd === 0 && afterWait.food === 10 && !afterWait.job
     && afterWait.held && afterWait.tally === 1,
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
    saveHvStar({ cheers: 3 });
    saveMarisol({ visits: 3 });
    saveHvReunion({ held: 0 });
    bridgeReunionHeld = false;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.reunion) delete activeJobs.reunion;
    finishAction(ACTIONS.find(x => x.id === 'reunion'));
    return {
      food: G.food,
      held: bridgeReunionHeld,
      tally: loadHvReunion().held,
      cd: G.cooldowns.reunion || 0,
    };
  });
  ok(first.food === 18 && first.held && first.tally === 1 && first.cd > Date.now(),
    `a first throw still fills the pot and still takes the lock (food ${first.food}, held ${first.tally})`);

  const half = await page.evaluate(() => {
    saveHvStar({ cheers: 3 });
    saveMarisol({ visits: 2 });
    saveHvReunion({ held: 4 });
    bridgeReunionHeld = false;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.reunion) delete activeJobs.reunion;
    finishAction(ACTIONS.find(x => x.id === 'reunion'));
    return {
      stands: hvReunionStands(),
      food: G.food,
      held: bridgeReunionHeld,
      tally: loadHvReunion().held,
    };
  });
  ok(!half.stands && half.food === 10 && !half.held && half.tally === 4,
    `a half story still refuses (stands ${half.stands}, held ${half.tally})`);

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
