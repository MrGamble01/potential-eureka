/*
 * HV-112 — Stand at the Fifth Panel said today, then dawn never
 * dried the paint.
 *
 * The refusal log says "The panel got its stand today — the paint
 * is still going on." panelStood is a session latch. Nothing in
 * onNewDay clears it. Play through midnight in the same tab and
 * the paint never dries; a reload is the only rearm (the tooltip's
 * "once a session"). The log's "today" never ended.
 *
 * Distinct from HV-106 (#786): that rearms the walk. Distinct from
 * HV-93 (#761): that is the thermos. Distinct from HV-50 (hvpanel):
 * that suite rearms by hand.
 *
 *  A. Source: onNewDay assigns panelStood = false.
 *  B. The refusal still names today. ui.js is untouched.
 *  C. A stand pays; the same dawn refuses; onNewDay rearms; the
 *     next stand pays. The walk stays latched — only the panel
 *     promised today.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction({id:'fifth'}) and onNewDay().
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
ok(/panelStood\s*=\s*false/.test(dawn),
  'HV-112: dawn dries the paint — panelStood = false in onNewDay');
ok(/got its stand today/.test(player),
  'the refusal still names today');
ok(!/panelStood/.test(ui), 'ui.js is untouched — no panelStood');

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
    if (!sessionStorage.getItem('hvpaneldawn-init')) {
      sessionStorage.setItem('hvpaneldawn-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-capsule');
      localStorage.removeItem('hv-mural');
      localStorage.removeItem('hv-docent');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const seam = await t(() => {
    saveHvCan({ digs: 3 });
    saveHvPanel({ stands: 0 });
    saveHvWalk({ walks: 0 });
    panelStood = false;
    walkGiven = true;
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
    const dish = panelDish();
    finishAction({ id: 'fifth' });
    const afterPay = { food: G.food, stands: loadHvPanel().stands, stood: panelStood };
    finishAction({ id: 'fifth' });
    const afterRefuse = { food: G.food, stands: loadHvPanel().stands, stood: panelStood };
    const logsRefuse = Array.from(document.querySelectorAll('#log-feed .log-line'))
      .map(el => el.textContent);
    const refuseLine = logsRefuse[logsRefuse.length - 1] || '';
    const real = Math.random;
    Math.random = () => 0.5;
    onNewDay();
    Math.random = real;
    const afterDawn = { stood: panelStood, walked: walkGiven, stands: loadHvPanel().stands };
    finishAction({ id: 'fifth' });
    return {
      dish,
      afterPay,
      afterRefuse,
      refuseLine,
      afterDawn,
      afterNext: { food: G.food, stands: loadHvPanel().stands, stood: panelStood },
    };
  });

  ok(seam.afterPay.stands === 1 && seam.afterPay.stood === true
    && seam.afterPay.food === 40 + seam.dish,
    `the first stand pays and latches (stands ${seam.afterPay.stands}, food ${seam.afterPay.food})`);
  ok(seam.afterRefuse.stands === 1 && seam.afterRefuse.food === 40 + seam.dish,
    `the same dawn stands once (stands ${seam.afterRefuse.stands})`);
  ok(/today/.test(seam.refuseLine),
    `the refusal still names today (${seam.refuseLine.slice(-90)})`);
  ok(seam.afterDawn.stood === false,
    'HV-112: after dawn panelStood is false — the paint dried');
  ok(seam.afterDawn.walked === true,
    'the walk stays latched — only the panel promised today');
  ok(seam.afterNext.stands === 2 && seam.afterNext.stood === true,
    `the next dawn's stand pays (stands ${seam.afterNext.stands})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
