/*
 * HV-148 — Pass the Thermos ran a job when the thermos was cold.
 *
 * The 🫖 row sits on the action bar from day one. The tooltip says
 * pass it around once a session — the deeper the bridge's memory,
 * the further the coffee goes. A fresh camp has no record and no
 * fridge-door note, so thermosHasWarmth() is false. Clicking it
 * still started the 2-second job, then finishAction logged
 * "the thermos is cold" and charged the full 30-second cooldown
 * as if the coffee had gone around.
 *
 * Trade / Rain Bet / Garage / Fridge already refuse in doAction
 * (HV-61). The thermos did not.
 *
 * Distinct from #800 (coffee / warmth on a successful pass) and
 * #761 (dawn never rearmed thermosUsed). This ticket is the cold
 * miss charging the lock. ui.js is not this ticket.
 *
 *  A. Source: doAction names thermosHasWarmth before setTimeout.
 *  B. Fresh camp click: no job, no cooldown, same cold line.
 *  C. 2.5s later the 30s lock still has not landed.
 *  D. A warm thermos still starts the job; finishAction still pays.
 *  Z. Zero page errors.
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
const thermosAt = doBlock.indexOf("a.id==='thermos'");

ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(thermosAt >= 0 && thermosAt < timeoutAt && /thermosHasWarmth/.test(doBlock),
  'HV-148: doAction refuses a cold thermos before the timer');
ok(/homeless-village\/js\/ui\.js/.test(player) === false,
  'the refuse lives in doAction — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvthcold-init')) {
      sessionStorage.setItem('hvthcold-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-fridge');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-letter');
      localStorage.removeItem('hv-thermos');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => ({
    btn: !!document.getElementById('action-thermos'),
    warm: thermosHasWarmth(),
    time: ACTIONS.find(a => a.id === 'thermos').time,
    cd: ACTIONS.find(a => a.id === 'thermos').cooldown,
  }));
  ok(boot.btn && boot.warm === false,
    'a fresh camp has Pass the Thermos on the bar and the thermos is cold');
  ok(boot.time === 2000 && boot.cd === 30000,
    `the thermos is still a 2s job with a 30s lock (${boot.time}/${boot.cd})`);

  const cold = await page.evaluate(() => {
    G.cooldowns = {};
    thermosUsed = false;
    doAction(ACTIONS.find(a => a.id === 'thermos'));
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      job: !!activeJobs.thermos,
      cd: G.cooldowns.thermos || 0,
      uses: loadThermos().uses,
      log: log,
      btnOn: document.getElementById('action-thermos')
        && document.getElementById('action-thermos').classList.contains('active-job'),
    };
  });
  ok(!cold.job && !cold.btnOn,
    'HV-148: a cold thermos does not start a job — the button is not active-job');
  ok(cold.cd === 0 && cold.uses === 0,
    `HV-148: a cold thermos takes no cooldown and no use (cd ${cold.cd}, uses ${cold.uses})`);
  ok(/thermos is cold/.test(cold.log),
    'the refuse is the same line finishAction already used — named, not silent');

  await page.waitForTimeout(2500);
  const afterWait = await page.evaluate(() => ({
    cd: G.cooldowns.thermos || 0,
    job: !!activeJobs.thermos,
    uses: loadThermos().uses,
  }));
  ok(afterWait.cd === 0 && !afterWait.job && afterWait.uses === 0,
    `HV-148: 2.5s later the 30s lock still has not landed (cd ${afterWait.cd})`);

  const warm = await page.evaluate(() => {
    saveHvRec({ days: 8, beats: 1 });
    saveHvNote({ read: 1 });
    G.morale = 50;
    G.cooldowns = {};
    thermosUsed = false;
    const started = (function () {
      doAction(ACTIONS.find(a => a.id === 'thermos'));
      return !!activeJobs.thermos;
    })();
    if (activeJobs.thermos) delete activeJobs.thermos;
    G.cooldowns = {};
    finishAction(ACTIONS.find(a => a.id === 'thermos'));
    return {
      started: started,
      warm: thermosHasWarmth(),
      morale: G.morale,
      uses: loadThermos().uses,
      used: thermosUsed,
    };
  });
  ok(warm.warm && warm.started,
    'HV-148: a warm thermos still starts the job');
  ok(warm.morale > 50 && warm.uses === 1 && warm.used,
    `a funded pass still pays and still marks the session (${warm.morale}, uses ${warm.uses})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
