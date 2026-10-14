/*
 * HV-222 — Sit on the Bench ran a job when no bench stood
 * by the fridge.
 *
 * The tooltip says three leafs through the notebook and folks
 * build a bench by the fridge. hvBenchBuilt() is three leafs.
 * finishAction already logs "No bench by the fridge yet — three
 * leafs through the notebook and somebody starts building."
 * doAction never asked. Clicking 🪑 with two leafs started the
 * 2s job, then finishAction logged the missing bench and locked
 * the button for the full 30s cooldown — the same lock a real
 * sit earns. hvbench.js only drives finishAction, so the timer
 * seam stayed invisible.
 *
 * Sit on the Bench paying only food (HV-113) is not this card.
 * Leaf the Notebook's own bare-fridge refuse is not this card.
 *
 *  A. Source: doAction refuses an unbuilt bench before setTimeout,
 *     same log finishAction already uses. ui.js is not this ticket.
 *  B. Two leafs do not start a job, do not stamp benchSat, and
 *     take no cooldown even after the old 2s timer would have
 *     fired.
 *  C. Three leafs still pay through finishAction and still take
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
const benchAt = doBlock.indexOf("a.id==='bench'");

ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(benchAt >= 0 && benchAt < timeoutAt && /!hvBenchBuilt\(\)/.test(doBlock),
  'HV-222: doAction refuses Sit on the Bench before the timer when no bench stands by the fridge');
ok(/Three leafs through the notebook and folks build a bench by the fridge/.test(config),
  'the card still asks for three leafs and a bench by the fridge');
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
    if (!sessionStorage.getItem('hvbenchbare-init')) {
      sessionStorage.setItem('hvbenchbare-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-guestbook');
      localStorage.removeItem('hv-bench');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const bare = await t(() => {
    saveHvGb({ leafs: 2 });
    saveHvBench({ sits: 0 });
    benchSat = false;
    G.food = 10;
    G.cooldowns = {};
    const a = ACTIONS.find(x => x.id === 'bench');
    doAction(a);
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      built: hvBenchBuilt(),
      job: !!activeJobs.bench,
      cd: G.cooldowns.bench || 0,
      food: G.food,
      sits: loadHvBench().sits,
      sat: benchSat,
      log,
      btnOn: !!(document.getElementById('action-bench')
        && document.getElementById('action-bench').classList.contains('active-job')),
    };
  });
  ok(!bare.built, 'two leafs still leave no bench by the fridge');
  ok(!bare.job && !bare.btnOn,
    'an unbuilt bench does not start a job — the button is not active-job');
  ok(bare.cd === 0 && bare.food === 10 && bare.sits === 0 && !bare.sat,
    `an unbuilt bench takes no cooldown and does not fill the pot (cd ${bare.cd}, food ${bare.food})`);
  ok(/No bench by the fridge yet/.test(bare.log),
    'the refuse is the same line finishAction already used');

  await page.waitForTimeout(2500);
  const afterWait = await t(() => ({
    cd: G.cooldowns.bench || 0,
    food: G.food,
    job: !!activeJobs.bench,
    sits: loadHvBench().sits,
    sat: benchSat,
  }));
  ok(afterWait.cd === 0 && afterWait.food === 10 && !afterWait.job && afterWait.sits === 0 && !afterWait.sat,
    `2.5s later the 30s lock still has not landed (cd ${afterWait.cd})`);

  const standing = await t(() => {
    saveHvGb({ leafs: 3 });
    saveHvBench({ sits: 0 });
    benchSat = false;
    G.food = 10;
    G.cooldowns = {};
    finishAction(ACTIONS.find(x => x.id === 'bench'));
    return {
      built: hvBenchBuilt(),
      food: G.food,
      sits: loadHvBench().sits,
      sat: benchSat,
      cd: G.cooldowns.bench || 0,
    };
  });
  ok(standing.built && standing.food > 10 && standing.sits === 1 && standing.sat && standing.cd > Date.now(),
    `three leafs still fill the pot and still take the lock (food ${standing.food}, sits ${standing.sits})`);

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
