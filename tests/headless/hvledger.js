/* HV-77 — Borrow from Ray locked the button for 30 seconds when a
 * loan was already out.
 *
 * HV-61 taught Trade / Rain Bet / Garage / Fridge to refuse in
 * doAction *before* the timer. Borrow from Ray did not. The tooltip
 * says one ledger at a time ("until 5 is repaid"). finishAction
 * already knew: "Ray taps his ledger — X still owed. One at a time."
 * Clicking 🤲 with debt standing still started the 2-second job,
 * chimed success, logged that refuse, then locked the button for the
 * full 30-second cooldown — the same lock a real front earns.
 *
 * Distinct from HV-30 (the loan itself), HV-61 (the four cost gates),
 * and hvborrow.js (which calls finishAction, not doAction).
 * ui.js is not this ticket.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: doAction refuses borrow when rayDebt > 0 before
 *    setTimeout, same log line finishAction already used.
 * B. Named: click Borrow with a standing loan — immediate refuse, no
 *    job, no cooldown after the old 2s timer would have fired, debt
 *    and goodwill unchanged.
 * C. Isolation: a clear ledger still fronts 4 and books 5, and still
 *    takes the lock.
 * Z. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui     = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const doAt = player.indexOf('function doAction(a){');
const finishAt = player.indexOf('function finishAction(a){');
const doBlock = doAt >= 0 && finishAt > doAt ? player.slice(doAt, finishAt) : '';
const finishBorrowAt = player.indexOf("} else if(a.id==='borrow')");
const finish = finishBorrowAt >= 0 ? player.slice(finishBorrowAt, finishBorrowAt + 400) : '';

ok(doAt >= 0 && /function doAction\(a\)\{/.test(doBlock),
  'doAction is still in player.js — guards the guard');

const timeoutAt = doBlock.indexOf('setTimeout');
ok(timeoutAt > 0, 'doAction still starts the job with setTimeout');

const borrowAt = doBlock.indexOf("a.id==='borrow'");
ok(borrowAt >= 0 && borrowAt < timeoutAt && /rayDebt/.test(doBlock.slice(borrowAt, timeoutAt)),
  'doAction refuses Borrow when a loan is already out, before the timer');

ok(/One at a time/.test(doBlock) && /One at a time/.test(finish),
  'the refuse is the same line finishAction already used');

ok(/a\.id==='trade'/.test(doBlock) && /G\.cans\s*<\s*3/.test(doBlock),
  'HV-61 Trade refuse is still in doAction — this ticket did not eat it');

ok(!/function buildActionUI/.test(doBlock) && !/rayDebt/.test(ui),
  'the ledger gate lives in doAction — ui.js is not this ticket');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {}
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    const a = ACTIONS.find(x => x.id === 'borrow');
    return {
      intro: !!(document.getElementById('intro-modal') && document.getElementById('intro-modal').classList.contains('open')),
      btn: !!document.getElementById('action-borrow'),
      time: a && a.time,
      cd: a && a.cooldown,
      amt: BORROW_AMT,
      owed: BORROW_OWED,
    };
  });
  ok(!boot.intro && boot.btn,
    'a returning camp has Borrow on the board and is not behind the crash course');
  ok(boot.time === 2000 && boot.cd === 30000 && boot.amt === 4 && boot.owed === 5,
    `Borrow is still a 2s job with a 30s lock, 4 against 5 (${boot.time}/${boot.cd}/${boot.amt}/${boot.owed})`);

  // --- B. named ---------------------------------------------------------
  const owed = await page.evaluate(() => {
    G.rayDebt = 5;
    G.goodwill = 3;
    G.cooldowns = {};
    const before = Date.now();
    doAction(ACTIONS.find(a => a.id === 'borrow'));
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      job: !!activeJobs.borrow,
      cd: G.cooldowns.borrow || 0,
      debt: G.rayDebt,
      gw: G.goodwill,
      log: log,
      btnOn: document.getElementById('action-borrow') && document.getElementById('action-borrow').classList.contains('active-job'),
      started: Date.now() - before,
    };
  });
  ok(!owed.job && !owed.btnOn,
    'a standing loan does not start a job — the button is not active-job');
  ok(owed.cd === 0 && owed.debt === 5 && owed.gw === 3,
    `HV-77: a standing loan takes no cooldown and no extra goodwill (cd ${owed.cd}, debt ${owed.debt}, gw ${owed.gw})`);
  ok(/One at a time/.test(owed.log) && /still owed/.test(owed.log),
    'the refuse is the same line finishAction already used — named, not silent');

  await page.waitForTimeout(2500);
  const afterWait = await page.evaluate(() => ({
    cd: G.cooldowns.borrow || 0,
    debt: G.rayDebt,
    gw: G.goodwill,
    job: !!activeJobs.borrow,
  }));
  ok(afterWait.cd === 0 && afterWait.debt === 5 && afterWait.gw === 3 && !afterWait.job,
    `2.5s later the 30s lock still has not landed (cd ${afterWait.cd}) — reverting the guard fails this by name`);

  // --- C. isolation -----------------------------------------------------
  const clear = await page.evaluate(() => {
    G.rayDebt = 0;
    G.goodwill = 1;
    G.cooldowns = {};
    finishAction(ACTIONS.find(a => a.id === 'borrow'));
    return { gw: G.goodwill, debt: G.rayDebt, cd: G.cooldowns.borrow || 0 };
  });
  ok(clear.gw === 5 && clear.debt === 5 && clear.cd > Date.now(),
    `a clear ledger still fronts 4, books 5, and still takes the lock (gw ${clear.gw}, debt ${clear.debt})`);

  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
