/*
 * HV-221 — Play the Bridge Ballad ran a job when no tune was set.
 *
 * The tooltip says three tellings of the fire story and the busker
 * sets it to a tune. balladSet() is three tellings. finishAction
 * already logs "No ballad yet — three tellings of the fire story
 * and the busker finds the tune." doAction never asked. Clicking 🎸
 * with two tellings started the 2s job, then finishAction logged
 * the missing tune and locked the button for the full 30s cooldown
 * — the same lock a real playing earns. hvballad.js only drives
 * finishAction, so the timer seam stayed invisible.
 *
 * The hat-by-the-fire / dead-barrel card (HV-192) is not this card.
 * Tell the Fire Story's own bare-story refuse is not this card.
 *
 *  A. Source: doAction refuses an unset ballad before setTimeout,
 *     same log finishAction already uses. ui.js is not this ticket.
 *  B. Two tellings do not start a job, do not stamp balladPlayed,
 *     and take no cooldown even after the old 2s timer would have
 *     fired.
 *  C. Three tellings still pay through finishAction and still take
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
const balladAt = doBlock.indexOf("a.id==='ballad'");

ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(balladAt >= 0 && balladAt < timeoutAt && /!balladSet\(\)/.test(doBlock),
  'HV-221: doAction refuses Play the Bridge Ballad before the timer when no tune is set');
ok(/Three tellings of the fire story and the busker sets it to a tune/.test(config),
  'the card still asks for three tellings and a tune');
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
    if (!sessionStorage.getItem('hvballadbare-init')) {
      sessionStorage.setItem('hvballadbare-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-storyhour');
      localStorage.removeItem('hv-song');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const bare = await t(() => {
    saveHvStory({ tellings: 2 });
    saveHvSong({ plays: 0 });
    balladPlayed = false;
    G.food = 10;
    G.cooldowns = {};
    const a = ACTIONS.find(x => x.id === 'ballad');
    doAction(a);
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      set: balladSet(),
      job: !!activeJobs.ballad,
      cd: G.cooldowns.ballad || 0,
      food: G.food,
      plays: loadHvSong().plays,
      played: balladPlayed,
      log,
      btnOn: !!(document.getElementById('action-ballad')
        && document.getElementById('action-ballad').classList.contains('active-job')),
    };
  });
  ok(!bare.set, 'two tellings still find no tune');
  ok(!bare.job && !bare.btnOn,
    'an unset ballad does not start a job — the button is not active-job');
  ok(bare.cd === 0 && bare.food === 10 && bare.plays === 0 && !bare.played,
    `an unset ballad takes no cooldown and does not fill the hat (cd ${bare.cd}, food ${bare.food})`);
  ok(/No ballad yet/.test(bare.log),
    'the refuse is the same line finishAction already used');

  await page.waitForTimeout(2500);
  const afterWait = await t(() => ({
    cd: G.cooldowns.ballad || 0,
    food: G.food,
    job: !!activeJobs.ballad,
    plays: loadHvSong().plays,
    played: balladPlayed,
  }));
  ok(afterWait.cd === 0 && afterWait.food === 10 && !afterWait.job && afterWait.plays === 0 && !afterWait.played,
    `2.5s later the 30s lock still has not landed (cd ${afterWait.cd})`);

  const standing = await t(() => {
    saveHvStory({ tellings: 3 });
    saveHvSong({ plays: 0 });
    balladPlayed = false;
    G.food = 10;
    G.cooldowns = {};
    finishAction(ACTIONS.find(x => x.id === 'ballad'));
    return {
      set: balladSet(),
      food: G.food,
      plays: loadHvSong().plays,
      played: balladPlayed,
      cd: G.cooldowns.ballad || 0,
    };
  });
  ok(standing.set && standing.food > 10 && standing.plays === 1 && standing.played && standing.cd > Date.now(),
    `three tellings still fill the hat and still take the lock (food ${standing.food}, plays ${standing.plays})`);

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
