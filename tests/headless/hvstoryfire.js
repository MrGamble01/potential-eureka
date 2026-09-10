/*
 * HV-237 — Tell the Fire Story said it is told around the fire,
 * then Fire Went Out still filled the pot.
 *
 * The tooltip says "Tell it around the fire once a session, and
 * somebody always shows up with dinner before it's done."
 * finishAction logs "THE FIRE STORY — ... told around the fire.
 * Somebody shows up with dinner before it's done." Fire Went Out
 * dims the barrel for 30s (G.fireOutUntil). Clicking 🔥 while the
 * barrel was dark still started the 2s job, stamped hvStoryTold,
 * and paid dinner as if the fire were still there to tell it
 * around.
 *
 * Distinct from HV-47's own gate (nobody has the whole story
 * yet — finishAction, untouched), HV-192/HV-224 (the ballad's
 * own hat-by-the-fire ticket), HV-229 (the thermos), HV-235 (the
 * anniversary candle). This ticket is the fire story vs a dead
 * fire. ui.js is not this ticket.
 *
 *  A. Source: doAction names the story + fireOutUntil gate before
 *     setTimeout, only when the whole story is known and it has
 *     not been told yet. The pay log still promises the fire.
 *     ui.js is not this ticket.
 *  B. Three sits on the bench, then Fire Went Out, then Tell the
 *     Fire Story: no job, no hvStoryTold stamp, no food, no
 *     tally, and no cooldown even after the old 2s timer would
 *     have fired. The log names the dead fire.
 *  C. Rest still works while the barrel is dark.
 *  D. Once the fire is lit, finishAction still fills the pot.
 *     Trade still refuses a short purse.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent + doAction + finishAction.
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
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const doAt = player.indexOf('function doAction(a){');
const finishAt = player.indexOf('function finishAction(a){');
const doBlock = doAt >= 0 && finishAt > doAt ? player.slice(doAt, finishAt) : '';
const finishBlock = finishAt >= 0 ? player.slice(finishAt) : '';
const timeoutAt = doBlock.indexOf('setTimeout');
const storyAt = doBlock.indexOf("a.id==='story'");
const fireAt = doBlock.indexOf('fireOutUntil');

ok(/Tell it around the fire once a session/.test(cfg) && /somebody always shows up with dinner/.test(cfg),
  'Tell the Fire Story still promises the fire and the dinner');
ok(/told around the fire/.test(finishBlock) && /Somebody shows up with dinner/.test(finishBlock),
  'the pay log still fills the pot from the fire and dinner');
ok(/id:'fire_out'[\s\S]{0,220}?fireOutUntil/.test(loop),
  'Fire Went Out still dims the barrel with fireOutUntil');
ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(storyAt >= 0 && fireAt >= 0 && storyAt < timeoutAt && fireAt < timeoutAt
   && /hvStoryByHeart\(\)/.test(doBlock) && /!hvStoryTold/.test(doBlock),
  'HV-237: doAction refuses a known untold story by a dead fire before the timer');
ok(!/homeless-village\/js\/ui\.js/.test(player),
  'the dead-fire gate lives in doAction — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvstoryfire-init')) {
      sessionStorage.setItem('hvstoryfire-init', '1');
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
    saveHvStory({ tellings: 0 });
    hvStoryTold = false;
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    return {
      byHeart: hvStoryByHeart(),
      dish: hvStoryDish(),
      banner: ev && ev.title,
    };
  });
  ok(boot.byHeart && boot.dish === 9,
    `three sits still know the whole story and dish 9 (${boot.dish})`);
  ok(boot.banner === 'Fire Went Out',
    `the card is still Fire Went Out (${boot.banner})`);

  const dark = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    const a = ACTIONS.find(x => x.id === 'story');
    saveHvBench({ sits: 3 });
    saveHvStory({ tellings: 0 });
    hvStoryTold = false;
    G.food = 10;
    G.warmth = 60;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    G.cooldowns = {};
    if (activeJobs.story) delete activeJobs.story;
    triggerEvent(ev, false);
    const out = Date.now() < (G.fireOutUntil || 0);
    const before = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    doAction(a);
    const after = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const added = after.filter((line, i) => line !== before[i]).join('\n');
    return {
      out: out,
      job: !!activeJobs.story,
      told: hvStoryTold,
      food: G.food,
      tellings: loadHvStory().tellings,
      cd: G.cooldowns.story || 0,
      added: added,
      btnOn: !!(document.getElementById('action-story')
        && document.getElementById('action-story').classList.contains('active-job')),
    };
  });
  ok(dark.out, 'Fire Went Out leaves the barrel dark');
  ok(!dark.job && !dark.btnOn && !dark.told && dark.food === 10 && dark.tellings === 0 && dark.cd === 0,
    `HV-237: a dead fire does not tell the story (job ${dark.job}, told ${dark.told}, food ${dark.food})`);
  ok(/fire is out|barrel|fire|dark|lit/i.test(dark.added),
    `the refuse names the dead fire — not a silent no-op (${dark.added.slice(-90)})`);

  await page.waitForTimeout(2500);
  const afterWait = await page.evaluate(() => ({
    cd: G.cooldowns.story || 0,
    food: G.food,
    job: !!activeJobs.story,
    told: hvStoryTold,
    tellings: loadHvStory().tellings,
  }));
  ok(afterWait.cd === 0 && afterWait.food === 10 && !afterWait.job && !afterWait.told && afterWait.tellings === 0,
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
    `Rest still works while the barrel is dark (health ${rest.health})`);

  const lit = await page.evaluate(() => {
    G.fireOutUntil = 0;
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
      tellings: loadHvStory().tellings,
      cd: G.cooldowns.story || 0,
    };
  });
  ok(lit.food === 19 && lit.told && lit.tellings === 1 && lit.cd > Date.now(),
    `a lit barrel still fills the pot and still takes the lock (food ${lit.food}, tellings ${lit.tellings})`);

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
