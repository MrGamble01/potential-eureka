/*
 * HV-282 — Stand at the Fifth Panel ran a job when the four
 * were still bare.
 *
 * The tooltip says somebody primes a fifth panel beside the
 * finished mural. finishAction already logs "The fifth is
 * waiting on the four — the mural is still unfinished, four
 * squares still bare." and leaves the pot, the tally, and the
 * session latch alone (HV-208). doAction never asked. Clicking
 * 🎨 with three digs and G.mural at 0 started the 2s job, then
 * finishAction named the missing four and locked the button
 * for the full 30s cooldown — the same lock a real stand earns.
 * hvfifthmural.js only drives finishAction, so the timer seam
 * stayed invisible. hvpanelbare.js owns the other gate
 * (panelPainted() / two digs).
 *
 * Distinct from HV-208 / hvfifthmural (paid while four-panels
 * short — finishAction only), HV-227 / hvpanelbare (bare block,
 * two digs), HV-224 (same button, digs gate), #794 (stand latch
 * vs dawn), #860 (wet paint). Already-today on this button is
 * not this card. ui.js is not this ticket.
 *
 *  A. Source: doAction refuses a fifth waiting on the four
 *     before setTimeout, same log finishAction already uses.
 *     ui.js is not this ticket.
 *  B. Three digs beside zero panels do not start a job, do
 *     not stamp panelStood, and take no cooldown even after
 *     the old 2s timer would have fired.
 *  C. Three digs beside a finished mural still pay through
 *     finishAction and still take the lock. Two digs still
 *     name bare block. Trade still refuses a short purse.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives doAction() on the production action.
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
const waitLogAt = doBlock.indexOf('waiting on the four');

ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(waitLogAt >= 0 && waitLogAt < timeoutAt,
  'HV-282: doAction refuses Stand at the Fifth Panel before the timer when the four are still bare');
ok(/beside the finished mural/.test(config) && /MURAL_PANELS\s*=\s*4/.test(config),
  'the card still asks for a fifth panel beside the finished mural');
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
    if (!sessionStorage.getItem('hvfifthwait-init')) {
      sessionStorage.setItem('hvfifthwait-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-capsule');
      localStorage.removeItem('hv-mural');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = (fn, arg) => arg === undefined ? page.evaluate(fn) : page.evaluate(fn, arg);

  const waiting = await t(() => {
    saveHvCan({ digs: 3 });
    saveHvPanel({ stands: 0 });
    panelStood = false;
    G.mural = 0;
    G.food = 10;
    G.cooldowns = {};
    G.goalIndex = GOALS.length;
    const a = ACTIONS.find(x => x.id === 'fifth');
    doAction(a);
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      painted: panelPainted(),
      mural: G.mural,
      job: !!activeJobs.fifth,
      cd: G.cooldowns.fifth || 0,
      food: G.food,
      stands: loadHvPanel().stands,
      stood: panelStood,
      log,
      btnOn: !!(document.getElementById('action-fifth')
        && document.getElementById('action-fifth').classList.contains('active-job')),
    };
  });
  ok(waiting.painted && waiting.mural === 0, 'three digs still leave the four unfinished');
  ok(!waiting.job && !waiting.btnOn,
    'HV-282: a fifth waiting on the four does not start a job — the button is not active-job');
  ok(waiting.cd === 0 && waiting.food === 10 && waiting.stands === 0 && !waiting.stood,
    `a fifth waiting on the four takes no cooldown and does not fill the pot (cd ${waiting.cd}, food ${waiting.food})`);
  ok(/waiting on the four/.test(waiting.log),
    'the refuse is the same line finishAction already used');

  await page.waitForTimeout(2500);
  const afterWait = await t(() => ({
    cd: G.cooldowns.fifth || 0,
    food: G.food,
    job: !!activeJobs.fifth,
    stands: loadHvPanel().stands,
    stood: panelStood,
  }));
  ok(afterWait.cd === 0 && afterWait.food === 10 && !afterWait.job && afterWait.stands === 0 && !afterWait.stood,
    `2.5s later the 30s lock still has not landed (cd ${afterWait.cd})`);

  const standing = await t(() => {
    saveHvCan({ digs: 3 });
    saveHvPanel({ stands: 0 });
    panelStood = false;
    G.mural = 4;
    G.food = 10;
    G.cooldowns = {};
    G.goalIndex = GOALS.length;
    finishAction(ACTIONS.find(x => x.id === 'fifth'));
    return {
      painted: panelPainted(),
      food: G.food,
      stands: loadHvPanel().stands,
      stood: panelStood,
      cd: G.cooldowns.fifth || 0,
    };
  });
  ok(standing.painted && standing.food > 10 && standing.stands === 1 && standing.stood && standing.cd > Date.now(),
    `three digs beside a finished mural still fill the pot and still take the lock (food ${standing.food}, stands ${standing.stands})`);

  const bare = await t(() => {
    saveHvCan({ digs: 2 });
    saveHvPanel({ stands: 0 });
    panelStood = false;
    G.mural = 0;
    G.food = 10;
    G.cooldowns = {};
    G.goalIndex = GOALS.length;
    doAction(ACTIONS.find(x => x.id === 'fifth'));
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      painted: panelPainted(),
      job: !!activeJobs.fifth,
      cd: G.cooldowns.fifth || 0,
      food: G.food,
      log,
    };
  });
  ok(!bare.painted && !bare.job && bare.cd === 0 && bare.food === 10 && /still bare block/.test(bare.log),
    'two digs still name bare block before the timer — HV-227 stays on that gate');

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
