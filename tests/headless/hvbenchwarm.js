/*
 * HV-113 — Sit on the Bench said something warm, then only paid food.
 *
 * Tooltip and success log both say somebody sits down with something
 * warm. finishAction only added the food dish. Warmth did not move.
 *
 * Distinct from HV-104 (#781): that is the mark fire / morale.
 * Distinct from HV-46 (hvbench): that suite only pins the food dish.
 * Distinct from HV-112 (#794): that is the fifth panel's today latch.
 *
 *  A. Source: the bench branch lifts warmth (HVBEN_WARMTH / G.warmth).
 *  B. The tooltip still promises something warm. ui.js is untouched.
 *  C. A sit pays food AND warmth; the log names the warmth.
 *  D. A second sit the same session does not pay again.
 *  E. Leafing the notebook is still food only — a page is not warm.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction({id:'bench'}) on the production path.
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
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const bench = /else if\(a\.id==='bench'\)\{([\s\S]*?)else if\(a\.id==='story'\)/.exec(player);
ok(!!bench, 'the bench branch is still in player.js');
ok(bench && /warmth/.test(bench[1]) && /HVBEN_WARMTH|G\.warmth/.test(bench[1]),
  'HV-113: a sit lifts warmth — somebody sat down with something warm');
ok(/id:'bench'[\s\S]{0,400}?something warm/.test(cfg),
  'the tooltip still promises something warm');
ok(!/HVBEN_WARMTH/.test(ui), 'ui.js is untouched');

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
    if (!sessionStorage.getItem('hvbenchwarm-init')) {
      sessionStorage.setItem('hvbenchwarm-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-guestbook');
      localStorage.removeItem('hv-bench');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const seam = await t(() => {
    saveHvGb({ leafs: 3 });
    saveHvBench({ sits: 0 });
    benchSat = false;
    notebookLeafed = false;
    G.goalIndex = GOALS.length;
    G.food = 10;
    G.warmth = 50;
    const dish = hvBenchDish();
    const lift = typeof HVBEN_WARMTH === 'number' ? HVBEN_WARMTH : 3;
    finishAction({ id: 'bench' });
    const logs = Array.from(document.querySelectorAll('#log-feed .log-line')).map(el => el.textContent);
    return {
      tip: ACTIONS.find(a => a.id === 'bench').tooltip,
      food: G.food,
      dish,
      warmth: G.warmth,
      lift,
      sits: loadHvBench().sits,
      log: logs[logs.length - 1] || '',
    };
  });
  ok(/something warm/.test(seam.tip), 'the live tooltip still says something warm');
  ok(seam.food === 10 + seam.dish && seam.sits === 1,
    `the sit still pays the food dish (food ${seam.food}, sits ${seam.sits})`);
  ok(seam.warmth === 50 + seam.lift,
    `HV-113: a sit lifts warmth by ${seam.lift} (50 → ${seam.warmth})`);
  ok(new RegExp('\\+' + seam.lift).test(seam.log) && /warm/.test(seam.log),
    `the log names the warmth (${seam.log.slice(-90)})`);

  const again = await t(() => {
    const food = G.food, warmth = G.warmth, sits = loadHvBench().sits;
    finishAction({ id: 'bench' });
    return { food: G.food, warmth: G.warmth, sits: loadHvBench().sits, before: { food, warmth, sits } };
  });
  ok(again.food === again.before.food && again.warmth === again.before.warmth && again.sits === again.before.sits,
    'a second sit the same session does not pay again');

  const leaf = await t(() => {
    saveHvAnniv({ toasts: 3 });
    saveHvGb({ leafs: 0 });
    notebookLeafed = false;
    G.food = 10;
    G.warmth = 50;
    finishAction({ id: 'guestbook' });
    return { food: G.food, warmth: G.warmth, leafs: loadHvGb().leafs };
  });
  ok(leaf.food > 10 && leaf.warmth === 50 && leaf.leafs === 1,
    `leafing the notebook is still food only (food ${leaf.food}, warmth ${leaf.warmth})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
