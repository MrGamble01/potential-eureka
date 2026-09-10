/* HV-193 — the Community Garden said each day, then a named
 * cold snap still harvested under a clear sky.
 *
 * The garden recipe is "Slowly generates food each day."
 * The Cold Snap card is "Temperature drops hard tonight."
 * Dawn already says "A cold snap grips the block — two brutal
 * days." Weather frost (`G.weather==='cold'`) already zeros the
 * beds. A named snap (`snapActive()`) can grip on a clear winter
 * dawn independently of today's sky, and those beds still paid
 * rand(1,3).
 *
 * #791 / hvweather is weather frost. #858 is winter season.
 * #855 is a scorcher harvest. #849 is the garden-helper job.
 * #832 / #823 / #837 are snap vs pot, busk, and sky. This is
 * the snap status vs the garden harvest.
 *
 *  A. Source: the garden still generates food each day. The
 *     snap card still drops the temperature hard tonight.
 *     Dawn still grips the block for two brutal days.
 *  B. Source: the garden harvest reads snapActive(). ui.js
 *     does not.
 *  C. Live: clear sky + named snap, no compost — the camp
 *     drain lands and the beds do not. The log names the snap.
 *  D. The same dawn without a snap still yields.
 *  E. Weather frost without a snap still uses the frost line.
 *  F. Compost still keeps one bed through a clear snap.
 *  G. Cold weather + snap does not double-zero or steal the
 *     frost log (hvweather / hvcompost isolation).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production onNewDay().
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
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const garden = /if\(G\.structures\.garden\)\{([\s\S]*?)\n  if\(G\.dog===2\)/.exec(loop);
const beds = garden ? garden[1] : '';

ok(/Slowly generates food each day/.test(cfg)
  && /title:'Cold Snap'/.test(loop)
  && /Temperature drops hard tonight/.test(loop)
  && /A cold snap grips the block/.test(loop),
  'the garden still pays each day; the snap still drops the temperature hard');
ok(beds && /weather\s*===\s*'cold'/.test(beds)
  && /snapActive\s*\(\s*\)/.test(beds),
  'HV-193: the garden harvest reads a named snap, not only weather frost');
ok(!/snap froze the beds/.test(ui) && !/snapActive\s*\(\s*\)/.test(ui),
  'ui.js untouched — the freeze lives on the dawn harvest');

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
    if (!sessionStorage.getItem('hvsnapbeds-init')) {
      sessionStorage.setItem('hvsnapbeds-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const gardenDawn = (opts) => page.evaluate((opts) => {
    const real = Math.random;
    Math.random = () => 0.5;
    SNAP_CHANCE = 0;
    G.population = 1;
    G.dog = 0;
    G.rep = 0;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.workers.scrapper = null;
    G.workers.cook = null;
    G.structures.tent = false;
    G.structures.workbench = false;
    G.structures.toolbox = false;
    G.structures.pantry = false;
    G.structures.soup_kitchen = false;
    G.structures.barrel = false;
    G.structures.garden = true;
    G.structures.compost = !!opts.compost;
    G.barrelWater = 0;
    G.mural = 0;
    G.days = 1;
    G.warmth = 90;
    G.food = 20;
    G.lastEventDay = G.days + 5;
    G.forecast = opts.weather;
    G.snapUntil = opts.snap ? G.days + 99 : null;
    log('HV193-MARK');
    onNewDay();
    Math.random = real;
    const lines = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const mark = lines.findLastIndex(t => /HV193-MARK/.test(t));
    const newest = (mark >= 0 ? lines.slice(mark + 1) : lines.slice(-8)).join('\n');
    return {
      food: G.food,
      weather: G.weather,
      snap: snapActive(),
      snapFroze: /The snap froze the beds/.test(newest),
      frost: /Frost on the beds/.test(newest),
      yielded: /Garden yielded/.test(newest),
      compostKept: /compost/.test(newest) && /kept one alive/.test(newest),
    };
  }, opts);

  const snapBare = await gardenDawn({ weather: 'clear', snap: true, compost: false });
  ok(snapBare.weather === 'clear' && snapBare.snap
    && snapBare.food === 18.5 && snapBare.snapFroze && !snapBare.yielded && !snapBare.frost,
    `HV-193: a clear snap dawn freezes the beds (food ${snapBare.food})`);

  const clear = await gardenDawn({ weather: 'clear', snap: false, compost: false });
  ok(clear.weather === 'clear' && !clear.snap
    && clear.food === 20.5 && clear.yielded && !clear.snapFroze,
    `a quiet clear dawn still yields (food ${clear.food})`);

  const frost = await gardenDawn({ weather: 'cold', snap: false, compost: false });
  ok(frost.weather === 'cold' && !frost.snap
    && frost.food === 18.5 && frost.frost && !frost.snapFroze && !frost.yielded,
    `weather frost without a snap still uses the frost line (food ${frost.food})`);

  const snapBin = await gardenDawn({ weather: 'clear', snap: true, compost: true });
  ok(snapBin.food === 19.5 && snapBin.snapFroze && snapBin.compostKept && !snapBin.yielded,
    `compost still keeps one bed through a clear snap (food ${snapBin.food})`);

  const stacked = await gardenDawn({ weather: 'cold', snap: true, compost: false });
  ok(stacked.weather === 'cold' && stacked.snap
    && stacked.food === 18.5 && stacked.frost && !stacked.snapFroze && !stacked.yielded,
    `cold weather + snap does not double-zero or steal the frost log (food ${stacked.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
