/*
 * HV-138 — Builder said speeds up crafting x2, then a blanket already
 * on the bench still took four seconds.
 *
 * The hire card says "Speeds up crafting x2". doCraft applies
 * r.time * 0.5 only at start. hireWorker stamps the worker and never
 * touches G.activeCrafts, so a craft already ticking keeps its full
 * duration and the original setTimeout still fires at four seconds.
 *
 *  A. Source: hireWorker reschedules in-flight crafts when the Builder joins.
 *  B. The hire card still says Speeds up crafting x2.
 *  C. A Blanket started without a Builder is 4000ms.
 *  D. Hiring the Builder mid-craft halves the remaining duration.
 *  E. A Blanket started after the hire is still 2000ms.
 *  F. The Cook still spends 3 food for +2 goodwill.
 *  Z. Zero page errors. ui.js untouched.
 *
 * Hook-free. Drives doCraft + hireWorker on the production path.
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
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const hire = /function hireWorker\(id\)\{([\s\S]*?)\n\}/.exec(player);
ok(!!hire, 'hireWorker is still in player.js');
ok(hire && /activeCrafts/.test(hire[1]) && /builder/.test(hire[1]),
  'HV-138: hireWorker reschedules G.activeCrafts when the Builder joins');
ok(/id:'builder'[\s\S]{0,80}?Speeds up crafting x2/.test(cfg),
  'the hire card still says Speeds up crafting x2');
ok(/BUILDER_CRAFT\s*=\s*0\.5/.test(cfg),
  'BUILDER_CRAFT is the x2 cut (0.5)');
ok(/workers\.builder/.test(player) && /0\.5/.test(player),
  'doCraft still applies the Builder at start');
ok(!/BUILDER_CRAFT/.test(ui),
  'ui.js is untouched');
ok(/workers\.cook&&G\.food>=3/.test(loop) && /goodwill\+=2/.test(loop),
  'the Cook still spends 3 food for +2 goodwill');

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
    if (!sessionStorage.getItem('hvbuilder-init')) {
      sessionStorage.setItem('hvbuilder-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const mid = await t(() => {
    const blanket = RECIPES.find(r => r.id === 'blanket');
    G.goalIndex = GOALS.length;
    G.workers.builder = false;
    G.scraps = 20; G.cardboard = 20; G.goodwill = 20;
    G.population = 1;
    G.activeCrafts = {};
    doCraft(blanket);
    const started = G.activeCrafts.blanket;
    const before = started ? started.duration : null;
    hireWorker('builder');
    const afterJob = G.activeCrafts.blanket;
    return {
      desc: WORKER_DEFS.find(w => w.id === 'builder').desc,
      hired: !!G.workers.builder,
      before,
      after: afterJob ? afterJob.duration : null,
      remaining: afterJob ? (afterJob.start + afterJob.duration) - Date.now() : null,
      recipeTime: blanket.time,
    };
  });
  ok(mid.desc === 'Speeds up crafting x2',
    `the hire card still says Speeds up crafting x2 (${mid.desc})`);
  ok(mid.hired, 'hireWorker still stamps the Builder');
  ok(mid.before === 4000,
    `a Blanket started without a Builder is 4000ms (${mid.before})`);
  ok(mid.after !== null && mid.after > 1500 && mid.after <= 2100,
    `HV-138: hiring the Builder mid-craft halves the remaining duration (${mid.before} → ${mid.after})`);

  const afterHire = await t(() => {
    const blanket = RECIPES.find(r => r.id === 'blanket');
    G.workers.builder = true;
    G.scraps = 20; G.cardboard = 20;
    delete G.activeCrafts.blanket;
    doCraft(blanket);
    const job = G.activeCrafts.blanket;
    return { duration: job ? job.duration : null, time: blanket.time };
  });
  ok(afterHire.duration === 2000,
    `a Blanket started after the hire is still 2000ms (${afterHire.duration})`);

  const wood = await t(() => {
    const recipe = RECIPES.find(r => r.id === 'fire_ration');
    G.workers.builder = false;
    G.wood = 10;
    delete G.activeCrafts.fire_ration;
    doCraft(recipe);
    const job = G.activeCrafts.fire_ration;
    return { duration: job ? job.duration : null, time: recipe.time };
  });
  ok(wood.duration === 2000,
    `Firewood without a Builder is still 2000ms (${wood.duration})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
