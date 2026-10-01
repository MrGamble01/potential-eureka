/*
 * HV-67 — Good Weather said clear skies, then left the rain falling.
 *
 * The card title is "Good Weather". The body is "Clear skies and mild
 * temps. A rare easy day." The effect warmed the camp and lifted
 * morale, then walked away. G.weather stayed rain / cold / heat. The
 * HUD badge still showed the storm. Panhandle still used the rain's
 * 0.5 cut. hvweather only drives onNewDay forecast promotion, so the
 * seam was invisible.
 *
 *  A. Source: the good_weather effect assigns G.weather = 'clear'.
 *  B. A rainy midday becomes Clear — name, pan, HUD badge.
 *  C. Kind Stranger does not clear the sky (control).
 *  D. A heat wave also becomes mild (the card said mild temps).
 *  E. The same 0.4 panhandle roll that fails in the rain succeeds
 *     once Good Weather has cleared it.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives triggerEvent() on the production event.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const block = /id:'good_weather'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(src);
ok(!!block, 'good_weather event is still in gameloop.js');
ok(block && /G\.weather\s*=\s*['"]clear['"]/.test(block[1]),
  'HV-67: good_weather effect assigns G.weather = \'clear\'');
ok(/Clear skies and mild temps/.test(src),
  'the card still promises clear skies and mild temps');

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
    if (!sessionStorage.getItem('hvsky-init')) {
      sessionStorage.setItem('hvsky-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // B. rain → clear via the real event path
  const rain = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'good_weather');
    G.weather = 'rain';
    G.warmth = 50; G.morale = 50;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, true);
    const badge = document.getElementById('season-badge').textContent;
    const banner = document.getElementById('ev-title').textContent;
    return {
      weather: G.weather,
      name: weatherDef().name,
      pan: weatherDef().pan,
      badge: badge,
      rainIcon: badge.indexOf(WEATHERS.rain.icon) >= 0,
      clearIcon: badge.indexOf(WEATHERS.clear.icon) >= 0,
      banner: banner,
      warmth: G.warmth,
      morale: G.morale,
    };
  });
  ok(rain.banner === 'Good Weather', `the card still titles itself Good Weather (${rain.banner})`);
  ok(rain.weather === 'clear' && rain.name === 'Clear' && rain.pan === 1,
    `rainy midday becomes Clear (weather=${rain.weather}, name=${rain.name}, pan=${rain.pan})`);
  ok(rain.clearIcon && !rain.rainIcon,
    `the HUD badge shows the clear icon, not the rain (${rain.badge})`);
  ok(rain.warmth > 50 && rain.morale > 50,
    `warmth and morale still rise (${rain.warmth}/${rain.morale})`);

  // C. Kind Stranger is not a weather event
  const stranger = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
    G.weather = 'rain';
    triggerEvent(ev, true);
    return { weather: G.weather, name: weatherDef().name };
  });
  ok(stranger.weather === 'rain' && stranger.name === 'Rain',
    `Kind Stranger leaves the rain falling (${stranger.weather})`);

  // D. heat wave → mild
  const heat = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'good_weather');
    G.weather = 'heat';
    triggerEvent(ev, true);
    return { weather: G.weather, name: weatherDef().name, pan: weatherDef().pan };
  });
  ok(heat.weather === 'clear' && heat.name === 'Clear' && heat.pan === 1,
    `a heat wave becomes mild (weather=${heat.weather}, pan=${heat.pan})`);

  // E. the same 0.4 panhandle roll: fail in rain, succeed after the sky clears
  const pan = await t(() => {
    const real = Math.random;
    const quiet = () => {
      G.dog = 0; G.dogHungry = false; G.rep = 0; G.mural = 0;
      G.snapUntil = null; G.structures.awning = false;
    };
    const roll = w => {
      quiet();
      G.weather = w; G.goodwill = 0; G.morale = 50;
      Math.random = () => 0.4;
      finishAction({ id: 'panhandle', cooldown: 0, time: 0 });
      Math.random = real;
      return { goodwill: G.goodwill, morale: G.morale };
    };
    const inRain = roll('rain');          // 0.4 > .55*0.5 → ignored
    const ev = EVENTS_GOOD.find(e => e.id === 'good_weather');
    G.weather = 'rain';
    triggerEvent(ev, true);
    quiet();
    G.goodwill = 0; G.morale = 50;
    Math.random = () => 0.4;
    finishAction({ id: 'panhandle', cooldown: 0, time: 0 });
    Math.random = real;
    return { inRain, after: { goodwill: G.goodwill, weather: G.weather } };
  });
  ok(pan.inRain.goodwill === 0 && pan.inRain.morale < 50,
    'the same 0.4 roll is ignored while it is still raining');
  ok(pan.after.weather === 'clear' && pan.after.goodwill > 0,
    `after Good Weather the same roll pays (weather=${pan.after.weather}, +${pan.after.goodwill} goodwill)`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
