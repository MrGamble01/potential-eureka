/*
 * HV-183 — Tell the Fire Story said tell it around the fire,
 * then Fire Went Out still told it.
 *
 * The story tooltip says "tell it around the fire once a
 * session, and somebody always shows up with dinner before
 * it's done." Fire Went Out dims the barrel for 30s
 * (G.fireOutUntil) and logs that it is cold and dark. Clicking
 * the story while the barrel was dark still started the 2s job,
 * stamped hvStoryTold, and paid the dish as if the fire were
 * still there to tell it around.
 *
 * Distinct from HV-122 / #802 (nobody has the whole story yet),
 * HV-249 (an already-told story refuses on its own, fire lit or
 * not), HV-192 (the ballad's hat vs a dead barrel), HV-229 (the
 * thermos's round vs a dead barrel), and HV-235 (the anniversary
 * candle vs a dead barrel) — story is the fourth sibling in that
 * same bridge-chain fire gate. ui.js is not this ticket.
 *
 *  A. Source: doAction names the story + fireOutUntil gate
 *     before setTimeout, only when the story is by heart and
 *     not already told tonight. The tooltip still promises the
 *     fire.
 *  B. Fire Went Out, then Tell the Fire Story: no job, no
 *     hvStoryTold stamp, the log names the dead barrel.
 *  C. Rest still works while the barrel is dark.
 *  D. Once the fire is lit, the telling still starts and still
 *     pays the by-heart-scaled dish (food, not goodwill), and
 *     stamps hvStoryTold.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent + doAction + finishAction
 * on the production path. hvstory.js still drives finishAction
 * only — a doAction gate does not break it.
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
const timeoutAt = doBlock.indexOf('setTimeout');
const storyAt = doBlock.search(/a\.id==='story'/);
const fireAt = doBlock.search(/fireOutUntil/);
const toldAt = doBlock.indexOf('!hvStoryTold');

ok(/tell it around the fire/i.test(cfg),
  'Tell the Fire Story still promises tell it around the fire');
ok(/id:'fire_out'[\s\S]{0,220}?fireOutUntil/.test(loop),
  'Fire Went Out still dims the barrel with fireOutUntil');
ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(storyAt >= 0 && fireAt >= 0 && toldAt >= 0
   && storyAt < timeoutAt && fireAt < timeoutAt && toldAt < timeoutAt,
  'HV-183: doAction refuses a story by a dead fire before the timer');
ok(/homeless-village\/js\/ui\.js/.test(player) === false,
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
    const tip = (ACTIONS.find(a => a.id === 'story') || {}).tooltip || '';
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    return {
      tip: tip,
      heart: hvStoryByHeart(),
      dish: hvStoryDish(),
      banner: ev && ev.title,
      desc: ev && ev.desc,
    };
  });
  ok(/tell it around the fire/i.test(boot.tip),
    `the tooltip still tells it around the fire (${boot.tip.slice(0, 56)})`);
  ok(boot.heart && boot.dish === 9,
    `three sits still set the heart and dish 9 (${boot.dish})`);
  ok(boot.banner === 'Fire Went Out' && /colder/i.test(boot.desc),
    `the card is still Fire Went Out — everything is colder (${boot.banner})`);

  const dark = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    const a = ACTIONS.find(x => x.id === 'story');
    saveHvBench({ sits: 3 });
    saveHvStory({ tellings: 0 });
    hvStoryTold = false;
    G.food = 10;
    G.goodwill = 4;
    G.warmth = 60;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    G.cooldowns = {};
    if (activeJobs.story) delete activeJobs.story;
    triggerEvent(ev, false);
    const out = Date.now() < (G.fireOutUntil || 0);
    const warmthAfter = G.warmth;
    const before = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    doAction(a);
    const after = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const added = after.filter((line, i) => line !== before[i]).join('\n');
    return {
      out: out,
      warmthAfter: warmthAfter,
      job: !!activeJobs.story,
      told: hvStoryTold,
      food: G.food,
      goodwill: G.goodwill,
      tellings: loadHvStory().tellings,
      added: added,
    };
  });
  ok(dark.out && dark.warmthAfter < 60,
    `Fire Went Out leaves the barrel dark and colder (${dark.warmthAfter})`);
  ok(!dark.job && !dark.told && dark.food === 10 && dark.tellings === 0,
    `HV-183: a dead fire does not tell the story (job ${dark.job}, told ${dark.told}, food ${dark.food}, tellings ${dark.tellings})`);
  ok(dark.goodwill === 4,
    `the dish is still food — a miss does not move goodwill (${dark.goodwill})`);
  ok(/fire is out|barrel|story|dark|lit/i.test(dark.added),
    `the refuse names the dead fire — not a silent no-op (${dark.added.slice(-90)})`);

  const rest = await page.evaluate(() => {
    G.health = 70;
    G.morale = 50;
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
    G.goodwill = 4;
    G.goalIndex = GOALS.length;
    G.cooldowns = {};
    if (activeJobs.story) delete activeJobs.story;
    const a = ACTIONS.find(x => x.id === 'story');
    doAction(a);
    const started = !!activeJobs.story;
    if (activeJobs.story) delete activeJobs.story;
    finishAction(a);
    return {
      started: started,
      food: G.food,
      goodwill: G.goodwill,
      told: hvStoryTold,
      tellings: loadHvStory().tellings,
    };
  });
  ok(lit.started, 'a lit barrel still starts the telling');
  ok(lit.food === 19 && lit.told && lit.tellings === 1 && lit.goodwill === 4,
    `three sits still tell the story with 9 food, not goodwill (food ${lit.food}, goodwill ${lit.goodwill})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
