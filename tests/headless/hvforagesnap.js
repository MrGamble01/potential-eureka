/*
 * HV-280 — Forage Area said cardboard and wood, then a named
 * cold snap still paid a quiet-day haul under a clear sky.
 *
 * The forage tooltip is "Search the surroundings for cardboard
 * and wood." The Cold Snap card is "Temperature drops hard
 * tonight." HV-18 already thins the corner: nobody lingers
 * outside in a cold snap (snapCut=0.75 on panhandle). Forage
 * rolled wood 1–4 and cardboard 2–6 with no snap. A named snap
 * (snapActive()) can grip on a clear dawn independently of
 * today's sky, and that search still paid the quiet-day haul.
 *
 * HV-217 / #910 is Scavenge vs a named snap (landed). HV-198
 * is forage vs rain (landed — cardboard halves in the wet).
 * #850 is forage vs winter. #806 is forage vs weather-cold.
 * #883 is the garden vs a named snap. This ticket is the snap
 * status vs Forage Area. ui.js is not this ticket.
 *
 * Main already sat HV-229 as the thermos fire and HV-279 as
 * flyers → Word (#922). PR title stays HV-229.
 *
 *  A. Source: the search still promises cardboard and wood. The
 *     snap still drops the temperature hard tonight. Panhandle
 *     still cuts.
 *  B. Source: the forage haul reads snapActive(). ui.js does not.
 *     Scavenge already has its own named-snap cut (HV-217).
 *  C. Live: the same pinned 0.99 roll that pays 4 wood / 6
 *     cardboard on a quiet clear morning pays 3 / 4 inside a
 *     named snap.
 *  D. A quiet clear morning still pays the full haul.
 *  E. Rain without a named snap still soaks the sheets (HV-198).
 *     Winter without a snap still pays the full haul (#850).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production finishAction({id:'forage'}).
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

const forage = /if\(a\.id==='forage'\)\{([\s\S]*?)\n  \} else if\(a\.id==='panhandle'\)/.exec(player);
const haul = forage ? forage[1] : '';
const scav = /if\(a\.id==='scavenge'\)\{([\s\S]*?)\n  \} else if\(a\.id==='forage'\)/.exec(player);
const bins = scav ? scav[1] : '';
const pan = /if\(a\.id==='panhandle'\)\{([\s\S]*?)\n  \} else if\(a\.id==='rest'\)/.exec(player);
const corner = pan ? pan[1] : '';

ok(/Search the surroundings for cardboard and wood/.test(cfg)
  && /title:'Cold Snap'/.test(loop)
  && /Temperature drops hard tonight/.test(loop)
  && /nobody lingers outside in a cold snap/.test(player),
  'the search still promises cardboard and wood; the snap still drops the temperature hard');
ok(haul && /snapActive\s*\(\s*\)/.test(haul) && /0\.75/.test(haul),
  'HV-280: the forage haul reads a named snap, not only a quiet-day roll');
ok(/snapActive\s*\(\s*\)/.test(corner) && /0\.75/.test(corner),
  'panhandle still thins the corner inside a snap');
ok(bins && /snapActive\s*\(\s*\)/.test(bins),
  'scavenge already thins inside a named snap — HV-217 / #910; this ticket is forage');
ok(/weather\s*===\s*'rain'|G\.weather==='rain'/.test(haul),
  'HV-198 rain cardboard cut still lives on the forage haul');
ok(!/snapActive\s*\(\s*\)/.test(ui),
  'ui.js untouched — the forage cut lives on the forage haul');

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
    if (!sessionStorage.getItem('hvforagesnap-init')) {
      sessionStorage.setItem('hvforagesnap-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  // rand(1,4) with 0.99 → 4; rand(2,6) → 6
  const haulAt = (opts) => page.evaluate((opts) => {
    const real = Math.random;
    Math.random = () => 0.99;
    G.season = opts.season;
    G.weather = opts.weather;
    G.days = 1;
    G.snapUntil = opts.snap ? 3 : null;
    G.wood = 0;
    G.cardboard = 0;
    G.cooldowns = {};
    finishAction({ id: 'forage' });
    Math.random = real;
    return {
      wood: G.wood,
      cardboard: G.cardboard,
      weather: G.weather,
      snap: snapActive(),
      season: G.season,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).slice(-1)[0],
    };
  }, opts);

  const snapClear = await haulAt({ season: 0, weather: 'clear', snap: true });
  ok(snapClear.weather === 'clear' && snapClear.snap
    && snapClear.wood === 3 && snapClear.cardboard === 4,
    `HV-280: a clear snap haul is 3 wood / 4 cardboard, not the quiet 4 / 6 (${snapClear.wood} / ${snapClear.cardboard})`);

  const quiet = await haulAt({ season: 0, weather: 'clear', snap: false });
  ok(quiet.weather === 'clear' && !quiet.snap
    && quiet.wood === 4 && quiet.cardboard === 6,
    `a quiet clear morning still pays 4 wood / 6 cardboard (${quiet.wood} / ${quiet.cardboard})`);

  const rain = await haulAt({ season: 0, weather: 'rain', snap: false });
  ok(rain.weather === 'rain' && !rain.snap
    && rain.wood === 4 && rain.cardboard === 3,
    `rain without a named snap still soaks the sheets — forage-vs-rain is HV-198 (${rain.wood} / ${rain.cardboard})`);

  const winter = await haulAt({ season: 3, weather: 'clear', snap: false });
  ok(winter.season === 3 && !winter.snap
    && winter.wood === 4 && winter.cardboard === 6,
    `winter without a snap still pays the full haul — forage-vs-winter is #850 (${winter.wood} / ${winter.cardboard})`);

  const frost = await haulAt({ season: 0, weather: 'cold', snap: false });
  ok(frost.weather === 'cold' && !frost.snap
    && frost.wood === 4 && frost.cardboard === 6,
    `weather-cold without a named snap still pays the full haul — forage-vs-cold is #806 (${frost.wood} / ${frost.cardboard})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
