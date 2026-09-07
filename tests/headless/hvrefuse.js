/* HV-61 — broke Trade (and the other cost-gated actions) still ran the
 * timer and locked the button.
 *
 * Scavenge, the mural, a newcomer's bed and the bus fare already refuse
 * in doAction *before* the job starts: log, error blip, return. Trade
 * Goods did not. The tooltip says "3 cans → 2 food". A new camp has
 * zero cans. Clicking Trade started a 2-second job, played the success
 * sound, logged "Not enough cans to trade.", then locked the button
 * for the full 18-second cooldown — the same lock a successful trade
 * earns. Rain Bet, Garage Favor and the Corner Fridge did the same
 * with a 30-second lock.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: doAction names the four cost gates before setTimeout, the
 *    same shape mural already uses. ui.js is not in this ticket.
 * B. Behaviour: click Trade with empty pockets — immediate refuse, no
 *    active job, no cooldown after the old 2s timer would have fired,
 *    cans unchanged. Three cans still trades. Rain Bet and Garage
 *    Favor refuse a short purse the same way. A funded trade still
 *    takes the cooldown — we did not turn the lock off, we stopped
 *    charging it for a miss.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const doAt = player.indexOf('function doAction(a){');
const finishAt = player.indexOf('function finishAction(a){');
const doBlock = doAt >= 0 && finishAt > doAt ? player.slice(doAt, finishAt) : '';

(async () => {
  // --- A. source --------------------------------------------------------
  ok(doAt >= 0 && /function doAction\(a\)\{/.test(doBlock),
     'doAction is still in player.js — guards the guard');

  ok(/a\.id==='mural'/.test(doBlock) && /G\.scraps<2/.test(doBlock),
     'the mural still refuses a short purse before the timer — the pattern this ticket copies');

  const timeoutAt = doBlock.indexOf('setTimeout');
  ok(timeoutAt > 0, 'doAction still starts the job with setTimeout');

  const tradeAt = doBlock.indexOf("a.id==='trade'");
  ok(tradeAt >= 0 && tradeAt < timeoutAt && /G\.cans\s*<\s*3/.test(doBlock),
     'doAction refuses Trade when cans < 3, before the timer starts');

  const rainAt = doBlock.indexOf("a.id==='rainbet'");
  ok(rainAt >= 0 && rainAt < timeoutAt && /RAINBET_STAKE/.test(doBlock),
     'doAction refuses a broke Rain Bet before the timer');

  const garageAt = doBlock.indexOf("a.id==='garage'");
  ok(garageAt >= 0 && garageAt < timeoutAt && /GARAGE_COST/.test(doBlock),
     'doAction refuses a broke Garage Favor before the timer');

  const fridgeAt = doBlock.indexOf("a.id==='fridge'");
  ok(fridgeAt >= 0 && fridgeAt < timeoutAt && /FRIDGE_COST/.test(doBlock),
     'doAction refuses a broke Corner Fridge before the timer');

  ok(!/homeless-village\/js\/ui\.js/.test(player) && !/function buildActionUI/.test(doBlock),
     'the refuse gates live in doAction — ui.js is not this ticket');

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

  // --- B. behaviour -----------------------------------------------------
  const boot = await page.evaluate(() => ({
    intro: !!(document.getElementById('intro-modal') && document.getElementById('intro-modal').classList.contains('open')),
    trade: !!document.getElementById('action-trade'),
    cans: G.cans,
    cd: ACTIONS.find(a => a.id === 'trade').cooldown,
    time: ACTIONS.find(a => a.id === 'trade').time,
  }));
  ok(!boot.intro && boot.trade,
     'a returning camp has Trade on the board and is not behind the crash course');
  ok(boot.cd === 18000 && boot.time === 2000,
     `Trade is still a 2s job with an 18s lock (${boot.time}/${boot.cd})`);

  const broke = await page.evaluate(() => {
    G.cans = 0; G.food = 0; G.cooldowns = {};
    const before = Date.now();
    doAction(ACTIONS.find(a => a.id === 'trade'));
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      job: !!activeJobs.trade,
      cd: G.cooldowns.trade || 0,
      cans: G.cans, food: G.food,
      log: log,
      btnOn: document.getElementById('action-trade') && document.getElementById('action-trade').classList.contains('active-job'),
      started: Date.now() - before,
    };
  });
  ok(!broke.job && !broke.btnOn,
     'broke Trade does not start a job — the button is not active-job');
  ok(broke.cd === 0 && broke.cans === 0 && broke.food === 0,
     `broke Trade takes no cooldown and no cans (cd ${broke.cd}, cans ${broke.cans})`);
  ok(/Not enough cans to trade/.test(broke.log),
     'the refuse is the same line finishAction already used — named, not silent');

  // The old bug applied the 18s lock when the 2s timer fired. Wait past
  // that window and the lock must still be absent.
  await page.waitForTimeout(2500);
  const afterWait = await page.evaluate(() => ({
    cd: G.cooldowns.trade || 0,
    cans: G.cans, food: G.food,
    job: !!activeJobs.trade,
  }));
  ok(afterWait.cd === 0 && afterWait.cans === 0 && !afterWait.job,
     `2.5s later the 18s lock still has not landed (cd ${afterWait.cd}) — reverting the guard fails this by name`);

  const funded = await page.evaluate(() => {
    G.cans = 3; G.food = 0; G.cooldowns = {};
    finishAction(ACTIONS.find(a => a.id === 'trade'));
    return { cans: G.cans, food: G.food, cd: G.cooldowns.trade || 0 };
  });
  ok(funded.cans === 0 && funded.food === 2 && funded.cd > Date.now(),
     `three cans still trade for two food and still take the lock (cans ${funded.cans}, food ${funded.food})`);

  const rain = await page.evaluate(() => {
    G.goodwill = 0; G.rainBetOn = false; G.rainBetDay = -9; G.cooldowns = {};
    doAction(ACTIONS.find(a => a.id === 'rainbet'));
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return { job: !!activeJobs.rainbet, cd: G.cooldowns.rainbet || 0, gw: G.goodwill, log: log };
  });
  ok(!rain.job && rain.cd === 0 && rain.gw === 0 && /Not enough goodwill to cover the stake/.test(rain.log),
     'broke Rain Bet refuses before the timer and does not take the 30s lock');

  const garage = await page.evaluate(() => {
    G.goodwill = 0; G.garageCover = false; G.cooldowns = {};
    doAction(ACTIONS.find(a => a.id === 'garage'));
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return { job: !!activeJobs.garage, cd: G.cooldowns.garage || 0, gw: G.goodwill, log: log };
  });
  ok(!garage.job && garage.cd === 0 && garage.gw === 0 && /Not enough goodwill to ask the favor/.test(garage.log),
     'broke Garage Favor refuses before the timer and does not take the 30s lock');

  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
