/*
 * HV-250 — Sit in the Dry Corner said once a session, then a
 * second click still ran the job.
 *
 * The tooltip says sit in it once a session. finishAction already
 * logs "Somebody has already had their hour in the dry corner
 * tonight — the roof keeps, and so does the habit." and no-ops.
 * Clicking the corner after drySat still started the 2s job and
 * charged the 30s lock as if somebody sat down again — the button
 * only picks up drySat on the next buildActionUI(), and the payout
 * branch in finishAction never calls it.
 *
 * Distinct from HV-220 / #914 (the corner not yet roofed for lack
 * of scraps/cardboard) and HV-249 / #944 (the fire story already
 * told, same bug class, different button). This ticket is the sit
 * after it already got its hour. ui.js is not this ticket — the
 * gate belongs beside doAction's other "once a session" refusals.
 *
 *  A. Source: doAction names the drySat gate before setTimeout,
 *     only once the corner is built. The refuse log still says the
 *     roof keeps. ui.js is not this ticket.
 *  B. A roofed corner that already had its sit: no job, no extra
 *     tally, no food, and no cooldown even after the old 2s timer
 *     would have fired. The log names the already-sat night.
 *  C. Rest still works after the refuse.
 *  D. A first sit still fills the pot and stamps drySat. Two sits
 *     still refuse. Trade still refuses a short purse.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives doAction + finishAction via dryAction(), the
 * one button that changes what it is once the roof goes on — 'dry'
 * is not a static ACTIONS row.
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
const dryAt = doBlock.indexOf("a.id==='dry'");
const satAt = doBlock.indexOf('drySat');

ok(/Sit in it once a session/.test(cfg),
  'the Dry Corner tooltip still promises one sit a session');
ok(/already had their hour in the dry corner tonight/.test(finishBlock)
   && /roof keeps, and so does the habit/.test(finishBlock),
  'the refuse log still names the already-sat night');
ok(/drySat=true/.test(finishBlock) && /dryDish\(\)/.test(finishBlock),
  'the pay branch still stamps drySat and spends dryDish()');
ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(dryAt >= 0 && satAt >= 0 && dryAt < timeoutAt && satAt < timeoutAt
   && /dryBuilt\(\)/.test(doBlock),
  'HV-250: doAction refuses a roofed already-sat corner before the timer');
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
    if (!sessionStorage.getItem('hvdrysat-init')) {
      sessionStorage.setItem('hvdrysat-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-mark');
      localStorage.removeItem('hv-drycorner');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    saveHvMark({ names: 3 });
    saveHvDry({ built: true, sits: 1 });
    drySat = true;
    const a = dryAction();
    return { built: dryBuilt(), dish: dryDish(), sat: drySat, id: a.id, label: a.label };
  });
  ok(boot.built && boot.dish > 0 && boot.sat,
    `a roofed corner that already had its sit still dishes ${boot.dish}`);
  ok(boot.id === 'dry' && boot.label === 'Sit in the Dry Corner',
    `dryAction() still reads Sit in the Dry Corner once roofed (${boot.label})`);

  const sat = await page.evaluate(() => {
    saveHvMark({ names: 3 });
    saveHvDry({ built: true, sits: 1 });
    drySat = true;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.dry) delete activeJobs.dry;
    const before = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    doAction(dryAction());
    const after = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const added = after.filter((line, i) => line !== before[i]).join('\n');
    return {
      job: !!activeJobs.dry,
      sat: drySat,
      food: G.food,
      tally: loadHvDry().sits,
      cd: G.cooldowns.dry || 0,
      added: added,
      btnOn: !!(document.getElementById('action-dry')
        && document.getElementById('action-dry').classList.contains('active-job')),
    };
  });
  ok(!sat.job && !sat.btnOn && sat.sat && sat.food === 10
     && sat.tally === 1 && sat.cd === 0,
    `HV-250: an already-sat corner does not start the job (job ${sat.job}, food ${sat.food}, sits ${sat.tally})`);
  ok(/already had their hour|roof keeps/i.test(sat.added),
    `the refuse names the already-sat night — not a silent no-op (${sat.added.slice(-90)})`);

  await page.waitForTimeout(2500);
  const afterWait = await page.evaluate(() => ({
    cd: G.cooldowns.dry || 0,
    food: G.food,
    job: !!activeJobs.dry,
    sat: drySat,
    tally: loadHvDry().sits,
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
    saveHvMark({ names: 3 });
    saveHvDry({ built: true, sits: 0 });
    drySat = false;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.dry) delete activeJobs.dry;
    finishAction(dryAction());
    return {
      food: G.food,
      sat: drySat,
      tally: loadHvDry().sits,
      cd: G.cooldowns.dry || 0,
    };
  });
  ok(first.food > 10 && first.sat && first.tally === 1 && first.cd > Date.now(),
    `a first sit still fills the pot and still takes the lock (food ${first.food}, sits ${first.tally})`);

  const again = await page.evaluate(() => {
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.dry) delete activeJobs.dry;
    finishAction(dryAction());
    return { food: G.food, sat: drySat, tally: loadHvDry().sits };
  });
  ok(again.food === 10 && again.sat && again.tally === 1,
    `two sits still refuse (food ${again.food}, sits ${again.tally})`);

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
