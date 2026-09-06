/*
 * HV-142 — Keys in Hand said someone moves into your tent, then the
 * camp stayed the same size.
 *
 * The ending card says: "Someone else moves into your tent tonight."
 * checkArc() crossed 2 → 3, saved, and showed the overlay. Population
 * did not move. No figure sat down. The camp you Keep Building is the
 * same size as the camp that just got keys.
 *
 * Distinct from HV-61 (hvarc — the overlay comes back after a reload)
 * and HV-21 (hvnewcomer — Make room seats a stranger you paid for).
 *
 *  A. Source: the card still says someone moves into your tent;
 *     the 2→3 branch increments population once.
 *  B. A live graduation at 4 residents becomes 5. Peak follows.
 *     A community figure sits down. The log names the tent.
 *  C. Showing the card again at stage 3 does not seat a second person.
 *  D. ui.js is not this ticket (the sentence stays; the camp grows).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives checkArc() on the production 2→3 path.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const grad = /arcStage\s*===\s*2[\s\S]*?showGraduation\s*\(\s*\)/.exec(loop);
ok(!!grad, 'checkArc still graduates stage 2 to Keys in Hand');
ok(/moves into your tent/.test(ui),
  'Keys in Hand still says someone moves into your tent');
ok(grad && /G\.population\s*\+=\s*1/.test(grad[0]),
  'HV-142: the 2→3 branch increments population once');
ok(!/G\.population\s*\+=/.test(ui) && !/keysTenant/.test(ui),
  'ui.js is not this ticket — the sentence stays, the camp grows in checkArc');

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
    if (!sessionStorage.getItem('hvmovein-init')) {
      sessionStorage.setItem('hvmovein-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const live = await t(() => {
    G.arcStage = 2;
    G.arcDone = false;
    G.goodwill = 30;
    G.morale = 70;
    G.days = 18;
    G.health = 80;
    G.population = 4;
    G.peakPopulation = 4;
    G.goalIndex = GOALS.length;
    const beforeFigs = figures.filter(f => f.userData && f.userData.type === 'community').length;
    checkArc();
    const logs = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    return {
      stage: G.arcStage,
      pop: G.population,
      peak: G.peakPopulation,
      figs: figures.filter(f => f.userData && f.userData.type === 'community').length,
      beforeFigs,
      modal: !!document.getElementById('hv-graduation'),
      tent: logs.some(m => /moves into your tent/.test(m)),
    };
  });
  ok(live.stage === 3 && live.modal,
    `Keys in Hand still opens (${live.stage}, modal=${live.modal})`);
  ok(live.pop === 5 && live.peak === 5,
    `a camp of 4 becomes 5 when the keys land (pop ${live.pop}, peak ${live.peak})`);
  ok(live.figs === live.beforeFigs + 1,
    `someone sits down in camp (community figures ${live.beforeFigs} → ${live.figs})`);
  ok(live.tent, 'the log names the tent');

  const again = await t(() => {
    const pop = G.population;
    const figs = figures.filter(f => f.userData && f.userData.type === 'community').length;
    checkArc();
    return {
      pop: G.population,
      figs: figures.filter(f => f.userData && f.userData.type === 'community').length,
      was: pop,
      figsWas: figs,
    };
  });
  ok(again.pop === again.was && again.figs === again.figsWas,
    `showing the card again does not seat a second person (pop ${again.pop})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
