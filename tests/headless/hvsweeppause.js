/* HV-77 — the Lookout sweep warning pauses the day clock.
 *
 * HV-56 paused tickDay behind the crash course. HV-59 paused it behind
 * The Bridge. The Lookout's payoff is a 30-second scramble
 * (#sweep-warning + PACK UP CAMP). tickDay did not ask about it, so a
 * warning that popped seconds before dawn burned the morning while you
 * were still packing. Same class of drift, different overlay — not
 * HV-71 (Biscuit cancelled the warning) and not HV-64 (Keys pause).
 *
 * Hook-free. Reverting the pause fails the named hold. ui.js untouched:
 * it still only shows and hides the warning.
 *
 * A. Source: sweepOpen() in config.js beside bridgeOpen; tickDay asks it.
 * B. With the warning open, daylight / days / warmth hold at 0.99.
 * C. Closing it lets the waiting dawn land.
 * Z. Zero page errors.
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
const tickAt = loop.indexOf('function tickDay(dt){');
const tick = tickAt >= 0 ? loop.slice(tickAt, tickAt + 2400) : '';

ok(tickAt >= 0 && /if\(bridgeOpen\(\)\)\s*return/.test(tick),
  'tickDay still freezes behind The Bridge');

const sweepCall = tick.indexOf('if(sweepOpen()) return');
const bridgeCall = tick.indexOf('if(bridgeOpen()) return');
ok(sweepCall > bridgeCall && sweepCall >= 0,
  'tickDay also freezes behind the sweep warning, via sweepOpen(), after the Bridge pause');

ok(/function sweepOpen\(\)\{\s*var b = document\.getElementById\('sweep-warning'\);\s*return !!\(b && b\.style\.display === 'block'\);\s*}/.test(cfg),
  'sweepOpen lives in config.js beside bridgeOpen — DOM display of #sweep-warning');

ok(!/function sweepOpen/.test(ui) && !/function tickDay/.test(ui),
  'ui.js was not given a pause API — it still only shows and hides the warning');

ok(!/getElementById\('sweep-warning'\)/.test(tick),
  'tickDay itself does not reach into #sweep-warning — it asks sweepOpen()');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => { try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {} });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => ({
    intro: !!(document.getElementById('intro-modal') && document.getElementById('intro-modal').classList.contains('open')),
    helper: typeof sweepOpen === 'function' && sweepOpen() === false,
    dayMs: typeof DAY_LENGTH_MS === 'number' ? DAY_LENGTH_MS : null,
    tod: G.timeOfDay,
    warn: document.getElementById('sweep-warning'),
  }));
  ok(!boot.intro && boot.warn,
    'a returning camp is not behind the crash course — #sweep-warning exists');
  ok(boot.helper,
    'sweepOpen() is live on the page and reports closed on boot');
  ok(boot.dayMs === 600000,
    `DAY_LENGTH_MS is the ten-minute day this wait is sized against (${boot.dayMs})`);

  await page.waitForTimeout(2000);
  const running = await page.evaluate(() => G.timeOfDay);
  ok(running > boot.tod,
    `the day is running with the warning closed (timeOfDay ${boot.tod} -> ${running})`);

  const parked = await page.evaluate(() => {
    showSweepWarning(true, Date.now() + 60000);
    G.timeOfDay = 0.99;
    G.weather = 'clear';
    G.forecast = 'clear';
    const label = document.getElementById('time-label');
    return {
      open: typeof sweepOpen === 'function' && sweepOpen() === true,
      display: document.getElementById('sweep-warning').style.display,
      tod: G.timeOfDay, days: G.days, warmth: G.warmth,
      label: label ? label.textContent : '',
    };
  });
  ok(parked.open && parked.display === 'block',
    'LOOKOUT warning opens #sweep-warning and sweepOpen() agrees');

  await page.waitForTimeout(8000);
  const held = await page.evaluate(() => ({
    tod: G.timeOfDay, days: G.days, warmth: G.warmth,
    open: typeof sweepOpen === 'function' && sweepOpen() === true,
    label: document.getElementById('time-label').textContent,
  }));
  ok(held.open && held.tod === parked.tod && held.days === parked.days && held.warmth === parked.warmth,
    `HV-77: the day is paused behind the Lookout sweep warning (tod ${parked.tod}->${held.tod}, days ${parked.days}->${held.days}, warmth ${parked.warmth}->${held.warmth})`);
  ok(held.label === parked.label,
    `the on-screen time label holds with the clock ("${parked.label}" -> "${held.label}")`);

  await page.evaluate(() => { showSweepWarning(false); });
  await page.waitForTimeout(400);
  const closed = await page.evaluate(() => ({
    display: document.getElementById('sweep-warning').style.display,
    helper: typeof sweepOpen === 'function' && sweepOpen() === false,
  }));
  ok(closed.display === 'none' && closed.helper,
    'hiding the warning dismisses #sweep-warning and sweepOpen() agrees');

  await page.waitForTimeout(8000);
  const after = await page.evaluate(() => ({ tod: G.timeOfDay, days: G.days, warmth: G.warmth }));
  ok(after.days === parked.days + 1,
    `closing the warning lets the clock run — the dawn that was waiting lands (days ${parked.days} -> ${after.days})`);
  ok(after.warmth !== parked.warmth,
    `and the night's warmth drain lands with it (${parked.warmth} -> ${after.warmth})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
