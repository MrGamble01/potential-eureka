/*
 * HV-153 — Fire Went Out said everything is colder, then the sky
 * stayed a scorcher.
 *
 * The card body is "The barrel fire died overnight. Everything is
 * colder." The effect cut warmth and dimmed the barrel
 * (G.fireOutUntil). G.weather stayed heat / rain / clear. The HUD
 * badge still said Heat Wave. Panhandle still used the scorcher's
 * 1.5. Same assignment miss as Good Weather → clear (HV-67) and
 * Cold Snap → cold (HV-149), different event. Does not start
 * snapUntil (that's #729 / #757).
 *
 *  A. Source: the fire_out effect assigns G.weather = 'cold'.
 *  B. The card still promises everything is colder.
 *  C. A heat-wave midday becomes cold — name, pan, HUD badge.
 *  D. Warmth still falls. The barrel still goes dark.
 *  E. Kind Stranger does not change the sky (control).
 *  F. Good Weather still clears. Firewood still relights.
 *  Z. Zero page errors. ui.js untouched.
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
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const block = /id:'fire_out'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(src);
ok(!!block, 'fire_out event is still in gameloop.js');
ok(block && /G\.weather\s*=\s*['"]cold['"]/.test(block[1]),
  'HV-153: fire_out effect assigns G.weather = \'cold\'');
ok(/Everything is colder/.test(src),
  'the card still promises everything is colder');
ok(!/id:'fire_out'[\s\S]{0,400}G\.weather/.test(ui),
  'ui.js untouched — the sky lives on the fire_out effect');

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
    if (!sessionStorage.getItem('hvfiresky-init')) {
      sessionStorage.setItem('hvfiresky-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const heat = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    G.weather = 'heat';
    G.warmth = 70; G.morale = 50;
    G.fireOutUntil = 0;
    G.snapUntil = null;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, false);
    const badge = document.getElementById('season-badge').textContent;
    return {
      weather: G.weather,
      name: weatherDef().name,
      pan: weatherDef().pan,
      warmth: G.warmth,
      dark: Date.now() < (G.fireOutUntil || 0),
      snap: snapActive(),
      badge: badge,
      heatIcon: badge.indexOf(WEATHERS.heat.icon) >= 0,
      coldIcon: badge.indexOf(WEATHERS.cold.icon) >= 0,
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
    };
  });
  ok(heat.banner === 'Fire Went Out', `the card still titles itself Fire Went Out (${heat.banner})`);
  ok(/Everything is colder/i.test(heat.body), 'the body still says everything is colder');
  ok(heat.weather === 'cold' && heat.name === 'Cold Snap' && heat.pan === 0.75,
    `a scorcher becomes cold (weather=${heat.weather}, name=${heat.name}, pan=${heat.pan})`);
  ok(heat.coldIcon && !heat.heatIcon,
    `the HUD badge shows the cold icon, not the scorcher (${heat.badge})`);
  ok(heat.warmth < 70 && heat.dark,
    `warmth still falls and the barrel still goes dark (${heat.warmth}, dark=${heat.dark})`);
  ok(!heat.snap, 'does not start a multi-day snap (that is a different ticket)');

  const stranger = await page.evaluate(() => {
    G.weather = 'heat';
    triggerEvent(EVENTS_GOOD.find(e => e.id === 'kind_stranger'), true);
    return { weather: G.weather, name: weatherDef().name };
  });
  ok(stranger.weather === 'heat' && stranger.name === 'Heat Wave',
    `Kind Stranger leaves the scorcher up (${stranger.weather})`);

  const sky = await page.evaluate(() => {
    G.weather = 'rain';
    triggerEvent(EVENTS_GOOD.find(e => e.id === 'good_weather'), true);
    return { weather: G.weather, name: weatherDef().name };
  });
  ok(sky.weather === 'clear' && sky.name === 'Clear',
    `Good Weather still clears the sky (${sky.weather})`);

  const wood = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'fire_out');
    const recipe = RECIPES.find(r => r.id === 'fire_ration');
    G.weather = 'heat';
    G.warmth = 60;
    G.fireOutUntil = 0;
    triggerEvent(ev, false);
    const outAfter = Date.now() < (G.fireOutUntil || 0);
    G.activeCrafts[recipe.id] = { start: Date.now(), duration: 1 };
    finishCraft(recipe);
    return {
      outAfter,
      relit: !((G.fireOutUntil || 0) > Date.now()),
      weather: G.weather,
    };
  });
  ok(wood.outAfter && wood.relit,
    `Firewood still relights the barrel (relit=${wood.relit})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
