/* HV-101 — Wave Marisol Down locked 30s when the bridge had no story.
 *
 * The tooltip says wave her down and she leaves a casserole. A fresh
 * camp has no record and no note. HV-61 taught Trade to refuse in
 * doAction before the timer. Read the Wall is someone else's ticket.
 * Wave Marisol Down never got that lesson. Click it on a storyless
 * bridge: a 2-second job starts, finishAction logs "the tow truck
 * rolls past without slowing", then the button locks for the full
 * 30-second cooldown a real casserole earns.
 *
 * Not HV-40 (the visit itself — hvmarisol B already proves a
 * storyless finishAction refuses). Not HV-61 (those four cost gates).
 * Not HV-98 (#771, Read the Wall). This is the truck.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: doAction refuses !marisolHasStory() before setTimeout.
 *    ui.js is not touched.
 * B. Behaviour: click Wave Marisol Down on a storyless bridge —
 *    immediate refuse, no job, no cooldown after the old 2s timer
 *    would have fired, visits stay 0. A bridge with a story still
 *    pays the casserole and still takes the lock. Trade still
 *    refuses a short purse (HV-61).
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
const mariAt = doBlock.indexOf("a.id==='marisol'");

ok(doAt >= 0 && timeoutAt > 0,
  'doAction is still in player.js and still starts the job with setTimeout');
ok(/a\.id==='trade'/.test(doBlock) && doBlock.indexOf("a.id==='trade'") < timeoutAt,
  'Trade still refuses before the timer — the pattern this ticket copies');
ok(mariAt >= 0 && mariAt < timeoutAt && /marisolHasStory/.test(doBlock),
  'HV-101: doAction refuses a storyless wave before the timer starts');
ok(/tow truck rolls past/.test(doBlock),
  'the refuse is the same line finishAction already used');
ok(!/marisolHasStory/.test(ui) && !/tow truck rolls past/.test(ui),
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
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-letter');
      localStorage.removeItem('hv-plaque');
      localStorage.removeItem('hv-visitor');
    } catch (e) {}
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => ({
    intro: !!(document.getElementById('intro-modal') && document.getElementById('intro-modal').classList.contains('open')),
    btn: !!document.getElementById('action-marisol'),
    story: typeof marisolHasStory === 'function' && marisolHasStory(),
    cd: ACTIONS.find(a => a.id === 'marisol').cooldown,
    time: ACTIONS.find(a => a.id === 'marisol').time,
  }));
  ok(!boot.intro && boot.btn && !boot.story,
    'a returning camp has Wave Marisol Down on the bar, and the bridge has no story');
  ok(boot.cd === 30000 && boot.time === 2000,
    `Wave Marisol Down is still a 2s job with a 30s lock (${boot.time}/${boot.cd})`);

  const cold = await page.evaluate(() => {
    G.cooldowns = {};
    const heard = [];
    const prev = log;
    log = function (msg) { heard.push(String(msg)); prev(msg); };
    doAction(ACTIONS.find(a => a.id === 'marisol'));
    log = prev;
    const btn = document.getElementById('action-marisol');
    return {
      job: !!activeJobs.marisol,
      cd: G.cooldowns.marisol || 0,
      visits: loadMarisol().visits,
      btnOn: !!(btn && btn.classList.contains('active-job')),
      log: heard.join(' '),
    };
  });
  ok(!cold.job && !cold.btnOn,
    'a storyless wave does not start a job — the button is not active-job');
  ok(cold.cd === 0 && cold.visits === 0,
    `a storyless wave takes no cooldown and no visit (cd ${cold.cd}, visits ${cold.visits})`);
  ok(/tow truck rolls past/.test(cold.log),
    'the refuse is the same line finishAction already used — named, not silent');

  await page.waitForTimeout(2500);
  const afterWait = await page.evaluate(() => ({
    cd: G.cooldowns.marisol || 0,
    visits: loadMarisol().visits,
    job: !!activeJobs.marisol,
  }));
  ok(afterWait.cd === 0 && afterWait.visits === 0 && !afterWait.job,
    `2.5s later the 30s lock still has not landed (cd ${afterWait.cd}) — reverting the guard fails this by name`);

  const story = await page.evaluate(() => {
    saveHvRec({ days: 14, beats: 1 });
    saveHvStar({ cheers: 0 });
    G.cooldowns = {};
    G.food = 10;
    finishAction(ACTIONS.find(a => a.id === 'marisol'));
    return {
      has: marisolHasStory(),
      visits: loadMarisol().visits,
      food: G.food,
      cd: G.cooldowns.marisol || 0,
    };
  });
  ok(story.has && story.visits === 1 && story.food === 12 && story.cd > Date.now(),
    `a bridge with a story still pays the casserole and still takes the lock (visits ${story.visits}, food ${story.food})`);

  const trade = await page.evaluate(() => {
    G.cans = 0; G.food = 10; G.cooldowns = {};
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
