/*
 * HV-106 — Walk a Newcomer Down said tomorrow, then dawn never
 * rearmed the walk.
 *
 * The refusal log says "the next newcomer gets theirs tomorrow."
 * walkGiven is a session latch. Nothing in onNewDay clears it.
 * Play through midnight in the same tab and tomorrow never comes.
 * A reload rearms it (the tooltip's "once a session"); a new dawn
 * in the same session does not (the log's "tomorrow").
 *
 * Distinct from HV-97 (#766): that seats a waiting stranger. This
 * is the dawn rearm. Distinct from HV-104 (#781): that is the mark
 * fire. Distinct from HV-93 (#761): that is the thermos.
 *
 *  A. Source: onNewDay assigns walkGiven = false.
 *  B. The refusal still promises tomorrow. ui.js is untouched.
 *  C. A walk pays; the same dawn refuses; onNewDay rearms; the
 *     next walk pays. A name on the wall stays latched — only
 *     the walk promised tomorrow.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction({id:'walk'}) and onNewDay().
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const dawnAt = loop.indexOf('function onNewDay(){');
const dawn = dawnAt >= 0 ? loop.slice(dawnAt, dawnAt + 2200) : '';
ok(dawnAt >= 0, 'onNewDay is still in gameloop.js');
ok(/walkGiven\s*=\s*false/.test(dawn),
  'HV-106: dawn rearms the walk — walkGiven = false in onNewDay');
ok(/next newcomer gets theirs tomorrow/.test(player),
  'the refusal still promises the next newcomer tomorrow');
ok(!/walkGiven/.test(ui), 'ui.js is untouched — no walkGiven');

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
    if (!sessionStorage.getItem('hvwalkdawn-init')) {
      sessionStorage.setItem('hvwalkdawn-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-mural');
      localStorage.removeItem('hv-docent');
      localStorage.removeItem('hv-mark');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const seam = await t(() => {
    saveHvPanel({ stands: 3 });
    saveHvWalk({ walks: 0 });
    saveHvMark({ names: 0 });
    walkGiven = false;
    markAdded = true;
    G.goalIndex = GOALS.length;
    G.food = 40;
    G.population = 1;
    G.dog = 0;
    G.workers.scrapper = false;
    G.workers.cook = false;
    G.structures.garden = false;
    G.structures.compost = false;
    G.structures.pantry = false;
    G.lastEventDay = G.days + 9;
    G.forecast = 'clear';
    const dish = walkDish();
    finishAction({ id: 'walk' });
    const afterPay = { food: G.food, walks: loadHvWalk().walks, given: walkGiven };
    finishAction({ id: 'walk' });
    const afterRefuse = { food: G.food, walks: loadHvWalk().walks, given: walkGiven };
    const logsRefuse = Array.from(document.querySelectorAll('#log-feed .log-line'))
      .map(el => el.textContent);
    const refuseLine = logsRefuse[logsRefuse.length - 1] || '';
    const real = Math.random;
    Math.random = () => 0.5;
    onNewDay();
    Math.random = real;
    const afterDawn = { given: walkGiven, marked: markAdded, walks: loadHvWalk().walks };
    finishAction({ id: 'walk' });
    return {
      dish,
      afterPay,
      afterRefuse,
      refuseLine,
      afterDawn,
      afterNext: { food: G.food, walks: loadHvWalk().walks, given: walkGiven },
    };
  });

  ok(seam.afterPay.walks === 1 && seam.afterPay.given === true
    && seam.afterPay.food === 40 + seam.dish,
    `the first walk pays and latches (walks ${seam.afterPay.walks}, food ${seam.afterPay.food})`);
  ok(seam.afterRefuse.walks === 1 && seam.afterRefuse.food === 40 + seam.dish,
    `the same dawn walks once (walks ${seam.afterRefuse.walks})`);
  ok(/tomorrow/.test(seam.refuseLine),
    `the refusal still names tomorrow (${seam.refuseLine.slice(-90)})`);
  ok(seam.afterDawn.given === false,
    'HV-106: after dawn walkGiven is false — tomorrow arrived');
  ok(seam.afterDawn.marked === true,
    'a name on the wall stays latched — only the walk promised tomorrow');
  ok(seam.afterNext.walks === 2 && seam.afterNext.given === true,
    `the next dawn's walk pays (walks ${seam.afterNext.walks})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
