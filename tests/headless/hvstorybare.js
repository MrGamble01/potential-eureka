/*
 * HV-281 — Tell the Fire Story ran a job when nobody had the
 * whole story yet.
 *
 * The tooltip says three sits on the bench bring the whole bridge
 * story together — "Tell it around the fire once a session."
 * hvStoryByHeart() is three sits (loadHvBench().sits>=3).
 * finishAction already logs "Nobody has the whole story yet —
 * three sits on the bench and it comes together." doAction never
 * asked. Clicking 🔥 with two sits started the 2s job, then
 * finishAction logged the unlearned story and locked the button
 * for the full 30s cooldown — the same lock a real telling earns.
 * hvstory.js only drives finishAction, so the timer seam stayed
 * invisible.
 *
 * Every other link in the chain already refuses its own
 * not-yet-earned case before the timer: HV-204 (snapshot), HV-207
 * (anniv), HV-212 (can), HV-219 (walk / notebook), HV-220 (dry),
 * HV-221 (ballad), HV-222 (bench), HV-223 (mark), HV-224 (fifth).
 * Tell the Fire Story was the one link left out. HV-249's
 * already-told refuse (a learned story that already got its
 * telling) is a different gate and is untouched. A dead barrel is
 * a separate ticket. ui.js is not this ticket.
 *
 *  A. Source: doAction refuses an unlearned story before
 *     setTimeout, the same log finishAction already uses.
 *     ui.js is not this ticket.
 *  B. Two sits do not start a job, do not stamp hvStoryTold, add
 *     no food and take no cooldown even after the old 2s timer
 *     would have fired.
 *  C. Three sits still pay through finishAction and still take
 *     the lock. HV-249's already-told refuse still fires on a
 *     second click. Trade still refuses a short purse.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives doAction() + finishAction() on the production
 * action.
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
const bareAt = doBlock.indexOf("!hvStoryByHeart()");
const toldAt = doBlock.indexOf('hvStoryTold');

ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(bareAt >= 0 && bareAt < timeoutAt,
  'HV-281: doAction refuses Tell the Fire Story before the timer when nobody has the story yet');
ok(toldAt >= 0 && toldAt < timeoutAt,
  'HV-249: doAction still refuses an already-told story before the timer');
ok(/Tell it around the fire once a session/.test(config),
  'the card still asks for the story told once a session');
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
    if (!sessionStorage.getItem('hvstorybare-init')) {
      sessionStorage.setItem('hvstorybare-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-bench');
      localStorage.removeItem('hv-storyhour');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const bare = await t(() => {
    saveHvBench({ sits: 2 });
    saveHvStory({ tellings: 0 });
    hvStoryTold = false;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.story) delete activeJobs.story;
    const a = ACTIONS.find(x => x.id === 'story');
    doAction(a);
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      heart: hvStoryByHeart(),
      job: !!activeJobs.story,
      cd: G.cooldowns.story || 0,
      food: G.food,
      tellings: loadHvStory().tellings,
      told: hvStoryTold,
      log,
      btnOn: !!(document.getElementById('action-story')
        && document.getElementById('action-story').classList.contains('active-job')),
    };
  });
  ok(!bare.heart, 'two sits still leave nobody with the whole story');
  ok(!bare.job && !bare.btnOn,
    'an unlearned story does not start a job — the button is not active-job');
  ok(bare.cd === 0 && bare.food === 10 && bare.tellings === 0 && !bare.told,
    `an unlearned story takes no cooldown and does not fill the pot (cd ${bare.cd}, food ${bare.food})`);
  ok(/Nobody has the whole story yet/.test(bare.log),
    'the refuse is the same line finishAction already used');

  await page.waitForTimeout(2500);
  const afterWait = await t(() => ({
    cd: G.cooldowns.story || 0,
    food: G.food,
    job: !!activeJobs.story,
    tellings: loadHvStory().tellings,
    told: hvStoryTold,
  }));
  ok(afterWait.cd === 0 && afterWait.food === 10 && !afterWait.job
     && afterWait.tellings === 0 && !afterWait.told,
    `2.5s later the 30s lock still has not landed (cd ${afterWait.cd})`);

  const standing = await t(() => {
    saveHvBench({ sits: 3 });
    saveHvStory({ tellings: 0 });
    hvStoryTold = false;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.story) delete activeJobs.story;
    finishAction(ACTIONS.find(x => x.id === 'story'));
    return {
      heart: hvStoryByHeart(),
      food: G.food,
      tellings: loadHvStory().tellings,
      told: hvStoryTold,
      cd: G.cooldowns.story || 0,
    };
  });
  ok(standing.heart && standing.food > 10 && standing.tellings === 1 && standing.told
     && standing.cd > Date.now(),
    `three sits still fill the pot and still take the lock (food ${standing.food}, tellings ${standing.tellings})`);

  // HV-249's already-told refuse is untouched by this ticket.
  const told = await t(() => {
    saveHvBench({ sits: 3 });
    saveHvStory({ tellings: 1 });
    hvStoryTold = true;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.story) delete activeJobs.story;
    const a = ACTIONS.find(x => x.id === 'story');
    doAction(a);
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return { job: !!activeJobs.story, cd: G.cooldowns.story || 0, food: G.food, log };
  });
  ok(!told.job && told.cd === 0 && told.food === 10 && /fire remembers/.test(told.log),
    'HV-249: an already-told story still refuses before the timer, untouched by this ticket');

  const rest = await t(() => {
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

  const trade = await t(() => {
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
