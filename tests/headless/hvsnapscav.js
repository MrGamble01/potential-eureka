/* HV-217 — Scavenge Dumpster said scraps, cans, or food, then a
 * named cold snap still paid a quiet-day haul under a clear sky.
 *
 * The dumpster tooltip is "Dig through dumpsters for scraps, cans,
 * or food." The Cold Snap card is "Temperature drops hard tonight."
 * HV-18 already thins the corner: "nobody lingers outside in a cold
 * snap" (`snapCut=0.75` on panhandle). Scavenge only multiplied
 * winter and weatherDef().scav. A named snap (`snapActive()`) can
 * grip on a clear dawn independently of today's sky, and those bins
 * still paid the quiet-day haul.
 *
 * #788 / #857 are winter vs the Scrapper. #806 is forage vs cold
 * weather. #823 is busk vs snap. #883 is garden vs named snap.
 * #888 is forage vs rain. This is the snap status vs Scavenge.
 *
 *  A. Source: the dumpster still digs for scraps. The snap still
 *     drops the temperature hard tonight. Panhandle still cuts.
 *  B. Source: the scavenge haul reads snapActive(). ui.js does not.
 *  C. Live: the same pinned 0.99 roll that pays 3 cans / 4 scraps
 *     on a quiet clear morning pays 2 / 3 inside a named snap.
 *  D. A quiet clear morning still pays the full haul.
 *  E. Weather-cold without a named snap still uses scav 0.75.
 *  F. Winter without a snap still halves. Cold weather + snap stacks.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production finishAction({id:'scavenge'}).
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

const scav = /if\(a\.id==='scavenge'\)\{([\s\S]*?)\n  \} else if\(a\.id==='forage'\)/.exec(player);
const haul = scav ? scav[1] : '';
const pan = /if\(a\.id==='panhandle'\)\{([\s\S]*?)\n  \} else if\(a\.id==='rest'\)/.exec(player);
const corner = pan ? pan[1] : '';

ok(/Dig through dumpsters for scraps, cans, or food/.test(cfg)
  && /title:'Cold Snap'/.test(loop)
  && /Temperature drops hard tonight/.test(loop)
  && /nobody lingers outside in a cold snap/.test(player),
  'the dumpster still digs; the snap still drops the temperature hard');
ok(haul && /snapActive\s*\(\s*\)/.test(haul) && /0\.75/.test(haul),
  'HV-217: the scavenge haul reads a named snap, not only winter and weather');
ok(/snapActive\s*\(\s*\)/.test(corner) && /0\.75/.test(corner),
  'panhandle still thins the corner inside a snap');
ok(!/snapActive\s*\(\s*\)/.test(ui) && !/0\.75/.test(ui),
  'ui.js untouched — the dumpster cut lives on the scavenge haul');

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
    if (!sessionStorage.getItem('hvsnapscav-init')) {
      sessionStorage.setItem('hvsnapscav-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  // rand(0,3) with 0.99 → 3; rand(1,4) → 4; empty 0.99>=.2; food 0.99>=.45
  const haulAt = (opts) => page.evaluate((opts) => {
    const real = Math.random;
    Math.random = () => 0.99;
    G.season = opts.season;
    G.weather = opts.weather;
    G.days = 1;
    G.snapUntil = opts.snap ? 3 : null;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    G.workers.scrapper = null;
    G.cans = 0;
    G.scraps = 0;
    G.food = 10;
    G.totalScavenged = 0;
    G.cooldowns = {};
    finishAction({ id: 'scavenge' });
    Math.random = real;
    return {
      cans: G.cans,
      scraps: G.scraps,
      food: G.food,
      weather: G.weather,
      snap: snapActive(),
      season: G.season,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).slice(-1)[0],
    };
  }, opts);

  const snapClear = await haulAt({ season: 0, weather: 'clear', snap: true });
  ok(snapClear.weather === 'clear' && snapClear.snap
    && snapClear.cans === 2 && snapClear.scraps === 3 && snapClear.food === 10,
    `HV-217: a clear snap haul is 2 cans / 3 scraps, not the quiet 3 / 4 (${snapClear.cans} / ${snapClear.scraps})`);

  const quiet = await haulAt({ season: 0, weather: 'clear', snap: false });
  ok(quiet.weather === 'clear' && !quiet.snap
    && quiet.cans === 3 && quiet.scraps === 4 && quiet.food === 10,
    `a quiet clear morning still pays 3 cans / 4 scraps (${quiet.cans} / ${quiet.scraps})`);

  const frost = await haulAt({ season: 0, weather: 'cold', snap: false });
  ok(frost.weather === 'cold' && !frost.snap
    && frost.cans === 2 && frost.scraps === 3,
    `weather-cold without a named snap still uses scav 0.75 (${frost.cans} / ${frost.scraps})`);

  const winter = await haulAt({ season: 3, weather: 'clear', snap: false });
  ok(winter.season === 3 && !winter.snap
    && winter.cans === 1 && winter.scraps === 2,
    `winter without a snap still halves (${winter.cans} / ${winter.scraps})`);

  const stacked = await haulAt({ season: 0, weather: 'cold', snap: true });
  ok(stacked.weather === 'cold' && stacked.snap
    && stacked.cans === 1 && stacked.scraps === 2,
    `cold weather + named snap stacks the two 0.75 cuts (${stacked.cans} / ${stacked.scraps})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
