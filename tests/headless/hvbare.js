/* HV-98 — Read the Wall locked 30s when the wall was bare.
 *
 * The tooltip says read the chalked numbers out. A fresh camp has
 * none. HV-61 taught Trade / Rain Bet / Garage / Fridge to refuse in
 * doAction before the timer. Read the Wall never got that lesson.
 * Click it on a bare bridge: a 2-second job starts, finishAction
 * logs "The wall is bare — this bridge has no story yet.", then the
 * button locks for the full 30-second cooldown a real reading earns.
 *
 * Not HV-34 (the writing itself — hvwall B already proves a bare
 * finishAction refuses). Not HV-61 (those four cost gates). Not
 * HV-77 (#739, Borrow from Ray). This is the wall.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: doAction refuses !bridgeHasWall() before setTimeout,
 *    same shape as Trade. ui.js is not touched.
 * B. Behaviour: click Read the Wall on a bare bridge — immediate
 *    refuse, no job, no cooldown after the old 2s timer would have
 *    fired, opens stay 0. A chalked wall still reads and still
 *    takes the lock. Trade still refuses a short purse (HV-61).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui     = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const doAt = player.indexOf('function doAction(a){');
const finishAt = player.indexOf('function finishAction(a){');
const doBlock = doAt >= 0 && finishAt > doAt ? player.slice(doAt, finishAt) : '';
const timeoutAt = doBlock.indexOf('setTimeout');
const wallAt = doBlock.indexOf("a.id==='wall'");

ok(doAt >= 0 && timeoutAt > 0,
  'doAction is still in player.js and still starts the job with setTimeout');
ok(/a\.id==='trade'/.test(doBlock) && doBlock.indexOf("a.id==='trade'") < timeoutAt,
  'Trade still refuses before the timer — the pattern this ticket copies');
ok(wallAt >= 0 && wallAt < timeoutAt && /bridgeHasWall/.test(doBlock),
  'HV-98: doAction refuses a bare wall before the timer starts');
ok(/The wall is bare/.test(doBlock),
  'the refuse is the same line finishAction already used');
ok(!/bridgeHasWall/.test(ui) && !/The wall is bare/.test(ui),
  'ui.js is not this ticket — it still only draws the action row');

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
    try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {}
    try {
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-fridge');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-letter');
      localStorage.removeItem('hv-history');
    } catch (e) {}
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => ({
    intro: !!(document.getElementById('intro-modal') && document.getElementById('intro-modal').classList.contains('open')),
    btn: !!document.getElementById('action-wall'),
    bare: !bridgeHasWall(),
    cd: ACTIONS.find(a => a.id === 'wall').cooldown,
    time: ACTIONS.find(a => a.id === 'wall').time,
  }));
  ok(!boot.intro && boot.btn && boot.bare,
    'a returning camp has Read the Wall on the bar, and the bridge is bare');
  ok(boot.cd === 30000 && boot.time === 2000,
    `Read the Wall is still a 2s job with a 30s lock (${boot.time}/${boot.cd})`);

  const bare = await page.evaluate(() => {
    G.cooldowns = {};
    const heard = [];
    const prev = log;
    log = function (msg) { heard.push(String(msg)); prev(msg); };
    doAction(ACTIONS.find(a => a.id === 'wall'));
    log = prev;
    const btn = document.getElementById('action-wall');
    return {
      job: !!activeJobs.wall,
      cd: G.cooldowns.wall || 0,
      opens: loadHvWall().opens,
      btnOn: !!(btn && btn.classList.contains('active-job')),
      log: heard.join(' '),
    };
  });
  ok(!bare.job && !bare.btnOn,
    'a bare wall does not start a job — the button is not active-job');
  ok(bare.cd === 0 && bare.opens === 0,
    `a bare wall takes no cooldown and no tally (cd ${bare.cd}, opens ${bare.opens})`);
  ok(/The wall is bare/.test(bare.log),
    'the refuse is the same line finishAction already used — named, not silent');

  await page.waitForTimeout(2500);
  const afterWait = await page.evaluate(() => ({
    cd: G.cooldowns.wall || 0,
    opens: loadHvWall().opens,
    job: !!activeJobs.wall,
  }));
  ok(afterWait.cd === 0 && afterWait.opens === 0 && !afterWait.job,
    `2.5s later the 30s lock still has not landed (cd ${afterWait.cd}) — reverting the guard fails this by name`);

  const chalked = await page.evaluate(() => {
    saveFridge({ built: true, camps: 3 });
    saveHvRec({ days: 14, beats: 2 });
    saveHvNote({ read: 2 });
    G.cooldowns = {};
    finishAction(ACTIONS.find(a => a.id === 'wall'));
    return {
      has: bridgeHasWall(),
      opens: loadHvWall().opens,
      cd: G.cooldowns.wall || 0,
    };
  });
  ok(chalked.has && chalked.opens === 1 && chalked.cd > Date.now(),
    `a chalked wall still reads and still takes the lock (opens ${chalked.opens})`);

  const trade = await page.evaluate(() => {
    G.cans = 0; G.food = 0; G.cooldowns = {};
    doAction(ACTIONS.find(a => a.id === 'trade'));
    return { job: !!activeJobs.trade, cd: G.cooldowns.trade || 0, cans: G.cans };
  });
  ok(!trade.job && trade.cd === 0 && trade.cans === 0,
    'HV-61 isolation: broke Trade still refuses before the timer');

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
