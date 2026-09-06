/*
 * HV-218 — Throw the Reunion ran a job when the whole story
 * wasn't standing.
 *
 * The tooltip: "When the whole story stands — the chalk star's
 * holds and Marisol's visits — the camp throws the bridge reunion
 * once a session." finishAction already knew how to refuse a half
 * story. doAction still started the 2s job, played the success
 * blip, and locked the button 30s as if the pot had filled.
 *
 * Snapshot, Anniversary, the thermos, and the coffee can are not
 * this card. Rain on the reunion is not this card.
 *
 *  A. Source: doAction refuses reunion before setTimeout.
 *  B. The card still asks for the whole story.
 *  C. A half story does not start a job or take the 30s lock.
 *  D. 2.5s later the lock still has not landed.
 *  E. A standing story still fills the pot (finishAction).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives doAction / finishAction on the production row.
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
const reunionAt = doBlock.indexOf("a.id==='reunion'");

ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(reunionAt >= 0 && reunionAt < timeoutAt && /!hvReunionStands\(\)/.test(doBlock),
  'HV-218: doAction refuses Throw the Reunion before the timer when the story is not standing');
ok(/When the whole story stands/.test(config),
  'the card still asks for the whole story');
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
    if (!sessionStorage.getItem('hvthrow-init')) {
      sessionStorage.setItem('hvthrow-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-plaque');
      localStorage.removeItem('hv-visitor');
      localStorage.removeItem('hv-reunion');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const half = await t(() => {
    saveHvStar({ cheers: 3 });
    saveMarisol({ visits: 2 });
    saveHvReunion({ held: 0 });
    bridgeReunionHeld = false;
    G.food = 10;
    G.cooldowns = {};
    const a = ACTIONS.find(x => x.id === 'reunion');
    doAction(a);
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      stands: hvReunionStands(),
      job: !!activeJobs.reunion,
      cd: G.cooldowns.reunion || 0,
      food: G.food,
      held: loadHvReunion().held,
      log,
      btnOn: !!(document.getElementById('action-reunion')
        && document.getElementById('action-reunion').classList.contains('active-job')),
    };
  });
  ok(!half.stands, 'holds without visits is still a half story');
  ok(!half.job && !half.btnOn,
    'a half story does not start a job — the button is not active-job');
  ok(half.cd === 0 && half.food === 10 && half.held === 0,
    `a half story takes no cooldown and does not fill the pot (cd ${half.cd}, food ${half.food})`);
  ok(/needs the whole story/.test(half.log),
    'the refuse is the same line finishAction already used');

  await page.waitForTimeout(2500);
  const afterWait = await t(() => ({
    cd: G.cooldowns.reunion || 0,
    food: G.food,
    job: !!activeJobs.reunion,
    held: loadHvReunion().held,
  }));
  ok(afterWait.cd === 0 && afterWait.food === 10 && !afterWait.job && afterWait.held === 0,
    `2.5s later the 30s lock still has not landed (cd ${afterWait.cd})`);

  const standing = await t(() => {
    saveHvStar({ cheers: 3 });
    saveMarisol({ visits: 3 });
    saveHvReunion({ held: 0 });
    bridgeReunionHeld = false;
    G.food = 10;
    G.cooldowns = {};
    finishAction(ACTIONS.find(x => x.id === 'reunion'));
    return {
      stands: hvReunionStands(),
      food: G.food,
      held: loadHvReunion().held,
      cd: G.cooldowns.reunion || 0,
    };
  });
  ok(standing.stands && standing.food > 10 && standing.held === 1 && standing.cd > Date.now(),
    `a standing story still fills the pot and still takes the lock (food ${standing.food}, held ${standing.held})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
