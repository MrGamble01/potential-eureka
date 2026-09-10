/*
 * HV-242 — Leaf the Notebook said once a session, then a
 * second click still ran the job.
 *
 * The tooltip says Leaf through it once a session. finishAction
 * already logs "The notebook got its leaf-through today — the
 * names keep." and no-ops. Clicking 📓 after notebookLeafed
 * still started the 2s job and charged the 30s lock as if
 * another name had left something behind.
 *
 * Distinct from HV-219 / #913 (no notebook sat by the fridge),
 * HV-238 / #933 (the reunion already went off), HV-230 / #924
 * (the snapshot already got its look), HV-236 / #931 (the
 * thermos already made its round). This ticket is the notebook
 * after it already got its leaf. ui.js is not this ticket.
 *
 *  A. Source: doAction names the notebookLeafed gate before
 *     setTimeout, only when the notebook is out. The refuse
 *     log still says the names keep. ui.js is not this ticket.
 *  B. An out notebook that already got its leaf: no job, no
 *     extra tally, no food, and no cooldown even after the old
 *     2s timer would have fired. The log names the already-
 *     leafed page.
 *  C. Rest still works after the refuse.
 *  D. A first leaf still fills the pot and stamps
 *     notebookLeafed. Two candles still refuse. Trade still
 *     refuses a short purse.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives doAction + finishAction.
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
const doAt = player.indexOf('function doAction(a){');
const finishAt = player.indexOf('function finishAction(a){');
const doBlock = doAt >= 0 && finishAt > doAt ? player.slice(doAt, finishAt) : '';
const finishBlock = finishAt >= 0 ? player.slice(finishAt) : '';
const timeoutAt = doBlock.indexOf('setTimeout');
const bookAt = doBlock.indexOf("a.id==='guestbook'");
const leafedAt = doBlock.indexOf('notebookLeafed');

ok(/Leaf through it once a session/.test(cfg) && /left something behind/.test(cfg),
  'Leaf the Notebook still promises one leaf-through a session');
ok(/got its leaf-through today/.test(finishBlock) && /the names keep/.test(finishBlock),
  'the refuse log still names the already-leafed page');
ok(/leaf through the spiral notebook/.test(finishBlock) && /left something behind/.test(finishBlock),
  'the pay log still fills the pot from a name on the page');
ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(bookAt >= 0 && leafedAt >= 0 && bookAt < timeoutAt && leafedAt < timeoutAt
   && /notebookOut\(\)/.test(doBlock),
  'HV-242: doAction refuses an out already-leafed notebook before the timer');
ok(!/homeless-village\/js\/ui\.js/.test(player),
  'the already-leafed gate lives in doAction — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvnotebookleaf-init')) {
      sessionStorage.setItem('hvnotebookleaf-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-anniversary');
      localStorage.removeItem('hv-guestbook');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    saveHvAnniv({ toasts: 3 });
    saveHvGb({ leafs: 1 });
    notebookLeafed = true;
    return {
      out: notebookOut(),
      dish: notebookDish(),
      leafed: notebookLeafed,
      label: ACTIONS.find(a => a.id === 'guestbook') && ACTIONS.find(a => a.id === 'guestbook').label,
    };
  });
  ok(boot.out && boot.dish === 7 && boot.leafed,
    `an out notebook that already got its leaf still dishes 7 (${boot.dish})`);
  ok(boot.label === 'Leaf the Notebook',
    `the row is still Leaf the Notebook (${boot.label})`);

  const leafed = await page.evaluate(() => {
    const a = ACTIONS.find(x => x.id === 'guestbook');
    saveHvAnniv({ toasts: 3 });
    saveHvGb({ leafs: 1 });
    notebookLeafed = true;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.guestbook) delete activeJobs.guestbook;
    const before = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    doAction(a);
    const after = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const added = after.filter((line, i) => line !== before[i]).join('\n');
    return {
      job: !!activeJobs.guestbook,
      leafed: notebookLeafed,
      food: G.food,
      tally: loadHvGb().leafs,
      cd: G.cooldowns.guestbook || 0,
      added: added,
      btnOn: !!(document.getElementById('action-guestbook')
        && document.getElementById('action-guestbook').classList.contains('active-job')),
    };
  });
  ok(!leafed.job && !leafed.btnOn && leafed.leafed && leafed.food === 10
     && leafed.tally === 1 && leafed.cd === 0,
    `HV-242: an already-leafed notebook does not start the job (job ${leafed.job}, food ${leafed.food}, leafs ${leafed.tally})`);
  ok(/leaf-through today|names keep/i.test(leafed.added),
    `the refuse names the already-leafed page — not a silent no-op (${leafed.added.slice(-90)})`);

  await page.waitForTimeout(2500);
  const afterWait = await page.evaluate(() => ({
    cd: G.cooldowns.guestbook || 0,
    food: G.food,
    job: !!activeJobs.guestbook,
    leafed: notebookLeafed,
    tally: loadHvGb().leafs,
  }));
  ok(afterWait.cd === 0 && afterWait.food === 10 && !afterWait.job
     && afterWait.leafed && afterWait.tally === 1,
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
    `Rest still works after the refuse (health ${rest.health})`);

  const first = await page.evaluate(() => {
    saveHvAnniv({ toasts: 3 });
    saveHvGb({ leafs: 0 });
    notebookLeafed = false;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.guestbook) delete activeJobs.guestbook;
    finishAction(ACTIONS.find(x => x.id === 'guestbook'));
    return {
      food: G.food,
      leafed: notebookLeafed,
      tally: loadHvGb().leafs,
      cd: G.cooldowns.guestbook || 0,
    };
  });
  ok(first.food === 17 && first.leafed && first.tally === 1 && first.cd > Date.now(),
    `a first leaf still fills the pot and still takes the lock (food ${first.food}, leafs ${first.tally})`);

  const bare = await page.evaluate(() => {
    saveHvAnniv({ toasts: 2 });
    saveHvGb({ leafs: 4 });
    notebookLeafed = false;
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.guestbook) delete activeJobs.guestbook;
    finishAction(ACTIONS.find(x => x.id === 'guestbook'));
    return {
      out: notebookOut(),
      food: G.food,
      leafed: notebookLeafed,
      tally: loadHvGb().leafs,
    };
  });
  ok(!bare.out && bare.food === 10 && !bare.leafed && bare.tally === 4,
    `two candles still refuse (out ${bare.out}, leafs ${bare.tally})`);

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
