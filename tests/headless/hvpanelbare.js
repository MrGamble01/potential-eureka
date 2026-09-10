/*
 * HV-224 — Stand at the Fifth Panel ran a job when the fifth
 * panel was still bare block.
 *
 * The tooltip says three digs of the coffee can prime a fifth
 * panel beside the finished mural. panelPainted() is three digs.
 * finishAction already logs "The fifth panel is still bare block
 * — three digs of the can and somebody primes it." doAction
 * never asked. Clicking 🎨 with two digs started the 2s job,
 * then finishAction logged the bare block and locked the button
 * for the full 30s cooldown — the same lock a real stand earns.
 * hvpanel.js only drives finishAction, so the timer seam stayed
 * invisible.
 *
 * HV-208 (paid while the community mural was still four-panels
 * short) is a different gate: G.mural < 4, not panelPainted().
 * Dig Up the Coffee Can's own buried-can refuse is not this card.
 *
 *  A. Source: doAction refuses a bare fifth panel before setTimeout,
 *     same log finishAction already uses. ui.js is not this ticket.
 *  B. Two digs do not start a job, do not stamp panelStood, and
 *     take no cooldown even after the old 2s timer would have
 *     fired.
 *  C. Three digs still pay through finishAction and still take
 *     the lock. Trade still refuses a short purse.
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
const fifthAt = doBlock.indexOf("a.id==='fifth'");

ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(fifthAt >= 0 && fifthAt < timeoutAt && /!panelPainted\(\)/.test(doBlock),
  'HV-224: doAction refuses Stand at the Fifth Panel before the timer when the fifth panel is still bare block');
ok(/Three digs of the coffee can and somebody primes a fifth panel beside the finished mural/.test(config),
  'the card still asks for three digs and a fifth panel beside the mural');
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
    if (!sessionStorage.getItem('hvpanelbare-init')) {
      sessionStorage.setItem('hvpanelbare-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-capsule');
      localStorage.removeItem('hv-mural');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const bare = await t(() => {
    saveHvCan({ digs: 2 });
    saveHvPanel({ stands: 0 });
    panelStood = false;
    G.food = 10;
    G.cooldowns = {};
    const a = ACTIONS.find(x => x.id === 'fifth');
    doAction(a);
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      painted: panelPainted(),
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
  ok(!bare.painted, 'two digs still leave the fifth panel bare block');
  ok(!bare.job && !bare.btnOn,
    'a bare fifth panel does not start a job — the button is not active-job');
  ok(bare.cd === 0 && bare.food === 10 && bare.stands === 0 && !bare.stood,
    `a bare fifth panel takes no cooldown and does not fill the pot (cd ${bare.cd}, food ${bare.food})`);
  ok(/still bare block/.test(bare.log),
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
    G.food = 10;
    G.cooldowns = {};
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
    `three digs still fill the pot and still take the lock (food ${standing.food}, stands ${standing.stands})`);

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
