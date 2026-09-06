/*
 * HV-149 — Cold Snap said temperature drops hard, then the sky
 * stayed a scorcher.
 *
 * The card title is "Cold Snap." The body says temperature drops
 * hard tonight. The effect cut warmth, health and morale, then
 * walked away. G.weather stayed heat / rain / clear. The HUD badge
 * still said Heat Wave. Panhandle still used the scorcher's 1.5
 * lift. HV-67 is the mirror: Good Weather promised clear skies and
 * only warmed the camp. #729 is the same card starting snapUntil.
 * This ticket is the sky.
 *
 *  A. Source: cold_snap effect assigns G.weather = 'cold'.
 *  B. The card is still titled Cold Snap / temperature drops hard.
 *  C. A live trigger turns a Heat Wave into Cold Snap.
 *  D. Kind Stranger does not freeze the sky. Good Weather still
 *     clears it. Warmth still falls.
 *  E. ui.js is untouched.
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
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const block = /id:'cold_snap'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(src);
ok(!!block, 'cold_snap event is still in gameloop.js');
ok(block && /G\.weather\s*=\s*['"]cold['"]/.test(block[1]),
  'HV-149: Cold Snap said temperature drops hard, then the sky stayed a scorcher');
ok(/title:'Cold Snap'/.test(src) && /Temperature drops hard tonight/.test(src),
  'the card is still titled Cold Snap and still names tonight');
ok(!/id:'cold_snap'/.test(ui) && !/G\.weather\s*=\s*['"]cold['"]/.test(ui),
  'ui.js is untouched — the snap sky is not drawn there');

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
    if (!sessionStorage.getItem('hvsnapsky-init')) {
      sessionStorage.setItem('hvsnapsky-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const snap = await t(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'cold_snap');
    const real = Math.random;
    Math.random = () => 0;
    G.weather = 'heat';
    G.warmth = 80; G.health = 80; G.morale = 50;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    triggerEvent(ev, false);
    Math.random = real;
    return {
      weather: G.weather,
      name: weatherDef().name,
      pan: weatherDef().pan,
      warmth: G.warmth,
      health: G.health,
      morale: G.morale,
      banner: document.getElementById('ev-title').textContent,
      body: document.getElementById('ev-body').textContent,
      badge: document.getElementById('season-badge').textContent,
    };
  });

  ok(snap.banner === 'Cold Snap',
    `the card still titles itself Cold Snap (${snap.banner})`);
  ok(/temperature drops hard/i.test(snap.body),
    `the body still names the drop (${snap.body.slice(0, 80)})`);
  ok(snap.warmth < 80 && snap.health < 80 && snap.morale < 50,
    `warmth, health and morale still fall (${snap.warmth}/${snap.health}/${snap.morale})`);
  ok(snap.weather === 'cold' && snap.name === 'Cold Snap' && snap.pan === 0.75,
    `HV-149: a Heat Wave becomes Cold Snap (weather=${snap.weather} pan=${snap.pan})`);
  ok(/\u2744/.test(snap.badge),
    `the HUD badge wears the snap (${snap.badge})`);

  const stranger = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
    const real = Math.random;
    Math.random = () => 0.5;
    G.weather = 'heat'; G.food = 0;
    triggerEvent(ev, true);
    Math.random = real;
    return { weather: G.weather, food: G.food };
  });
  ok(stranger.weather === 'heat' && stranger.food > 0,
    `Kind Stranger is still a food drop, not a freeze (weather=${stranger.weather} food=${stranger.food})`);

  const fair = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'good_weather');
    G.weather = 'rain';
    triggerEvent(ev, true);
    return { weather: G.weather };
  });
  ok(fair.weather === 'clear',
    `Good Weather still clears the sky (${fair.weather})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
