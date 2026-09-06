/*
 * HV-107 — Good Weather said mild temps, and the snap still bit.
 *
 * HV-67 taught the Good Weather card to assign G.weather = 'clear'.
 * The card also promised mild temps and a rare easy day. A running
 * Cold Snap (G.snapUntil) is neither. Panhandle still took the 0.75
 * snap cut. The next dawn still billed SNAP_WARMTH. The sky looked
 * clear. The snap had not heard.
 *
 * Distinct from HV-67 (hvsky): today's badge and the rain pan cut.
 * Distinct from HV-18 (hvsnap): snapAtDawn start / bite / break.
 * Distinct from HV-72 (#729): the Cold Snap *card* starting a snap.
 * Distinct from HV-90 (#757): the weather row's name, not the latch.
 * Not the coat-rack rain ticket (#783).
 *
 * A. Source: good_weather still clears the sky, and it ends a snap.
 * B. The card still promises mild temps and an easy day.
 * C. A gripping snap goes quiet when Good Weather lands.
 * D. Kind Stranger does not break a snap (control).
 * E. The same 0.45 panhandle roll that fails inside a snap pays
 *    after Good Weather has made the day easy.
 * Z. Zero page errors.
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

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const block = /id:'good_weather'[\s\S]*?effect:function\(\)\{([\s\S]*?)\n\s*\}\},/.exec(loop);
ok(!!block, 'good_weather event is still in gameloop.js');
ok(block && /G\.weather\s*=\s*['"]clear['"]/.test(block[1]),
  'Good Weather still assigns G.weather = \'clear\'');
ok(block && /snapUntil/.test(block[1]),
  'HV-107: Good Weather ends a running snap');
ok(/Clear skies and mild temps/.test(loop) && /rare easy day/.test(loop),
  'the card still promises mild temps and an easy day');
ok(!/onNewDay/.test(ui) && !/snapUntil/.test(ui),
  'ui.js is not this ticket — the snap still lives in gameloop.js');

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hveasy-init')) {
      sessionStorage.setItem('hveasy-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const gripped = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'good_weather');
    G.days = 5;
    G.snapUntil = 7;
    G.weather = 'cold';
    G.warmth = 50; G.morale = 50;
    G.dog = 0; G.dogHungry = false; G.rep = 0; G.mural = 0;
    G.structures.awning = false;
    G.goalIndex = GOALS.length;
    G.lastEventDay = G.days;
    const before = snapActive();
    triggerEvent(ev, true);
    return {
      before,
      after: snapActive(),
      weather: G.weather,
      banner: document.getElementById('ev-title').textContent,
      warmth: G.warmth,
      morale: G.morale,
    };
  });
  ok(gripped.banner === 'Good Weather',
    `the card still titles itself Good Weather (${gripped.banner})`);
  ok(gripped.before, 'the snap was gripping before the card');
  ok(gripped.weather === 'clear',
    `Good Weather still clears the sky (${gripped.weather})`);
  ok(gripped.after === false,
    `HV-107: Good Weather ends the snap (snapActive=${gripped.after})`);
  ok(gripped.warmth > 50 && gripped.morale > 50,
    `warmth and morale still rise (${gripped.warmth}/${gripped.morale})`);

  const stranger = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
    G.days = 5;
    G.snapUntil = 7;
    G.weather = 'cold';
    triggerEvent(ev, true);
    return { active: snapActive(), weather: G.weather };
  });
  ok(stranger.active && stranger.weather === 'cold',
    `Kind Stranger leaves the snap gripping (active=${stranger.active}, weather=${stranger.weather})`);

  // 0.45 > .55*0.75 (snap on a clear sky) and < .55 (easy day).
  const pan = await t(() => {
    const real = Math.random;
    const pin = () => {
      G.weather = 'clear';
      G.dog = 0; G.dogHungry = false; G.rep = 0; G.mural = 0;
      G.structures.awning = false;
      G.goalIndex = GOALS.length;
      G.goodwill = 0; G.morale = 50;
    };
    pin();
    G.snapUntil = G.days + 2;
    Math.random = () => 0.45;
    finishAction({ id: 'panhandle', cooldown: 0, time: 0 });
    Math.random = real;
    const inSnap = { goodwill: G.goodwill, morale: G.morale, active: snapActive() };

    const ev = EVENTS_GOOD.find(e => e.id === 'good_weather');
    G.snapUntil = G.days + 2;
    G.weather = 'cold';
    triggerEvent(ev, true);
    pin();
    Math.random = () => 0.45;
    finishAction({ id: 'panhandle', cooldown: 0, time: 0 });
    Math.random = real;
    return { inSnap, after: { goodwill: G.goodwill, active: snapActive() } };
  });
  ok(pan.inSnap.active && pan.inSnap.goodwill === 0 && pan.inSnap.morale < 50,
    `the same 0.45 roll is ignored while the snap still bites (gw=${pan.inSnap.goodwill})`);
  ok(pan.after.active === false && pan.after.goodwill > 0,
    `HV-107: after Good Weather the same roll pays (+${pan.after.goodwill} goodwill)`);

  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  await ctx.close();
  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
