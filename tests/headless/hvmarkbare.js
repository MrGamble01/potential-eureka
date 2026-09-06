/*
 * HV-223 — Add a Name ran a job when nobody new had been
 * shown the wall.
 *
 * The tooltip says three walks down the underpass and the
 * newcomer who got shown all of it takes the chalk. markUp()
 * is three walks. finishAction already logs "Nobody new has
 * been shown the whole wall yet — three walks down the
 * underpass and somebody takes the chalk." doAction never
 * asked. Clicking ✍️ with two walks started the 2s job, then
 * finishAction logged the missing walk and locked the button
 * for the full 30s cooldown — the same lock a real name earns.
 * hvmark.js only drives finishAction, so the timer seam stayed
 * invisible.
 *
 * Read the Wall never reading the names (HV-209) is not this
 * card. Walk a Newcomer's own bare-wall refuse is not this card.
 *
 *  A. Source: doAction refuses an unshown wall before setTimeout,
 *     same log finishAction already uses. ui.js is not this ticket.
 *  B. Two walks do not start a job, do not stamp markAdded, and
 *     take no cooldown even after the old 2s timer would have
 *     fired.
 *  C. Three walks still pay through finishAction and still take
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
const markAt = doBlock.indexOf("a.id==='mark'");

ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(markAt >= 0 && markAt < timeoutAt && /!markUp\(\)/.test(doBlock),
  'HV-223: doAction refuses Add a Name before the timer when nobody new has been shown the wall');
ok(/Three walks down the underpass and the newcomer who got shown all of it takes the chalk/.test(config),
  'the card still asks for three walks and a name in their hand');
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
    if (!sessionStorage.getItem('hvmarkbare-init')) {
      sessionStorage.setItem('hvmarkbare-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-docent');
      localStorage.removeItem('hv-mark');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const bare = await t(() => {
    saveHvWalk({ walks: 2 });
    saveHvMark({ names: 0 });
    markAdded = false;
    G.food = 10;
    G.cooldowns = {};
    const a = ACTIONS.find(x => x.id === 'mark');
    doAction(a);
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      up: markUp(),
      job: !!activeJobs.mark,
      cd: G.cooldowns.mark || 0,
      food: G.food,
      names: loadHvMark().names,
      added: markAdded,
      log,
      btnOn: !!(document.getElementById('action-mark')
        && document.getElementById('action-mark').classList.contains('active-job')),
    };
  });
  ok(!bare.up, 'two walks still leave nobody new shown the whole wall');
  ok(!bare.job && !bare.btnOn,
    'an unshown wall does not start a job — the button is not active-job');
  ok(bare.cd === 0 && bare.food === 10 && bare.names === 0 && !bare.added,
    `an unshown wall takes no cooldown and does not fill the pot (cd ${bare.cd}, food ${bare.food})`);
  ok(/Nobody new has been shown the whole wall yet/.test(bare.log),
    'the refuse is the same line finishAction already used');

  await page.waitForTimeout(2500);
  const afterWait = await t(() => ({
    cd: G.cooldowns.mark || 0,
    food: G.food,
    job: !!activeJobs.mark,
    names: loadHvMark().names,
    added: markAdded,
  }));
  ok(afterWait.cd === 0 && afterWait.food === 10 && !afterWait.job && afterWait.names === 0 && !afterWait.added,
    `2.5s later the 30s lock still has not landed (cd ${afterWait.cd})`);

  const standing = await t(() => {
    saveHvWalk({ walks: 3 });
    saveHvMark({ names: 0 });
    markAdded = false;
    G.food = 10;
    G.cooldowns = {};
    finishAction(ACTIONS.find(x => x.id === 'mark'));
    return {
      up: markUp(),
      food: G.food,
      names: loadHvMark().names,
      added: markAdded,
      cd: G.cooldowns.mark || 0,
    };
  });
  ok(standing.up && standing.food > 10 && standing.names === 1 && standing.added && standing.cd > Date.now(),
    `three walks still fill the pot and still take the lock (food ${standing.food}, names ${standing.names})`);

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
