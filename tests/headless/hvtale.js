/*
 * HV-122 — Tell the Fire Story ran a job when nobody had the story yet.
 *
 * The tooltip says three sits on the bench and somebody has the whole
 * bridge story by heart. The button is on the rail from day one. A
 * new camp has zero sits. Clicking it still started the 2-second job,
 * then finishAction logged "Nobody has the whole story yet" and locked
 * the button for 30 seconds — the same lock a real telling earns.
 *
 * HV-61 taught Trade / Rain Bet / Garage / Fridge to refuse in
 * doAction before the timer. Tell the Fire Story never learned it.
 * Distinct from HV-47 (hvstory): that suite drives finishAction and
 * never sees the timer. Distinct from the bare-wall family (#768 /
 * #771) and Marisol (#776). Not the ballad payout (#799) or the
 * bench dish (#797).
 *
 * A. Source: doAction refuses !hvStoryByHeart() before setTimeout.
 *    ui.js is not this ticket.
 * B. Zero sits: no job, no 30s lock even after the old 2s timer.
 * C. Three sits still tell the story and still take the lock.
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
const ui     = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const cfg    = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const doAt = player.indexOf('function doAction(a){');
const finishAt = player.indexOf('function finishAction(a){');
const doBlock = doAt >= 0 && finishAt > doAt ? player.slice(doAt, finishAt) : '';
const timeoutAt = doBlock.indexOf('setTimeout');

ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(/id:'story'[\s\S]{0,280}?Three sits on the bench/.test(cfg),
  'Tell the Fire Story still promises three sits first');
const storyAt = doBlock.search(/a\.id\s*===\s*['"]story['"]/);
ok(storyAt >= 0 && storyAt < timeoutAt && /hvStoryByHeart/.test(doBlock),
  'HV-122: doAction refuses Tell the Fire Story before the timer when nobody has the story');
ok(!/onNewDay/.test(ui) && !/hvStoryByHeart/.test(ui),
  'ui.js is not this ticket — the refuse lives in player.js');

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
    if (!sessionStorage.getItem('hvtale-init')) {
      sessionStorage.setItem('hvtale-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-bench');
      localStorage.removeItem('hv-storyhour');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    const a = ACTIONS.find(x => x.id === 'story');
    return {
      btn: !!document.getElementById('action-story'),
      heart: hvStoryByHeart(),
      time: a && a.time,
      cd: a && a.cooldown,
    };
  });
  ok(boot.btn && boot.time === 2000 && boot.cd === 30000,
    `Tell the Fire Story is on the rail as a 2s job with a 30s lock (${boot.time}/${boot.cd})`);
  ok(!boot.heart, 'a fresh camp does not have the story by heart');

  const bare = await page.evaluate(() => {
    saveHvBench({ sits: 0 });
    saveHvStory({ tellings: 0 });
    hvStoryTold = false;
    G.food = 10;
    G.cooldowns = {};
    delete activeJobs.story;
    doAction(ACTIONS.find(x => x.id === 'story'));
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      job: !!activeJobs.story,
      cd: G.cooldowns.story || 0,
      food: G.food,
      tellings: loadHvStory().tellings,
      log,
      btnOn: !!(document.getElementById('action-story') &&
        document.getElementById('action-story').classList.contains('active-job')),
    };
  });
  ok(!bare.job && !bare.btnOn,
    'HV-122: a bare fire does not start a job');
  ok(bare.cd === 0 && bare.food === 10 && bare.tellings === 0,
    `HV-122: a bare fire takes no lock and no dinner (cd ${bare.cd}, food ${bare.food})`);
  ok(/Nobody has the whole story yet/.test(bare.log),
    'the refuse is the same line finishAction already used');

  await page.waitForTimeout(2500);
  const afterWait = await page.evaluate(() => ({
    cd: G.cooldowns.story || 0,
    job: !!activeJobs.story,
    food: G.food,
  }));
  ok(afterWait.cd === 0 && !afterWait.job && afterWait.food === 10,
    `HV-122: 2.5s later the 30s lock still has not landed (cd ${afterWait.cd})`);

  const told = await page.evaluate(() => {
    saveHvBench({ sits: 3 });
    saveHvStory({ tellings: 0 });
    hvStoryTold = false;
    G.food = 10;
    G.cooldowns = {};
    delete activeJobs.story;
    doAction(ACTIONS.find(x => x.id === 'story'));
    return { job: !!activeJobs.story };
  });
  ok(told.job, 'three sits still start the telling');
  await page.waitForTimeout(2500);
  const paid = await page.evaluate(() => ({
    food: G.food,
    tellings: loadHvStory().tellings,
    cd: (G.cooldowns.story || 0) > Date.now(),
    heart: hvStoryByHeart(),
  }));
  ok(paid.heart && paid.food > 10 && paid.tellings === 1 && paid.cd,
    `three sits still tell the story and still take the lock (food ${paid.food}, cd ${paid.cd})`);

  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  await ctx.close();
  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
