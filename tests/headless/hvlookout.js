/* HV-90 — tomorrow's sky wore a radio the Lookout never built.
 *
 * forecastVisible() is Lookout OR Radio. The HUD arrow already
 * respects that (hvweather D). The Radio recipe sells the weather
 * band. The Lookout hire line only mentioned sweeps. Dawn still
 * logged "📻 Tomorrow" even when the camp had no radio — a band
 * the Lookout never carried.
 *
 * Write-first, hook-free.
 *
 *  A. Source: Lookout hire copy mentions tomorrow's sky. The dawn
 *     line picks an icon from radio vs lookout, not a hardcoded
 *     radio for every forecast. Radio recipe still sells the band.
 *     ui.js still only paints the arrow.
 *  B. Live: Lookout, no radio — dawn still prints Tomorrow, and
 *     that line is not a radio. Radio, no Lookout — still Tomorrow
 *     (the band). Neither — no Tomorrow line.
 *  Z. Zero page errors.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg  = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const lookAt = cfg.indexOf("id:'lookout'");
const look = lookAt >= 0 ? cfg.slice(lookAt, lookAt + 220) : '';
const radioAt = cfg.indexOf("id:'radio'");
const radio = radioAt >= 0 ? cfg.slice(radioAt, radioAt + 280) : '';
const dawnAt = loop.indexOf("if(forecastVisible()");
const dawn = dawnAt >= 0 ? loop.slice(dawnAt, dawnAt + 280) : '';

ok(/lookout/.test(look) && /tomorrow|sky|forecast|weather/i.test(look),
  'A. Lookout hire copy mentions tomorrow\'s sky, not only sweeps');
ok(/weather band|tomorrow/i.test(radio),
  'A. Radio recipe still sells the weather band');
ok(/forecastVisible/.test(dawn) && /Tomorrow/.test(dawn),
  'A. onNewDay still prints Tomorrow once someone can see the sky');
ok(/structures\.radio/.test(dawn) && /workers\.lookout/.test(dawn),
  'A. the Tomorrow line picks radio vs lookout — not one radio for every camp');
ok(!/Tomorrow/.test(ui) && /forecastVisible/.test(ui),
  'A. ui.js still only paints the forecast arrow — this ticket is the log');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {}
    try { localStorage.removeItem('homeless_village_v1'); } catch (e) {}
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2200);

  const newLines = (before) => page.evaluate((n) =>
    Array.from(document.querySelectorAll('.log-line')).slice(n).map(d => d.textContent).join('\n'), before);

  const lineCount = () => page.evaluate(() => document.querySelectorAll('.log-line').length);

  const quietDawn = (workers, structures) => page.evaluate((w, s) => {
    Object.assign(G, {
      dog: 1, dogMetDay: 999, lastEventDay: 9999, goalIndex: 9999,
      days: 5, timeOfDay: 0.98, food: 12, warmth: 70, population: 1,
      morale: 70, health: 80, goodwill: 10, money: 20,
      weather: 'clear', forecast: 'clear', snapUntil: null,
      rayDebt: 0, rainBetOn: false, arcStage: 1, arcDone: false,
      workers: Object.assign({ scrapper: false, builder: false, cook: false, lookout: false }, w || {}),
      structures: Object.assign({
        tent: false, fire: true, stash: false, garden: false,
        kitchen: false, clinic: false, soup_kitchen: false, radio: false
      }, s || {})
    });
    Math.random = () => 0.9;
    onNewDay();
  }, workers, structures);

  let n = await lineCount();
  await quietDawn({ lookout: true }, { radio: false });
  const eye = await newLines(n);
  const eyeLine = (eye.split('\n').find(l => /Tomorrow/.test(l)) || '');
  ok(/Tomorrow/.test(eyeLine),
    `B. Lookout, no radio — dawn still prints Tomorrow (${eyeLine || 'no line'})`);
  ok(eyeLine && !/\ud83d\udcfb/.test(eyeLine) && !/📻/.test(eyeLine),
    `B. that Tomorrow line is not a radio the camp never built (${eyeLine})`);

  n = await lineCount();
  await quietDawn({ lookout: false }, { radio: true });
  const band = await newLines(n);
  const bandLine = (band.split('\n').find(l => /Tomorrow/.test(l)) || '');
  ok(/Tomorrow/.test(bandLine),
    `B. Radio, no Lookout — the weather band still prints Tomorrow (${bandLine || 'no line'})`);

  n = await lineCount();
  await quietDawn({ lookout: false }, { radio: false });
  const blind = await newLines(n);
  ok(!/Tomorrow/.test(blind),
    'B. neither Lookout nor Radio — no Tomorrow line');

  await browser.close();
  ok(errs.length === 0, `Z. no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
