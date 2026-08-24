/*
 * HV-5 — Homeless Village weather & forecast (re-runnable; page scripts are
 * classic scripts, so globals are directly reachable — no shipped hook).
 *  A. Dawn promotes the forecast to today's sky and rolls a new forecast.
 *  B. A cold snap stacks warmth drain (winter 18 + cold 12) and frosts the
 *     garden; a heat wave gives warmth back.
 *  C. Panhandle odds ride the weather (stubbed RNG: 0.7 succeeds only in a
 *     heat wave).
 *  D. The HUD badge shows today's icon, and the forecast arrow only once a
 *     Radio (or Lookout) is in camp; the Radio recipe exists.
 *  E. A legacy save with no weather keys migrates cleanly.
 *  F. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  // HV-18 landed a 25%-per-winter-dawn cold snap that stacks −10 warmth
  // and thins panhandling — orthogonal noise for these matched-dawn
  // legs (the snap has its own suite, hvsnap). Pin it out entirely.
  await page.evaluate(() => { SNAP_CHANCE = 0; G.snapUntil = null; });

  // A + B. cold snap dawn
  const cold = await page.evaluate(() => {
    G.season = 2; G.days = 20;          // day 21 → season recomputes to 3 - 1? (days/7)%4: 21/7=3 → winter
    G.forecast = 'cold'; G.warmth = 80; G.weather = 'clear'; G.lastEventDay = G.days + 5;
    G.structures.garden = true; const foodBefore = G.food;
    onNewDay();
    return { weather: G.weather, forecast: G.forecast, warmth: G.warmth, season: G.season,
             foodDelta: G.food - foodBefore, validForecast: !!WEATHERS[G.forecast] };
  });
  ok(cold.weather === 'cold' && cold.validForecast, `forecast became the day's sky, new forecast rolled (${cold.forecast})`);
  ok(cold.season === 3, 'day 21 is winter');
  ok(cold.warmth === 80 - 18 - 12, `cold snap stacks winter drain (warmth ${cold.warmth})`);
  ok(cold.foodDelta <= 0, `frost kept the garden barren (Δfood ${cold.foodDelta} — population upkeep only)`);

  // heat wave gives warmth back
  const heat = await page.evaluate(() => {
    G.forecast = 'heat'; G.warmth = 50; G.days = 8; G.lastEventDay = G.days + 5;   // next day 9 → (9/7)%4 = 1 summer
    onNewDay();
    return { weather: G.weather, warmth: G.warmth, season: G.season };
  });
  ok(heat.season === 1 && heat.weather === 'heat', 'summer heat wave lands');
  ok(heat.warmth === 50 - 8 + 8, `heat wave offsets the drain (warmth ${heat.warmth})`);

  // C. panhandle odds ride the weather (RNG stubbed at 0.7)
  const pan = await page.evaluate(() => {
    const realRand = Math.random;
    const run = w => {
      G.weather = w; G.goodwill = 0; G.morale = 50;
      Math.random = () => 0.7;
      finishAction({ id: 'panhandle', cooldown: 0, time: 0 });
      Math.random = realRand;
      return { goodwill: G.goodwill, morale: G.morale };
    };
    const heatTry = run('heat');     // 0.7 < .55*1.5 → success
    const clearTry = run('clear');   // 0.7 > .55 → ignored
    return { heatTry, clearTry };
  });
  ok(pan.heatTry.goodwill > 0, `heat-wave panhandle succeeds (goodwill +${pan.heatTry.goodwill})`);
  ok(pan.clearTry.goodwill === 0 && pan.clearTry.morale < 50, 'same roll on a clear day is ignored');

  // D. badge + forecast gating + recipe
  const badge = await page.evaluate(() => {
    G.workers.lookout = false; G.structures.radio = false; updateHUD();
    const noFc = document.getElementById('season-badge').textContent;
    G.structures.radio = true; updateHUD();
    const withFc = document.getElementById('season-badge').textContent;
    return { noFc, withFc, recipe: RECIPES.some(r => r.id === 'radio') };
  });
  ok(!badge.noFc.includes('→') && /[☀🌧❄🥵]/u.test(badge.noFc), `badge shows today's sky only (${badge.noFc})`);
  ok(badge.withFc.includes('→'), `radio reveals the forecast arrow (${badge.withFc})`);
  ok(badge.recipe, 'Radio recipe exists');

  // E. legacy save migration
  await page.evaluate(() => {
    const legacy = JSON.parse(localStorage.getItem(SAVE_KEY));
    delete legacy.weather; delete legacy.forecast; delete legacy.structures.radio;
    localStorage.setItem(SAVE_KEY, JSON.stringify(legacy));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const mig = await page.evaluate(() => ({
    w: G.weather, ok: !!WEATHERS[G.weather], radio: G.structures.radio,
  }));
  ok(mig.ok && mig.radio === false, `legacy save migrates (weather '${mig.w}', radio ${mig.radio})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
