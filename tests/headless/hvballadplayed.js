/*
 * HV-251 — Play the Bridge Ballad said once a session, then a
 * second click still ran the job.
 *
 * The tooltip says Play it once a session. finishAction already
 * logs "The ballad got its playing tonight — the tune keeps."
 * and no-ops. Clicking 🎸 after balladPlayed still started the
 * 2s job and charged the 30s lock as if the hat filled again.
 *
 * Distinct from HV-221 / #915 (no tune was set), HV-192 /
 * #882 (a dead barrel still filled the hat), HV-248 / #944
 * (the fire story already got its telling), HV-121 / #799
 * (the hat only paid food). This ticket is the ballad after
 * it already got its playing. ui.js is not this ticket.
 *
 *  A. Source: doAction names the balladPlayed gate before
 *     setTimeout, only when the tune is set. The refuse log
 *     still says the tune keeps. ui.js is not this ticket.
 *  B. A set ballad that already got its playing: no job, no
 *     extra tally, no food, and no cooldown even after the
 *     old 2s timer would have fired. The log names the
 *     already-played night.
 *  C. Rest still works after the refuse.
 *  D. A first playing still fills the pot and stamps
 *     balladPlayed. Two tellings still refuse. Trade still
 *     refuses a short purse.
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
const balladAt = doBlock.indexOf("a.id==='ballad'");
const playedAt = doBlock.indexOf('balladPlayed');

ok(/Play it once a session/.test(cfg) && /hat by the fire/.test(cfg),
  'Play the Bridge Ballad still promises one playing a session');
ok(/got its playing tonight/.test(finishBlock) && /the tune keeps/.test(finishBlock),
  'the refuse log still names the already-played night');
ok(/THE BRIDGE BALLAD/.test(finishBlock) && /hat by the fire fills/.test(finishBlock),
  'the pay log still fills the hat before the last verse');
ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(balladAt >= 0 && playedAt >= 0 && balladAt < timeoutAt && playedAt < timeoutAt
   && /balladSet\(\)/.test(doBlock),
  'HV-251: doAction refuses a set already-played ballad before the timer');
ok(!/homeless-village\/js\/ui\.js/.test(player),
  'the already-played gate lives in doAction — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvballadplayed-init')) {
      sessionStorage.setItem('hvballadplayed-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-storyhour');
      localStorage.removeItem('hv-song');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    saveHvStory({ tellings: 3 });
    saveHvSong({ plays: 1 });
    balladPlayed = true;
    return {
      set: balladSet(),
      dish: balladDish(),
      played: balladPlayed,
      label: ACTIONS.find(a => a.id === 'ballad') && ACTIONS.find(a => a.id === 'ballad').label,
    };
  });
  ok(boot.set && boot.dish === 10 && boot.played,
    `a set ballad that already got its playing still dishes 10 (${boot.dish})`);
  ok(boot.label === 'Play the Bridge Ballad',
    `the row is still Play the Bridge Ballad (${boot.label})`);

  const played = await page.evaluate(() => {
    const a = ACTIONS.find(x => x.id === 'ballad');
    saveHvStory({ tellings: 3 });
    saveHvSong({ plays: 1 });
    balladPlayed = true;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.ballad) delete activeJobs.ballad;
    const before = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    doAction(a);
    const after = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const added = after.filter((line, i) => line !== before[i]).join('\n');
    return {
      job: !!activeJobs.ballad,
      played: balladPlayed,
      food: G.food,
      tally: loadHvSong().plays,
      cd: G.cooldowns.ballad || 0,
      added: added,
      btnOn: !!(document.getElementById('action-ballad')
        && document.getElementById('action-ballad').classList.contains('active-job')),
    };
  });
  ok(!played.job && !played.btnOn && played.played && played.food === 10
     && played.tally === 1 && played.cd === 0,
    `HV-251: an already-played ballad does not start the job (job ${played.job}, food ${played.food}, plays ${played.tally})`);
  ok(/playing tonight|tune keeps/i.test(played.added),
    `the refuse names the already-played night — not a silent no-op (${played.added.slice(-90)})`);

  await page.waitForTimeout(2500);
  const afterWait = await page.evaluate(() => ({
    cd: G.cooldowns.ballad || 0,
    food: G.food,
    job: !!activeJobs.ballad,
    played: balladPlayed,
    tally: loadHvSong().plays,
  }));
  ok(afterWait.cd === 0 && afterWait.food === 10 && !afterWait.job
     && afterWait.played && afterWait.tally === 1,
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
    saveHvStory({ tellings: 3 });
    saveHvSong({ plays: 0 });
    balladPlayed = false;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.ballad) delete activeJobs.ballad;
    finishAction(ACTIONS.find(x => x.id === 'ballad'));
    return {
      food: G.food,
      played: balladPlayed,
      tally: loadHvSong().plays,
      cd: G.cooldowns.ballad || 0,
    };
  });
  ok(first.food === 20 && first.played && first.tally === 1 && first.cd > Date.now(),
    `a first playing still fills the pot and still takes the lock (food ${first.food}, plays ${first.tally})`);

  const bare = await page.evaluate(() => {
    saveHvStory({ tellings: 2 });
    saveHvSong({ plays: 4 });
    balladPlayed = false;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.ballad) delete activeJobs.ballad;
    finishAction(ACTIONS.find(x => x.id === 'ballad'));
    return {
      set: balladSet(),
      food: G.food,
      played: balladPlayed,
      tally: loadHvSong().plays,
    };
  });
  ok(!bare.set && bare.food === 10 && !bare.played && bare.tally === 4,
    `two tellings still refuse (set ${bare.set}, plays ${bare.tally})`);

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
