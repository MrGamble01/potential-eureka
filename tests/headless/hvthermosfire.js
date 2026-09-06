/*
 * HV-225 — Pass the Thermos said it goes around the fire,
 * then Fire Went Out still poured it.
 *
 * finishAction logs "The old thermos goes around the fire".
 * Fire Went Out dims the barrel for 30s (G.fireOutUntil) and
 * says everything is colder. Clicking Pass the Thermos while
 * the barrel was dark still started the 2s job, stamped
 * thermosUsed, and lifted morale as if the fire were still
 * there to sit around.
 *
 * Distinct from HV-148 (cold / no story — thermosHasWarmth
 * is false), HV-114 (warmth never moved), HV-93 (dawn refill),
 * HV-35 / hvthermos (the dish and the once-a-session stamp),
 * HV-69 / hvrelight (Firewood relights the barrel), HV-192
 * (Play the Bridge Ballad vs a dead barrel), HV-161 (meeting),
 * HV-180 (hot meal), and HV-183 (fire story). This ticket is
 * the thermos vs a dead fire. ui.js is not this ticket.
 *
 *  A. Source: doAction names the thermos + fireOutUntil gate
 *     before setTimeout, only when the story stands and the
 *     round has not been poured. The pay log still promises
 *     the fire. ui.js is not this ticket.
 *  B. A remembered bridge, then Fire Went Out, then Pass the
 *     Thermos: no job, no thermosUsed stamp, no morale, no
 *     tally, and no cooldown even after the old 2s timer
 *     would have fired. The log names the dead barrel.
 *  C. Rest still works while the barrel is dark.
 *  D. Once the fire is lit, finishAction still pours the
 *     memory-scaled morale. Trade still refuses a short purse.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent + doAction + finishAction
 * on the production path. hvthermos.js still drives
 * finishAction only — a doAction gate does not break it.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const doAt = player.indexOf('function doAction(a){');
const finishAt = player.indexOf('function finishAction(a){');
const doBlock = doAt >= 0 && finishAt > doAt ? player.slice(doAt, finishAt) : '';
const timeoutAt = doBlock.indexOf('setTimeout');
const thermosAt = doBlock.indexOf("a.id==='thermos'");
const fireAt = doBlock.indexOf('fireOutUntil');

ok(/The old thermos goes around the fire/.test(player),
  'Pass the Thermos still pays around the fire');
ok(/id:'fire_out'[\s\S]{0,220}?fireOutUntil/.test(loop),
  'Fire Went Out still dims the barrel with fireOutUntil');
ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(thermosAt >= 0 && fireAt >= 0 && thermosAt < timeoutAt && fireAt < timeoutAt
   && /thermosHasWarmth\(\)/.test(doBlock) && /!thermosUsed/.test(doBlock),
  'HV-225: doAction refuses a warm unused thermos by a dead fire before the timer');
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
    if (!sessionStorage.getItem('hvthermosfire-init')) {
      sessionStorage.setItem('hvthermosfire-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-thermos');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-letter');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    saveHvRec({ days: 1, beats: 0 });
    saveThermos({ uses: 0 });
    thermosUsed = false;
    const tip = (ACTIONS.find(a => a.id === 'thermos') || {}).tooltip || '';
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    return {
      tip: tip,
      warm: thermosHasWarmth(),
      power: thermosPower(),
      banner: ev && ev.title,
      desc: ev && ev.desc,
    };
  });
  ok(boot.warm && boot.power === 2,
    `one remembered dawn still warms the thermos (power ${boot.power})`);
  ok(/Pass it around/.test(boot.tip),
    `the row is still Pass the Thermos (${boot.tip.slice(0, 48)})`);
  ok(boot.banner === 'Fire Went Out' && /colder/i.test(boot.desc),
    `the card is still Fire Went Out — everything is colder (${boot.banner})`);

  const dark = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    const a = ACTIONS.find(x => x.id === 'thermos');
    saveHvRec({ days: 1, beats: 0 });
    saveThermos({ uses: 0 });
    thermosUsed = false;
    G.morale = 50;
    G.warmth = 60;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    G.cooldowns = {};
    if (activeJobs.thermos) delete activeJobs.thermos;
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
      job: !!activeJobs.thermos,
      used: thermosUsed,
      morale: G.morale,
      uses: loadThermos().uses,
      cd: G.cooldowns.thermos || 0,
      added: added,
      btnOn: !!(document.getElementById('action-thermos')
        && document.getElementById('action-thermos').classList.contains('active-job')),
    };
  });
  ok(dark.out && dark.warmthAfter < 60,
    `Fire Went Out leaves the barrel dark and colder (${dark.warmthAfter})`);
  ok(!dark.job && !dark.btnOn && !dark.used && dark.morale === 50 && dark.uses === 0 && dark.cd === 0,
    `HV-225: a dead fire does not pour the thermos (job ${dark.job}, used ${dark.used}, morale ${dark.morale}, uses ${dark.uses})`);
  ok(/fire is out|barrel|thermos|dark|lit/i.test(dark.added),
    `the refuse names the dead fire — not a silent no-op (${dark.added.slice(-90)})`);

  await page.waitForTimeout(2500);
  const afterWait = await page.evaluate(() => ({
    cd: G.cooldowns.thermos || 0,
    morale: G.morale,
    job: !!activeJobs.thermos,
    used: thermosUsed,
    uses: loadThermos().uses,
  }));
  ok(afterWait.cd === 0 && afterWait.morale === 50 && !afterWait.job && !afterWait.used && afterWait.uses === 0,
    `2.5s later the 30s lock still has not landed (cd ${afterWait.cd})`);

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
    saveHvRec({ days: 1, beats: 0 });
    saveThermos({ uses: 0 });
    thermosUsed = false;
    G.morale = 50;
    G.goalIndex = GOALS.length;
    G.cooldowns = {};
    if (activeJobs.thermos) delete activeJobs.thermos;
    const a = ACTIONS.find(x => x.id === 'thermos');
    finishAction(a);
    return {
      morale: G.morale,
      used: thermosUsed,
      uses: loadThermos().uses,
      cd: G.cooldowns.thermos || 0,
    };
  });
  ok(lit.morale === 52 && lit.used && lit.uses === 1 && lit.cd > Date.now(),
    `a lit barrel still pours +2 morale and still takes the lock (morale ${lit.morale}, uses ${lit.uses})`);

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
