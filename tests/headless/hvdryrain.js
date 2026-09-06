/*
 * HV-174 — Sit in the Dry Corner said people come in out of the
 * rain, then a clear day still paid.
 *
 * Once the corner is roofed, the button becomes the sitting.
 * The tooltip says people come in out of the rain to read, and
 * nobody comes in empty-handed. finishAction logs the same rain
 * line. Clicking the sit on a Clear / Heat / Cold morning still
 * started the 2s job and paid the dish as if the street were wet.
 *
 * Distinct from HV-53 (the roof itself) and #789 (the roof stops
 * the rain editing the story). This ticket is the sitting vs the
 * sky. ui.js is not this ticket. finishAction still pays so hvdry
 * stays green.
 *
 *  A. Source: the sit tooltip still names the rain; doAction names
 *     the dry sit + rain gate before setTimeout.
 *  B. Roofed, Clear sky: no job, no sit stamp, food unchanged,
 *     the refuse names the rain.
 *  C. Roofing still works on a clear day.
 *  D. Rain: the sit still starts, and finishAction still pays the dish.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives doAction + finishAction on the production path.
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
const timeoutAt = doBlock.indexOf('setTimeout');
const dryAt = doBlock.search(/a\.id==='dry'/);
const rainAt = doBlock.search(/weather\s*!==\s*'rain'|weather\s*===\s*'rain'/);

ok(/people come in out of the rain/.test(cfg),
  'Sit in the Dry Corner still promises people come in out of the rain');
ok(doAt >= 0 && timeoutAt > 0, 'doAction still starts the job with setTimeout');
ok(dryAt >= 0 && rainAt >= 0 && dryAt < timeoutAt && rainAt < timeoutAt,
  'HV-174: doAction refuses a dry-street sitting before the timer');
ok(/homeless-village\/js\/ui\.js/.test(player) === false,
  'the rain gate lives in doAction — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvdryrain-init')) {
      sessionStorage.setItem('hvdryrain-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-mark');
      localStorage.removeItem('hv-drycorner');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    saveHvMark({ names: 3 });
    saveHvDry({ built: true, sits: 0 });
    drySat = false;
    G.weather = 'clear';
    G.food = 10;
    G.goalIndex = GOALS.length;
    buildActionUI();
    const tip = dryAction().tooltip;
    const b = document.getElementById('action-dry');
    return {
      tip: tip,
      built: dryBuilt(),
      label: b ? b.textContent.trim() : '',
      dish: dryDish(),
    };
  });
  ok(/out of the rain/.test(boot.tip),
    `the sit tooltip still names the rain (${boot.tip.slice(0, 60)})`);
  ok(boot.built && /Sit in the Dry Corner/.test(boot.label),
    `roofed, the button is the sitting (${boot.label})`);

  const clear = await page.evaluate(() => {
    saveHvDry({ built: true, sits: 0 });
    drySat = false;
    G.weather = 'clear';
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.dry) delete activeJobs.dry;
    const before = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    doAction(dryAction());
    const after = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const added = after.filter((line, i) => line !== before[i]).join('\n');
    return {
      job: !!activeJobs.dry,
      sat: drySat,
      sits: loadHvDry().sits,
      food: G.food,
      added: added,
    };
  });
  ok(!clear.job && !clear.sat && clear.sits === 0 && clear.food === 10,
    `HV-174: a clear sitting does not start a job or pay (job ${clear.job}, food ${clear.food})`);
  ok(/rain/i.test(clear.added),
    `the refuse names the rain — not a silent no-op (${clear.added.slice(-80)})`);

  const roof = await page.evaluate(() => {
    saveHvDry({ built: false, sits: 0 });
    drySat = false;
    G.weather = 'clear';
    G.scraps = 30;
    G.cardboard = 20;
    G.cooldowns = {};
    if (activeJobs.dry) delete activeJobs.dry;
    doAction(dryAction());
    const started = !!activeJobs.dry;
    if (activeJobs.dry) delete activeJobs.dry;
    finishAction(dryAction());
    return { started: started, built: dryBuilt(), scraps: G.scraps, card: G.cardboard };
  });
  ok(roof.started && roof.built && roof.scraps === 18 && roof.card === 12,
    `roofing still works on a clear day (built ${roof.built}, ${roof.scraps} scraps)`);

  const rain = await page.evaluate(() => {
    saveHvDry({ built: true, sits: 0 });
    drySat = false;
    G.weather = 'rain';
    G.food = 10;
    G.cooldowns = {};
    if (activeJobs.dry) delete activeJobs.dry;
    doAction(dryAction());
    const started = !!activeJobs.dry;
    if (activeJobs.dry) delete activeJobs.dry;
    finishAction(dryAction());
    return {
      started: started,
      food: G.food,
      sits: loadHvDry().sits,
      sat: drySat,
    };
  });
  ok(rain.started, 'a rainy sitting still starts the job');
  ok(rain.food === 10 + boot.dish && rain.sits === 1 && rain.sat,
    `a rainy sitting still pays the dish (10 → ${rain.food}, sits ${rain.sits})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
