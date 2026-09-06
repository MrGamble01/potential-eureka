/*
 * HV-98 — Read the Wall ran a job when the wall was bare.
 *
 * HV-61 taught Trade / Rain Bet / Garage / Fridge to refuse in
 * doAction *before* the timer: log, error blip, return. Read the
 * Wall never learned it. The button sits on the rail from day one.
 * A brand-new camp has no fridge, no hold, no note — bridgeHasWall()
 * is false. Clicking 🧱 still started a 2-second job, then
 * finishAction logged "The wall is bare" and locked the button for
 * the full 30-second cooldown — the same lock a real reading earns.
 *
 * Thermos (cold) and Wave Marisol (no story) are the same hole on
 * the next two buttons a new player tries.
 *
 * Distinct from HV-61 (cans / goodwill purse) and HV-77 (#739,
 * Borrow when a loan is already out). Distinct from HV-34 (hvwall
 * drives finishAction and never sees the timer).
 *
 * A. Source: doAction names bridgeHasWall / thermosHasWarmth /
 *    marisolHasStory before setTimeout. ui.js is not this ticket.
 * B. A bare wall: no job, no cooldown after the old 2s would have
 *    fired, same refuse line. A wall with a story still reads.
 * C. A cold thermos and a storyless Marisol wave refuse the same way.
 * Z. Zero page errors.
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

ok(doAt >= 0 && /function doAction\(a\)\{/.test(doBlock),
  'doAction is still in player.js — guards the guard');
ok(/a\.id==='trade'/.test(doBlock) && /G\.cans\s*<\s*3/.test(doBlock),
  'Trade still refuses a short purse before the timer — the pattern this ticket copies');

const timeoutAt = doBlock.indexOf('setTimeout');
ok(timeoutAt > 0, 'doAction still starts the job with setTimeout');

const wallAt = doBlock.indexOf("a.id==='wall'");
ok(wallAt >= 0 && wallAt < timeoutAt && /bridgeHasWall/.test(doBlock),
  'HV-98: doAction refuses Read the Wall when the wall is bare, before the timer');

const thermosAt = doBlock.indexOf("a.id==='thermos'");
ok(thermosAt >= 0 && thermosAt < timeoutAt && /thermosHasWarmth/.test(doBlock),
  'doAction refuses a cold thermos before the timer');

const marisolAt = doBlock.indexOf("a.id==='marisol'");
ok(marisolAt >= 0 && marisolAt < timeoutAt && /marisolHasStory/.test(doBlock),
  'doAction refuses a storyless Marisol wave before the timer');

ok(!/function buildActionUI/.test(doBlock),
  'the refuse gates live in doAction — ui.js is not this ticket');

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
    try {
      localStorage.setItem('hv-intro-seen', '1');
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
    wall: !!document.getElementById('action-wall'),
    has: typeof bridgeHasWall === 'function' && bridgeHasWall(),
    cd: ACTIONS.find(a => a.id === 'wall').cooldown,
    time: ACTIONS.find(a => a.id === 'wall').time,
  }));
  ok(!boot.intro && boot.wall,
    'a returning camp has Read the Wall on the board and is not behind the crash course');
  ok(boot.has === false, 'a fresh camp has a bare wall');
  ok(boot.cd === 30000 && boot.time === 2000,
    `Read the Wall is still a 2s job with a 30s lock (${boot.time}/${boot.cd})`);

  const bare = await page.evaluate(() => {
    G.cooldowns = {};
    delete activeJobs.wall;
    doAction(ACTIONS.find(a => a.id === 'wall'));
    const feed = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    const btn = document.getElementById('action-wall');
    return {
      job: !!activeJobs.wall,
      cd: G.cooldowns.wall || 0,
      opens: loadHvWall().opens,
      feed: feed,
      btnOn: !!(btn && btn.classList.contains('active-job')),
    };
  });
  ok(!bare.job && !bare.btnOn,
    'HV-98: a bare wall does not start a job — the button is not active-job');
  ok(bare.cd === 0 && bare.opens === 0,
    `a bare wall takes no cooldown and no reading (cd ${bare.cd}, opens ${bare.opens})`);
  ok(/wall is bare/.test(bare.feed),
    'the refuse is the same line finishAction already used — named, not silent');

  await page.waitForTimeout(2500);
  const afterWait = await page.evaluate(() => ({
    cd: G.cooldowns.wall || 0,
    job: !!activeJobs.wall,
    opens: loadHvWall().opens,
  }));
  ok(afterWait.cd === 0 && !afterWait.job && afterWait.opens === 0,
    `2.5s later the 30s lock still has not landed (cd ${afterWait.cd}) — reverting the guard fails this by name`);

  const painted = await page.evaluate(() => {
    saveFridge({ built: true, camps: 1 });
    G.cooldowns = {};
    delete activeJobs.wall;
    finishAction(ACTIONS.find(a => a.id === 'wall'));
    return { opens: loadHvWall().opens, cd: G.cooldowns.wall || 0, has: bridgeHasWall() };
  });
  ok(painted.has && painted.opens === 1 && painted.cd > Date.now(),
    `a wall with a story still reads and still takes the lock (opens ${painted.opens})`);

  const thermos = await page.evaluate(() => {
    G.cooldowns = {};
    delete activeJobs.thermos;
    doAction(ACTIONS.find(a => a.id === 'thermos'));
    const feed = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return { job: !!activeJobs.thermos, cd: G.cooldowns.thermos || 0, feed: feed };
  });
  ok(!thermos.job && thermos.cd === 0 && /thermos is cold/.test(thermos.feed),
    'a cold thermos refuses before the timer and does not take the 30s lock');

  const marisol = await page.evaluate(() => {
    G.cooldowns = {};
    delete activeJobs.marisol;
    doAction(ACTIONS.find(a => a.id === 'marisol'));
    const feed = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return { job: !!activeJobs.marisol, cd: G.cooldowns.marisol || 0, feed: feed };
  });
  ok(!marisol.job && marisol.cd === 0 && /tow truck rolls past/.test(marisol.feed),
    'a storyless Marisol wave refuses before the timer and does not take the 30s lock');

  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  await ctx.close();
  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
