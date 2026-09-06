/*
 * HV-145 — the Community Garden said it gets destroyed in sweeps,
 * then the compost bin kept the beds.
 *
 * The garden's card says "Gets destroyed in sweeps." The compost
 * bin lives in those beds — black gold, one bed through frost.
 * A sweep already tears up the plot. The bin stayed standing, so
 * the next garden grew on free compost.
 *
 *  A. Source: the sweep's garden branch also clears the compost.
 *     The garden recipe still says it gets destroyed in sweeps.
 *  B. Garden + compost: a sweep takes both. The stash hole stays.
 *  C. Compost with no garden survives — there are no beds to take.
 *  D. Frost without a bin still yields nothing (hvcompost C).
 *  E. A workbench is still a coin-flip, not this write.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives EVENTS_BAD.sweep.effect on the production path.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const sweep = /id:'sweep'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(loop);
const gardenBit = sweep && /if\(G\.structures\.garden\)\{([\s\S]*?)\}/.exec(sweep[1]);
ok(!!sweep && !!gardenBit, 'the sweep still tramples the garden');
ok(gardenBit && /G\.structures\.compost\s*=\s*false/.test(gardenBit[1]),
  'HV-145: the sweep’s garden branch also clears the compost bin');
ok(/Gets destroyed in sweeps/.test(cfg) && /keeps one bed alive through frost/.test(cfg),
  'the garden still dies in sweeps, and the compost still lives in the beds');

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
    if (!sessionStorage.getItem('hvtrample-init')) {
      sessionStorage.setItem('hvtrample-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const both = await page.evaluate(() => {
    G.structures.garden = true;
    G.structures.compost = true;
    G.structures.stash = true;
    G.structures.tent = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.structures.toolbox = false;
    G.packedUp = false;
    G.garageCover = false;
    G.scraps = 20; G.food = 20; G.morale = 50;
    const ev = EVENTS_BAD.find(e => e.id === 'sweep');
    ev.effect();
    const feed = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      garden: G.structures.garden,
      compost: G.structures.compost,
      stash: G.structures.stash,
      trampled: /trampled/.test(feed),
      binLog: /compost/i.test(feed),
    };
  });
  ok(!both.garden && both.trampled,
    `the sweep still tears up the garden (garden=${both.garden})`);
  ok(!both.compost && both.binLog,
    `HV-145: the compost bin goes over with the beds (compost=${both.compost})`);
  ok(both.stash, 'the stash hole is still never found');

  const lone = await page.evaluate(() => {
    G.structures.garden = false;
    G.structures.compost = true;
    G.structures.stash = false;
    G.structures.tent = false;
    G.structures.soup_kitchen = false;
    G.structures.workbench = false;
    G.packedUp = false;
    G.garageCover = false;
    const ev = EVENTS_BAD.find(e => e.id === 'sweep');
    ev.effect();
    return { compost: G.structures.compost, garden: G.structures.garden };
  });
  ok(lone.compost && !lone.garden,
    'compost with no garden survives — there are no beds to take');

  const frost = await page.evaluate(() => {
    SNAP_CHANCE = 0; G.snapUntil = null;
    G.structures.garden = true;
    G.structures.compost = false;
    G.structures.barrel = false;
    G.workers.scrapper = false;
    G.workers.cook = false;
    G.forecast = 'cold';
    G.weather = 'clear';
    G.season = 2;
    G.days = 20;
    G.food = 10;
    G.population = 1;
    G.lastEventDay = G.days + 5;
    const before = G.food;
    onNewDay();
    return { weather: G.weather, delta: G.food - before };
  });
  ok(frost.weather === 'cold' && frost.delta <= 0,
    `frost without a bin still yields nothing (Δfood ${frost.delta})`);

  const bench = await page.evaluate(() => {
    G.structures.garden = false;
    G.structures.compost = false;
    G.structures.workbench = true;
    G.structures.toolbox = false;
    G.structures.tent = false;
    G.structures.soup_kitchen = false;
    G.packedUp = false;
    G.garageCover = false;
    const real = Math.random;
    Math.random = () => 0.6; // 0.6 > 0.5 — workbench stays
    const ev = EVENTS_BAD.find(e => e.id === 'sweep');
    ev.effect();
    Math.random = real;
    return { bench: G.structures.workbench };
  });
  ok(bench.bench, 'a workbench is still a coin-flip — this write does not smash it');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
