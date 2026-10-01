/*
 * HV-278 — Wave Marisol Down ran a job when she already
 * came by today.
 *
 * The tooltip says she swings past once a session. finishAction
 * already logs "Marisol already came by today — she has a garage
 * to run." doAction never asked. After a paid wave, clicking 🚗
 * again started the 2s job, then finishAction logged the garage
 * line and locked the button for the full 30s cooldown — the
 * same lock a real casserole earns. hvmarisol.js only drives
 * finishAction, so the timer seam stayed invisible.
 *
 * HV-101 / #776 (no story — the truck rolls past) is a different
 * gate: !marisolHasStory(), not marisolCame. Rain-on-the-
 * casserole (#904 / #901) and Biscuit-before-tamales (#874) are
 * other cards. This ticket is the same-session stamp vs the
 * timer. ui.js is not this ticket.
 *
 *  A. Source: doAction refuses when marisolCame before setTimeout,
 *     same log finishAction already uses. ui.js is not this ticket.
 *  B. A remembered bridge, one paid wave, then Wave Marisol Down
 *     again: no job, no extra food, no extra visit, and no
 *     cooldown even after the old 2s timer would have fired.
 *  C. Clearing the stamp still pays through finishAction and
 *     still takes the lock. Trade still refuses a short purse.
 *     A storyless bridge is still finishAction's (HV-101).
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
const finishBlock = finishAt >= 0 ? player.slice(finishAt) : '';
const timeoutAt = doBlock.indexOf('setTimeout');
const marisolAt = doBlock.indexOf("a.id==='marisol'");
const cameAt = doBlock.indexOf('marisolCame');

ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(marisolAt >= 0 && cameAt >= 0 && marisolAt < timeoutAt && cameAt < timeoutAt,
  'HV-278: doAction refuses Wave Marisol Down before the timer when she already came by');
ok(/once a session/.test(config) && /Wave Marisol Down/.test(config),
  'the card still promises she swings past once a session');
ok(/already came by today/.test(finishBlock),
  'finishAction still names the garage-to-run refuse — the line this gate copies');
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
    if (!sessionStorage.getItem('hvmarisolcame-init')) {
      sessionStorage.setItem('hvmarisolcame-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-letter');
      localStorage.removeItem('hv-plaque');
      localStorage.removeItem('hv-visitor');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const paid = await t(() => {
    saveHvRec({ days: 1, beats: 0 });
    saveHvStar({ cheers: 0 });
    saveMarisol({ visits: 0 });
    marisolCame = false;
    G.food = 10;
    G.cooldowns = {};
    finishAction(ACTIONS.find(x => x.id === 'marisol'));
    return {
      story: marisolHasStory(),
      came: marisolCame,
      food: G.food,
      visits: loadMarisol().visits,
      dish: marisolDish(),
    };
  });
  ok(paid.story && paid.came && paid.dish === 2 && paid.food === 12 && paid.visits === 1,
    `one remembered dawn still welcomes her (+2 food, visits ${paid.visits})`);

  const again = await t(() => {
    G.cooldowns = {};
    if (activeJobs.marisol) delete activeJobs.marisol;
    const a = ACTIONS.find(x => x.id === 'marisol');
    doAction(a);
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      job: !!activeJobs.marisol,
      cd: G.cooldowns.marisol || 0,
      food: G.food,
      visits: loadMarisol().visits,
      came: marisolCame,
      log,
      btnOn: !!(document.getElementById('action-marisol')
        && document.getElementById('action-marisol').classList.contains('active-job')),
    };
  });
  ok(!again.job && !again.btnOn,
    'a second wave does not start a job — the button is not active-job');
  ok(again.cd === 0 && again.food === 12 && again.visits === 1 && again.came,
    `a second wave takes no cooldown and does not fill the pot (cd ${again.cd}, food ${again.food})`);
  ok(/already came by today/.test(again.log),
    'the refuse is the same line finishAction already used');

  await page.waitForTimeout(2500);
  const afterWait = await t(() => ({
    cd: G.cooldowns.marisol || 0,
    food: G.food,
    job: !!activeJobs.marisol,
    visits: loadMarisol().visits,
    came: marisolCame,
  }));
  ok(afterWait.cd === 0 && afterWait.food === 12 && !afterWait.job && afterWait.visits === 1 && afterWait.came,
    `2.5s later the 30s lock still has not landed (cd ${afterWait.cd})`);

  const rearm = await t(() => {
    marisolCame = false;
    G.food = 10;
    G.cooldowns = {};
    finishAction(ACTIONS.find(x => x.id === 'marisol'));
    return {
      food: G.food,
      visits: loadMarisol().visits,
      came: marisolCame,
      cd: G.cooldowns.marisol || 0,
    };
  });
  ok(rearm.food === 12 && rearm.visits === 2 && rearm.came && rearm.cd > Date.now(),
    `clearing the stamp still fills the pot and still takes the lock (food ${rearm.food}, visits ${rearm.visits})`);

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
