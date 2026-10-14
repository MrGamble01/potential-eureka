/*
 * HV-219 — Leaf the Notebook ran a job when no notebook sat
 * by the fridge.
 *
 * The tooltip says three candles and a spiral notebook sits by
 * the fridge. notebookOut() is three anniversary toasts.
 * finishAction already logs "No notebook by the fridge yet —
 * three candles and somebody leaves one out." doAction never
 * asked. Clicking 📓 with two candles started the 2s job, then
 * finishAction logged the bare fridge and locked the button for
 * the full 30s cooldown — the same lock a real leaf-through
 * earns. hvnotebook.js only drives finishAction, so the timer
 * seam stayed invisible.
 *
 * Anniversary, the Reunion, the snapshot, and rain on an
 * unroofed corner are not this card.
 *
 *  A. Source: doAction refuses a bare fridge before setTimeout,
 *     same log finishAction already uses. ui.js is not this ticket.
 *  B. Two candles do not start a job, do not stamp notebookLeafed,
 *     and take no cooldown even after the old 2s timer would have
 *     fired.
 *  C. Three candles still pay through finishAction and still take
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
const leafAt = doBlock.indexOf("a.id==='guestbook'");

ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(leafAt >= 0 && leafAt < timeoutAt && /!notebookOut\(\)/.test(doBlock),
  'HV-219: doAction refuses Leaf the Notebook before the timer when no notebook sits by the fridge');
ok(/Three candles and a spiral notebook sits by the fridge/.test(config),
  'the card still asks for three candles and a notebook by the fridge');
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
    if (!sessionStorage.getItem('hvleafbare-init')) {
      sessionStorage.setItem('hvleafbare-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-anniversary');
      localStorage.removeItem('hv-guestbook');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const bare = await t(() => {
    saveHvAnniv({ toasts: 2 });
    saveHvGb({ leafs: 0 });
    notebookLeafed = false;
    G.food = 10;
    G.cooldowns = {};
    const a = ACTIONS.find(x => x.id === 'guestbook');
    doAction(a);
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      out: notebookOut(),
      job: !!activeJobs.guestbook,
      cd: G.cooldowns.guestbook || 0,
      food: G.food,
      leafs: loadHvGb().leafs,
      leafed: notebookLeafed,
      log,
      btnOn: !!(document.getElementById('action-guestbook')
        && document.getElementById('action-guestbook').classList.contains('active-job')),
    };
  });
  ok(!bare.out, 'two candles still leave no notebook out');
  ok(!bare.job && !bare.btnOn,
    'a bare fridge does not start a job — the button is not active-job');
  ok(bare.cd === 0 && bare.food === 10 && bare.leafs === 0 && !bare.leafed,
    `a bare fridge takes no cooldown and does not fill the pot (cd ${bare.cd}, food ${bare.food})`);
  ok(/No notebook by the fridge yet/.test(bare.log),
    'the refuse is the same line finishAction already used');

  await page.waitForTimeout(2500);
  const afterWait = await t(() => ({
    cd: G.cooldowns.guestbook || 0,
    food: G.food,
    job: !!activeJobs.guestbook,
    leafs: loadHvGb().leafs,
    leafed: notebookLeafed,
  }));
  ok(afterWait.cd === 0 && afterWait.food === 10 && !afterWait.job && afterWait.leafs === 0 && !afterWait.leafed,
    `2.5s later the 30s lock still has not landed (cd ${afterWait.cd})`);

  const standing = await t(() => {
    saveHvAnniv({ toasts: 3 });
    saveHvGb({ leafs: 0 });
    notebookLeafed = false;
    G.food = 10;
    G.cooldowns = {};
    finishAction(ACTIONS.find(x => x.id === 'guestbook'));
    return {
      out: notebookOut(),
      food: G.food,
      leafs: loadHvGb().leafs,
      leafed: notebookLeafed,
      cd: G.cooldowns.guestbook || 0,
    };
  });
  ok(standing.out && standing.food > 10 && standing.leafs === 1 && standing.leafed && standing.cd > Date.now(),
    `three candles still fill the pot and still take the lock (food ${standing.food}, leafs ${standing.leafs})`);

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
