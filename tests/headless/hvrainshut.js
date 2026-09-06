/*
 * HV-105 — the crash course said rain closes the panhandling corner.
 *
 * The first-run panel tells a new player: "rain closes the panhandling
 * corner." The Awning recipe sold the same close: "rain doesn't close
 * the panhandling spot anymore."
 *
 * WEATHERS.rain.pan is 0.5. finishAction still rolls .55 × 0.5 = .275.
 * A lucky .1 roll pays. The corner is not closed. HV-26's awning undoes
 * that half (×2) — it does not reopen a shut stall.
 *
 *  A. Source: the intro does not tell a new player the corner closes,
 *     and it names the half. The awning recipe matches.
 *  B. Live: rain.pan is still half, not zero.
 *  C. A lucky rainy panhandle (.1) still pays — rain halves, it does
 *     not lock the button.
 *  D. Isolation: the same .4 roll still misses in the rain (HV-26) and
 *     still lands under the awning / on a clear day.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction on the production path. No ui.js.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const html = fs.readFileSync(path.join(ROOT, 'homeless-village.html'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');

const introBlock = /id="intro-body"([\s\S]*?)<\/div>/.exec(html);
const introSrc = introBlock ? introBlock[1] : '';
const awning = /id:'awning'[\s\S]{0,280}?desc:'([^']+)'/.exec(cfg);

ok(!!introSrc && !/closes the panhandling/i.test(introSrc),
  'the crash course does not tell a new player rain closes the corner');
ok(/rain[\s\S]{0,60}(halv|half)/i.test(introSrc),
  'the crash course names rain and says it halves the corner, not that it shuts');
ok(awning && !/close/i.test(awning[1]) && /halv|half|odds|clear-day/i.test(awning[1]),
  `the Awning recipe no longer sells a closed corner (got: ${awning ? awning[1] : 'missing'})`);

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
    if (!sessionStorage.getItem('hvrainshut-init')) {
      sessionStorage.setItem('hvrainshut-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const live = await page.evaluate(() => {
    const rain = WEATHERS.rain;
    const copy = (document.getElementById('intro-body') || {}).innerText || '';
    return { pan: rain && rain.pan, copy: copy.replace(/\s+/g, ' ') };
  });
  ok(live.pan === 0.5,
    `rain's pan multiplier is half, not a lock (pan=${live.pan})`);
  ok(!/closes the panhandling/i.test(live.copy) && /rain[\s\S]{0,60}(halv|half)/i.test(live.copy),
    `the rendered crash course matches the half, not a closed corner`);

  const pan = (arg) => page.evaluate(({ weather, roll, awning }) => {
    const real = Math.random;
    let first = true;
    Math.random = () => { if (first) { first = false; return roll; } return 0.5; };
    G.weather = weather;
    G.structures.awning = awning;
    G.dog = 0; G.dogHungry = false;
    G.rep = 0; G.mural = 0; G.snapUntil = null;
    G.goodwill = 0; G.morale = 50;
    const g0 = G.goodwill;
    finishAction({ id: 'panhandle' });
    Math.random = real;
    return { gave: G.goodwill > g0, gw: G.goodwill - g0 };
  }, arg);

  // C — a lucky rainy roll still pays. .55 × .5 = .275; .1 lands.
  const lucky = await pan({ weather: 'rain', roll: 0.1, awning: false });
  ok(lucky.gave,
    `a lucky rainy panhandle still pays — rain halves, it does not close (gave=${lucky.gave}, +${lucky.gw})`);

  // D — HV-26's rain math stays: .4 misses bare rain, lands under the
  // awning, and lands on a clear day.
  const miss = await pan({ weather: 'rain', roll: 0.4, awning: false });
  const dry = await pan({ weather: 'rain', roll: 0.4, awning: true });
  const clear = await pan({ weather: 'clear', roll: 0.4, awning: false });
  ok(!miss.gave,
    `the half-odds still miss a .4 roll — HV-26's rain math stays (gave=${miss.gave})`);
  ok(dry.gave && clear.gave,
    `the same .4 roll still lands under the awning and on a clear day (awning=${dry.gave}, clear=${clear.gave})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
