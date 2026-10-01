/*
 * HV-220 — Roof the Dry Corner ran a 6s job when the camp came up
 * short of sheeting.
 *
 * The button reads Roof the Dry Corner (12🧱 + 8📦). Three names
 * put it on the board. finishAction already refused a short purse
 * ("Not enough to roof it"). doAction still started the 6s job and
 * chimed as if the sheeting had gone up.
 *
 * Walk, Leaf the Notebook, and Reunion are not this card. Sitting
 * in the dry corner is not this card.
 *
 *  A. Source: doAction refuses a short roof before setTimeout.
 *  B. The button still names 12 scraps and 8 cardboard.
 *  C. A short purse does not start a job or debit the pile.
 *  D. 6.5s later the pile is still intact.
 *  E. A funded roof still sheets the corner (finishAction).
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
const dryAt = doBlock.indexOf("a.id==='dry'");

ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(dryAt >= 0 && dryAt < timeoutAt && /HVDRY_SCRAPS/.test(doBlock) && /HVDRY_CARD/.test(doBlock),
  'HV-220: doAction refuses Roof the Dry Corner before the timer when the pile is short');
ok(/HVDRY_SCRAPS\s*=\s*12/.test(config) && /HVDRY_CARD\s*=\s*8/.test(config),
  'the button still names 12 scraps and 8 cardboard');
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
    if (!sessionStorage.getItem('hvroof-init')) {
      sessionStorage.setItem('hvroof-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-mark');
      localStorage.removeItem('hv-drycorner');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const short = await t(() => {
    saveHvMark({ names: 3 });
    saveHvDry({ built: false, sits: 0 });
    drySat = false;
    G.scraps = 4; G.cardboard = 3; G.food = 10;
    G.cooldowns = {};
    buildActionUI();
    doAction(dryAction());
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      offered: dryOffered(),
      built: dryBuilt(),
      job: !!activeJobs.dry,
      scraps: G.scraps,
      card: G.cardboard,
      log,
      btnOn: !!(document.getElementById('action-dry')
        && document.getElementById('action-dry').classList.contains('active-job')),
    };
  });
  ok(short.offered && !short.built, 'three names offer the roof and it is still open to the sky');
  ok(!short.job && !short.btnOn,
    'a short purse does not start a job — the button is not active-job');
  ok(short.scraps === 4 && short.card === 3,
    `a short purse does not debit the pile (scraps ${short.scraps}, cardboard ${short.card})`);
  ok(/Not enough to roof it/.test(short.log),
    'the refuse is the same line finishAction already used');

  await page.waitForTimeout(6500);
  const afterWait = await t(() => ({
    scraps: G.scraps,
    card: G.cardboard,
    job: !!activeJobs.dry,
    built: dryBuilt(),
  }));
  ok(afterWait.scraps === 4 && afterWait.card === 3 && !afterWait.job && !afterWait.built,
    `6.5s later the pile is still intact and the corner is still open (scraps ${afterWait.scraps})`);

  const funded = await t(() => {
    saveHvMark({ names: 3 });
    saveHvDry({ built: false, sits: 0 });
    drySat = false;
    G.scraps = 12; G.cardboard = 8;
    G.cooldowns = {};
    finishAction(dryAction());
    return {
      built: dryBuilt(),
      scraps: G.scraps,
      card: G.cardboard,
    };
  });
  ok(funded.built && funded.scraps === 0 && funded.card === 0,
    `a funded roof still sheets the corner (built ${funded.built}, scraps ${funded.scraps})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
