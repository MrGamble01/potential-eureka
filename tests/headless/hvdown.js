/*
 * HV-219 — Walk a Newcomer Down ran a job when nobody walks the wall yet.
 *
 * The tooltip: three stands at the fifth panel and somebody starts
 * walking every newcomer down. finishAction already refused two stands
 * ("Nobody walks the wall yet"). doAction still started the 2s job,
 * played the success blip, and locked the button 30s as if the walk
 * had paid.
 *
 * Reunion, the coffee can, Snapshot, and Anniversary are not this card.
 * Add a Name is not this card.
 *
 *  A. Source: doAction refuses walk before setTimeout.
 *  B. The card still asks for three stands.
 *  C. Two stands do not start a job or take the 30s lock.
 *  D. 2.5s later the lock still has not landed.
 *  E. Three stands still fill the pot (finishAction).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives doAction / finishAction on the production row.
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
const timeoutAt = doBlock.indexOf('setTimeout');
const walkAt = doBlock.indexOf("a.id==='walk'");

ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(walkAt >= 0 && walkAt < timeoutAt && /!walkUp\(\)/.test(doBlock),
  'HV-219: doAction refuses Walk a Newcomer Down before the timer when nobody walks the wall');
ok(/three stands at the fifth panel/.test(config),
  'the card still asks for three stands at the fifth panel');
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
    if (!sessionStorage.getItem('hvdown-init')) {
      sessionStorage.setItem('hvdown-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-mural');
      localStorage.removeItem('hv-docent');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const two = await t(() => {
    saveHvPanel({ stands: 2 });
    saveHvWalk({ walks: 0 });
    walkGiven = false;
    G.food = 10;
    G.cooldowns = {};
    doAction(ACTIONS.find(x => x.id === 'walk'));
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      up: walkUp(),
      job: !!activeJobs.walk,
      cd: G.cooldowns.walk || 0,
      food: G.food,
      walks: loadHvWalk().walks,
      log,
      btnOn: !!(document.getElementById('action-walk')
        && document.getElementById('action-walk').classList.contains('active-job')),
    };
  });
  ok(!two.up, 'two stands still start no walk');
  ok(!two.job && !two.btnOn,
    'two stands do not start a job — the button is not active-job');
  ok(two.cd === 0 && two.food === 10 && two.walks === 0,
    `two stands take no cooldown and do not fill the pot (cd ${two.cd}, food ${two.food})`);
  ok(/Nobody walks the wall yet/.test(two.log),
    'the refuse is the same line finishAction already used');

  await page.waitForTimeout(2500);
  const afterWait = await t(() => ({
    cd: G.cooldowns.walk || 0,
    food: G.food,
    job: !!activeJobs.walk,
    walks: loadHvWalk().walks,
  }));
  ok(afterWait.cd === 0 && afterWait.food === 10 && !afterWait.job && afterWait.walks === 0,
    `2.5s later the 30s lock still has not landed (cd ${afterWait.cd})`);

  const three = await t(() => {
    saveHvPanel({ stands: 3 });
    saveHvWalk({ walks: 0 });
    walkGiven = false;
    G.food = 10;
    G.cooldowns = {};
    finishAction(ACTIONS.find(x => x.id === 'walk'));
    return {
      up: walkUp(),
      food: G.food,
      walks: loadHvWalk().walks,
      cd: G.cooldowns.walk || 0,
    };
  });
  ok(three.up && three.food > 10 && three.walks === 1 && three.cd > Date.now(),
    `three stands still fill the pot and still take the lock (food ${three.food}, walks ${three.walks})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
