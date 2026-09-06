/*
 * HV-125 — a cold morning said the cold gets into everything,
 * and Forage Area never felt it.
 *
 * The winter dawn line is weather==='cold': "The cold gets into
 * everything." Dumpsters already read the sky (weatherDef().scav)
 * and winter halves the bins. Forage Area rolled raw 1–4 wood and
 * 2–6 cardboard in every season, under every sky. A frost morning
 * still hauled summer.
 *
 *  A. Source: the forage branch cuts on a cold sky. ui.js untouched.
 *     Scavenge still has its own winter / scav cut.
 *  B. Clear spring, pinned roll: 1 wood, 2 cardboard.
 *  C. THE SEAM: the same roll on a cold morning is half.
 *  D. Winter under a clear sky still hauls summer — this is not
 *     HV-108's Scrapper. Dumpsters Locked still refuses.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction / doAction on the production verb.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const forAt = src.indexOf("} else if(a.id==='forage'){");
const scavAt = src.indexOf("if(a.id==='scavenge'){");
const panAt = src.indexOf("} else if(a.id==='panhandle'){");
const forage = forAt >= 0 && panAt > forAt ? src.slice(forAt, panAt) : '';
const scav = scavAt >= 0 && forAt > scavAt ? src.slice(scavAt, forAt) : '';

// --- A. source --------------------------------------------------------
ok(forage.length > 0, 'the forage branch is still in player.js');
ok(/G\.weather\s*===\s*'cold'/.test(forage) && /0\.5|\.5/.test(forage),
   'Forage Area cuts on a cold sky — half a summer haul');
ok(/weatherDef\(\)\.scav/.test(scav) && /G\.season\s*===\s*3/.test(scav),
   'Scavenge still has its own winter half and sky scav cut');
ok(/The cold gets into everything/.test(loop),
   'the cold-morning log still says the cold gets into everything');
ok(!/a\.id==='forage'/.test(ui) && !/FORAGE_COLD/.test(ui),
   'ui.js was not given the woods — it still only paints the button');

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
    if (!sessionStorage.getItem('hvwoods-init')) {
      sessionStorage.setItem('hvwoods-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const haul = (weather, season) => page.evaluate(({ weather, season }) => {
    const real = Math.random;
    Math.random = () => 0;
    G.weather = weather;
    G.season = season;
    G.wood = 0; G.cardboard = 0;
    G.dumpsterLockDay = -1;
    finishAction({ id: 'forage' });
    Math.random = real;
    return { wood: G.wood, cardboard: G.cardboard };
  }, { weather, season });

  // --- B. clear spring is a summer haul --------------------------------
  const clear = await haul('clear', 0);
  ok(clear.wood === 1 && clear.cardboard === 2,
     `a clear spring still hauls 1 wood / 2 cardboard on the floor roll (${clear.wood}/${clear.cardboard})`);

  // --- C. the same roll on a cold morning is half ----------------------
  const frost = await haul('cold', 0);
  ok(frost.wood === 0 && frost.cardboard === 1,
     `a cold morning halves the woods (1/2 → ${frost.wood}/${frost.cardboard})`);

  // --- D. winter under a clear sky is not HV-108; the lock still refuses
  const winterClear = await haul('clear', 3);
  ok(winterClear.wood === 1 && winterClear.cardboard === 2,
     `winter under a clear sky still hauls summer — this is not the Scrapper (${winterClear.wood}/${winterClear.cardboard})`);

  const locked = await t(() => {
    G.days = 4; G.dumpsterLockDay = 4;
    G.wood = 5; G.cardboard = 5;
    const before = { wood: G.wood, cardboard: G.cardboard };
    doAction({ id: 'forage', time: 4000, cooldown: 12000 });
    return { wood: G.wood, cardboard: G.cardboard, job: !!activeJobs.forage, before };
  });
  ok(locked.wood === 5 && locked.cardboard === 5 && !locked.job,
     'Dumpsters Locked still refuses Forage Area before the timer');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
