/*
 * HV-192 — Play the Bridge Ballad said the hat by the fire,
 * then Fire Went Out still filled it.
 *
 * The ballad tooltip says "the hat by the fire always fills
 * before the last verse." finishAction logs the same. Fire Went
 * Out dims the barrel for 30s (G.fireOutUntil) and logs that it
 * is cold and dark. Clicking the ballad while the barrel was dark
 * still started the 2s job, stamped balladPlayed, and paid the
 * hat as if the fire were still there to sit by.
 *
 * Distinct from HV-69 (Firewood relights the barrel), #842
 * (Fire Went Out vs the sky), #799 (the hat fills, then only
 * paid food), HV-48 / hvballad (the dish and the once-a-session
 * stamp), #802 (Tell the Fire Story with no story yet), #851
 * (Hold a Camp Meeting vs a dead barrel), #870 (Hot Meal vs a
 * dead barrel), and #873 (Tell the Fire Story vs a dead barrel).
 * This ticket is the hat vs a dead fire. ui.js is not this ticket.
 *
 *  A. Source: doAction names the ballad + fireOutUntil gate
 *     before setTimeout. The tooltip still promises the fire.
 *  B. Fire Went Out, then Play the Bridge Ballad: no job, no
 *     playing stamp, the log names the dead barrel.
 *  C. Rest still works while the barrel is dark.
 *  D. Once the fire is lit, the playing still starts and still
 *     pays the telling-scaled dish (food, not goodwill).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent + doAction + finishAction
 * on the production path. hvballad.js still drives finishAction
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
const balladAt = doBlock.search(/a\.id==='ballad'/);
const fireAt = doBlock.search(/fireOutUntil/);

ok(/hat by the fire/.test(cfg),
  'Play the Bridge Ballad still promises the hat by the fire');
ok(/id:'fire_out'[\s\S]{0,220}?fireOutUntil/.test(loop),
  'Fire Went Out still dims the barrel with fireOutUntil');
ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(balladAt >= 0 && fireAt >= 0 && balladAt < timeoutAt && fireAt < timeoutAt,
  'HV-192: doAction refuses a ballad by a dead fire before the timer');
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
    if (!sessionStorage.getItem('hvballadfire-init')) {
      sessionStorage.setItem('hvballadfire-init', '1');
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
    saveHvSong({ plays: 0 });
    balladPlayed = false;
    const tip = (ACTIONS.find(a => a.id === 'ballad') || {}).tooltip || '';
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    return {
      tip: tip,
      set: balladSet(),
      dish: balladDish(),
      banner: ev && ev.title,
      desc: ev && ev.desc,
    };
  });
  ok(/hat by the fire/.test(boot.tip),
    `the tooltip still fills the hat by the fire (${boot.tip.slice(0, 56)})`);
  ok(boot.set && boot.dish === 10,
    `three tellings still set the tune and dish 10 (${boot.dish})`);
  ok(boot.banner === 'Fire Went Out' && /colder/i.test(boot.desc),
    `the card is still Fire Went Out — everything is colder (${boot.banner})`);

  const dark = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    const a = ACTIONS.find(x => x.id === 'ballad');
    saveHvStory({ tellings: 3 });
    saveHvSong({ plays: 0 });
    balladPlayed = false;
    G.food = 10;
    G.goodwill = 4;
    G.warmth = 60;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    G.cooldowns = {};
    if (activeJobs.ballad) delete activeJobs.ballad;
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
      job: !!activeJobs.ballad,
      played: balladPlayed,
      food: G.food,
      goodwill: G.goodwill,
      plays: loadHvSong().plays,
      added: added,
    };
  });
  ok(dark.out && dark.warmthAfter < 60,
    `Fire Went Out leaves the barrel dark and colder (${dark.warmthAfter})`);
  ok(!dark.job && !dark.played && dark.food === 10 && dark.plays === 0,
    `HV-192: a dead fire does not fill the hat (job ${dark.job}, played ${dark.played}, food ${dark.food}, plays ${dark.plays})`);
  ok(dark.goodwill === 4,
    `the hat is still food — a miss does not move goodwill (${dark.goodwill})`);
  ok(/fire is out|barrel|hat|dark|lit/i.test(dark.added),
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
    saveHvStory({ tellings: 3 });
    saveHvSong({ plays: 0 });
    balladPlayed = false;
    G.food = 10;
    G.goodwill = 4;
    G.goalIndex = GOALS.length;
    G.cooldowns = {};
    if (activeJobs.ballad) delete activeJobs.ballad;
    const a = ACTIONS.find(x => x.id === 'ballad');
    doAction(a);
    const started = !!activeJobs.ballad;
    if (activeJobs.ballad) delete activeJobs.ballad;
    finishAction(a);
    return {
      started: started,
      food: G.food,
      goodwill: G.goodwill,
      played: balladPlayed,
      plays: loadHvSong().plays,
    };
  });
  ok(lit.started, 'a lit barrel still starts the playing');
  ok(lit.food === 20 && lit.played && lit.plays === 1 && lit.goodwill === 4,
    `three tellings still fill the hat with 10 food, not goodwill (food ${lit.food}, goodwill ${lit.goodwill})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
