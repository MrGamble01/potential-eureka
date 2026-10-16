/*
 * HV-235 — Mark the Anniversary said light a candle and keep
 * it lit, then Fire Went Out still filled the pot.
 *
 * The tooltip says light a candle once a session, and the
 * bridge remembers who kept it lit. finishAction logs "a
 * candle lit to prove it. Folks come by the flame with
 * something for the pot." Fire Went Out dims the barrel for
 * 30s (G.fireOutUntil). Clicking 🕯️ while the barrel was
 * dark still started the 2s job, stamped annivMarked, and
 * paid the pot as if the flame were still there.
 *
 * Distinct from HV-207 / #897 (nobody counted the winters),
 * #885 (rain on the candle), HV-192 (ballad hat vs a dead
 * barrel), HV-226 (thermos vs a dead barrel), HV-183 (fire
 * story). This ticket is the anniversary candle vs a dead
 * fire. ui.js is not this ticket.
 *
 *  A. Source: doAction names the anniv + fireOutUntil gate
 *     before setTimeout, only when the winters count and the
 *     candle has not burned. The pay log still promises the
 *     flame. ui.js is not this ticket.
 *  B. Three looks, then Fire Went Out, then Mark the
 *     Anniversary: no job, no annivMarked stamp, no food, no
 *     tally, and no cooldown even after the old 2s timer
 *     would have fired. The log names the dead barrel.
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
const annivAt = doBlock.indexOf("a.id==='anniv'");
const fireAt = doBlock.indexOf('fireOutUntil');

ok(/Light a candle for it once a session/.test(cfg) && /who kept it lit/.test(cfg),
  'Mark the Anniversary still promises a candle kept lit');
ok(/come by the flame/.test(finishBlock) && /a candle lit to prove it/.test(finishBlock),
  'the pay log still fills the pot from folks by the flame');
ok(/id:'fire_out'[\s\S]{0,220}?fireOutUntil/.test(loop),
  'Fire Went Out still dims the barrel with fireOutUntil');
ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(annivAt >= 0 && fireAt >= 0 && annivAt < timeoutAt && fireAt < timeoutAt
   && /annivCounts\(\)/.test(doBlock) && /!annivMarked/.test(doBlock),
  'HV-235: doAction refuses a counted unused candle by a dead fire before the timer');
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
    if (!sessionStorage.getItem('hvannivfire-init')) {
      sessionStorage.setItem('hvannivfire-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-portrait');
      localStorage.removeItem('hv-anniversary');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    saveHvSnap({ looks: 3 });
    saveHvAnniv({ toasts: 0 });
    annivMarked = false;
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    return {
      counts: annivCounts(),
      dish: annivDish(),
      banner: ev && ev.title,
    };
  });
  ok(boot.counts && boot.dish === 6,
    `three looks still count the winters and dish 6 (${boot.dish})`);
  ok(boot.banner === 'Fire Went Out',
    `the card is still Fire Went Out (${boot.banner})`);

  const dark = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    const a = ACTIONS.find(x => x.id === 'anniv');
    saveHvSnap({ looks: 3 });
    saveHvAnniv({ toasts: 0 });
    annivMarked = false;
    G.food = 10;
    G.warmth = 60;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    G.cooldowns = {};
    if (activeJobs.anniv) delete activeJobs.anniv;
    triggerEvent(ev, false);
    const out = Date.now() < (G.fireOutUntil || 0);
    const before = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    doAction(a);
    const after = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const added = after.filter((line, i) => line !== before[i]).join('\n');
    return {
      out: out,
      job: !!activeJobs.anniv,
      marked: annivMarked,
      food: G.food,
      toasts: loadHvAnniv().toasts,
      cd: G.cooldowns.anniv || 0,
      added: added,
      btnOn: !!(document.getElementById('action-anniv')
        && document.getElementById('action-anniv').classList.contains('active-job')),
    };
  });
  ok(dark.out, 'Fire Went Out leaves the barrel dark');
  ok(!dark.job && !dark.btnOn && !dark.marked && dark.food === 10 && dark.toasts === 0 && dark.cd === 0,
    `HV-235: a dead fire does not light the candle (job ${dark.job}, marked ${dark.marked}, food ${dark.food})`);
  ok(/fire is out|barrel|candle|flame|dark|lit/i.test(dark.added),
    `the refuse names the dead fire — not a silent no-op (${dark.added.slice(-90)})`);

  await page.waitForTimeout(2500);
  const afterWait = await page.evaluate(() => ({
    cd: G.cooldowns.anniv || 0,
    food: G.food,
    job: !!activeJobs.anniv,
    marked: annivMarked,
    toasts: loadHvAnniv().toasts,
  }));
  ok(afterWait.cd === 0 && afterWait.food === 10 && !afterWait.job && !afterWait.marked && afterWait.toasts === 0,
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
    saveHvSnap({ looks: 3 });
    saveHvAnniv({ toasts: 0 });
    annivMarked = false;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.anniv) delete activeJobs.anniv;
    finishAction(ACTIONS.find(x => x.id === 'anniv'));
    return {
      food: G.food,
      marked: annivMarked,
      toasts: loadHvAnniv().toasts,
      cd: G.cooldowns.anniv || 0,
    };
  });
  ok(lit.food === 16 && lit.marked && lit.toasts === 1 && lit.cd > Date.now(),
    `a lit barrel still fills the pot and still takes the lock (food ${lit.food}, toasts ${lit.toasts})`);

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
