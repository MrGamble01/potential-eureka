/*
 * HV-249 — Tell the Fire Story said once a session, then a
 * second click still ran the job.
 *
 * The tooltip says Tell it around the fire once a session.
 * finishAction already logs "The story got its telling tonight
 * — the fire remembers." and no-ops. Clicking 🔥 after
 * hvStoryTold still started the 2s job and charged the 30s
 * lock as if somebody showed up with dinner again.
 *
 * Distinct from HV-122 / #802 (nobody had the story yet),
 * HV-183 / #873 (a dead barrel still hosted the telling),
 * HV-244 / #939 (the bench already got its sit), HV-242 /
 * #937 (the notebook already got its leaf), HV-248 / #943
 * (theft vs the weather band). This ticket is the story
 * after it already got its telling. ui.js is not this ticket.
 *
 *  A. Source: doAction names the hvStoryTold gate before
 *     setTimeout, only when the story is by heart. The refuse
 *     log still says the fire remembers. ui.js is not this
 *     ticket.
 *  B. A learned story that already got its telling: no job,
 *     no extra tally, no food, and no cooldown even after
 *     the old 2s timer would have fired. The log names the
 *     already-told night.
 *  C. Rest still works after the refuse.
 *  D. A first telling still fills the pot and stamps
 *     hvStoryTold. Two sits still refuse. Trade still
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
const storyAt = doBlock.indexOf("a.id==='story'");
const toldAt = doBlock.indexOf('hvStoryTold');

ok(/Tell it around the fire once a session/.test(cfg) && /shows up with dinner/.test(cfg),
  'Tell the Fire Story still promises one telling a session');
ok(/got its telling tonight/.test(finishBlock) && /the fire remembers/.test(finishBlock),
  'the refuse log still names the already-told night');
ok(/THE FIRE STORY/.test(finishBlock) && /shows up with dinner/.test(finishBlock),
  'the pay log still fills the pot from somebody showing up with dinner');
ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(storyAt >= 0 && toldAt >= 0 && storyAt < timeoutAt && toldAt < timeoutAt
   && /hvStoryByHeart\(\)/.test(doBlock),
  'HV-249: doAction refuses a learned already-told story before the timer');
ok(!/homeless-village\/js\/ui\.js/.test(player),
  'the already-told gate lives in doAction — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvstorytold-init')) {
      sessionStorage.setItem('hvstorytold-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-bench');
      localStorage.removeItem('hv-storyhour');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    saveHvBench({ sits: 3 });
    saveHvStory({ tellings: 1 });
    hvStoryTold = true;
    return {
      heart: hvStoryByHeart(),
      dish: hvStoryDish(),
      told: hvStoryTold,
      label: ACTIONS.find(a => a.id === 'story') && ACTIONS.find(a => a.id === 'story').label,
    };
  });
  ok(boot.heart && boot.dish === 9 && boot.told,
    `a learned story that already got its telling still dishes 9 (${boot.dish})`);
  ok(boot.label === 'Tell the Fire Story',
    `the row is still Tell the Fire Story (${boot.label})`);

  const told = await page.evaluate(() => {
    const a = ACTIONS.find(x => x.id === 'story');
    saveHvBench({ sits: 3 });
    saveHvStory({ tellings: 1 });
    hvStoryTold = true;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.story) delete activeJobs.story;
    const before = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    doAction(a);
    const after = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const added = after.filter((line, i) => line !== before[i]).join('\n');
    return {
      job: !!activeJobs.story,
      told: hvStoryTold,
      food: G.food,
      tally: loadHvStory().tellings,
      cd: G.cooldowns.story || 0,
      added: added,
      btnOn: !!(document.getElementById('action-story')
        && document.getElementById('action-story').classList.contains('active-job')),
    };
  });
  ok(!told.job && !told.btnOn && told.told && told.food === 10
     && told.tally === 1 && told.cd === 0,
    `HV-249: an already-told story does not start the job (job ${told.job}, food ${told.food}, tellings ${told.tally})`);
  ok(/telling tonight|fire remembers/i.test(told.added),
    `the refuse names the already-told night — not a silent no-op (${told.added.slice(-90)})`);

  await page.waitForTimeout(2500);
  const afterWait = await page.evaluate(() => ({
    cd: G.cooldowns.story || 0,
    food: G.food,
    job: !!activeJobs.story,
    told: hvStoryTold,
    tally: loadHvStory().tellings,
  }));
  ok(afterWait.cd === 0 && afterWait.food === 10 && !afterWait.job
     && afterWait.told && afterWait.tally === 1,
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
    saveHvBench({ sits: 3 });
    saveHvStory({ tellings: 0 });
    hvStoryTold = false;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.story) delete activeJobs.story;
    finishAction(ACTIONS.find(x => x.id === 'story'));
    return {
      food: G.food,
      told: hvStoryTold,
      tally: loadHvStory().tellings,
      cd: G.cooldowns.story || 0,
    };
  });
  ok(first.food === 19 && first.told && first.tally === 1 && first.cd > Date.now(),
    `a first telling still fills the pot and still takes the lock (food ${first.food}, tellings ${first.tally})`);

  const bare = await page.evaluate(() => {
    saveHvBench({ sits: 2 });
    saveHvStory({ tellings: 4 });
    hvStoryTold = false;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.story) delete activeJobs.story;
    finishAction(ACTIONS.find(x => x.id === 'story'));
    return {
      heart: hvStoryByHeart(),
      food: G.food,
      told: hvStoryTold,
      tally: loadHvStory().tellings,
    };
  });
  ok(!bare.heart && bare.food === 10 && !bare.told && bare.tally === 4,
    `two sits still refuse (heart ${bare.heart}, tellings ${bare.tally})`);

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
