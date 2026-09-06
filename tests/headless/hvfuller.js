/*
 * HV-104 — Add a Name to the Wall said the fire is fuller, then
 * only paid food.
 *
 * Tooltip and success log both say the fire is fuller that night.
 * Elsewhere ("The fire feels it") that means morale. finishAction
 * only added the food dish. Morale did not move.
 *
 *  A. Source: the mark branch lifts morale (HVMARK_MORALE / G.morale).
 *  B. The tooltip still promises a fuller fire.
 *  C. A name pays food AND morale; the log names the morale.
 *  D. A second mark the same session does not pay again.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction({id:'mark'}) on the production path.
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
const mark = /else if\(a\.id==='mark'\)\{([\s\S]*?)else if\(a\.id==='dry'\)/.exec(player);
ok(!!mark, 'the mark branch is still in player.js');
ok(mark && /morale/.test(mark[1]) && /HVMARK_MORALE|G\.morale/.test(mark[1]),
  'HV-104: adding a name lifts morale — the fire is fuller');
ok(/id:'mark'[\s\S]{0,500}?fire is fuller that night/.test(cfg),
  'the tooltip still promises a fuller fire');

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
    if (!sessionStorage.getItem('hvfuller-init')) {
      sessionStorage.setItem('hvfuller-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-docent');
      localStorage.removeItem('hv-mark');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const seam = await t(() => {
    saveHvWalk({ walks: 3 });
    saveHvMark({ names: 0 });
    markAdded = false;
    G.goalIndex = GOALS.length;
    G.food = 10;
    G.morale = 50;
    const dish = markDish();
    const lift = typeof HVMARK_MORALE === 'number' ? HVMARK_MORALE : 3;
    finishAction({ id: 'mark' });
    const logs = Array.from(document.querySelectorAll('#log-feed .log-line')).map(el => el.textContent);
    return {
      tip: ACTIONS.find(a => a.id === 'mark').tooltip,
      food: G.food,
      dish,
      morale: G.morale,
      lift,
      names: loadHvMark().names,
      log: logs[logs.length - 1] || '',
    };
  });
  ok(/fire is fuller that night/.test(seam.tip), 'the live tooltip still says the fire is fuller');
  ok(seam.food === 10 + seam.dish && seam.names === 1,
    `the dish still pays (food ${seam.food}, names ${seam.names})`);
  ok(seam.morale === 50 + seam.lift,
    `HV-104: the fire is fuller — morale ${seam.morale} (expected ${50 + seam.lift})`);
  ok(/morale|😊/.test(seam.log),
    `the log names the morale lift (${seam.log.slice(0, 80)})`);

  const once = await t(() => {
    const food0 = G.food, morale0 = G.morale, names0 = loadHvMark().names;
    finishAction({ id: 'mark' });
    return { food: G.food, morale: G.morale, names: loadHvMark().names, food0, morale0, names0 };
  });
  ok(once.food === once.food0 && once.morale === once.morale0 && once.names === once.names0,
    'the same session adds one name');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
