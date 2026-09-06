/* HV-82 — the event banner pauses the day clock.
 *
 * HV-56 paused tickDay behind the crash course. HV-59 paused it behind
 * The Bridge. City Sweep / Kind Stranger / Cold Snap land in
 * #event-banner for 7s (or until ×). tickDay did not ask about it, so
 * reading a card near dawn burned the morning. Same class of drift,
 * different overlay — not HV-68 (Escape closes the banner), not HV-64
 * (Keys pause), and not HV-77 (Lookout #sweep-warning pause).
 *
 * Hook-free. Reverting the pause fails the named hold. ui.js untouched:
 * it still only shows and hides the banner.
 *
 * A. Source: eventOpen() in config.js beside bridgeOpen; tickDay asks it.
 * B. With the banner open, daylight / days / warmth hold at 0.99.
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

const evCall = tick.indexOf('if(eventOpen()) return');
const bridgeCall = tick.indexOf('if(bridgeOpen()) return');
ok(evCall > bridgeCall && evCall >= 0,
  'tickDay also freezes behind the event banner, via eventOpen(), after the Bridge pause');

ok(/function eventOpen\(\)\{\s*var b = document\.getElementById\('event-banner'\);\s*return !!\(b && b\.style\.display === 'block'\);\s*}/.test(cfg),
  'eventOpen lives in config.js beside bridgeOpen — DOM display of #event-banner');

ok(!/function eventOpen/.test(ui) && !/function tickDay/.test(ui),
  'ui.js was not given a pause API — it still only shows and hides the banner');

ok(!/getElementById\('event-banner'\)/.test(tick),
  'tickDay itself does not reach into #event-banner — it asks eventOpen()');

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
    helper: typeof eventOpen === 'function' && eventOpen() === false,
    dayMs: typeof DAY_LENGTH_MS === 'number' ? DAY_LENGTH_MS : null,
    tod: G.timeOfDay,
  }));
  ok(!boot.intro && boot.helper,
    'a returning camp is not behind the crash course — eventOpen() reports closed');
  ok(boot.dayMs === 600000,
    `DAY_LENGTH_MS is the ten-minute day this wait is sized against (${boot.dayMs})`);

  await page.waitForTimeout(2000);
  const running = await page.evaluate(() => G.timeOfDay);
  ok(running > boot.tod,
    `the day is running with the banner closed (timeOfDay ${boot.tod} -> ${running})`);

  const parked = await page.evaluate(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
    showEvent(ev, true);
    if (typeof eventTimer !== 'undefined') clearTimeout(eventTimer);
    G.timeOfDay = 0.99;
    G.weather = 'clear';
    G.forecast = 'clear';
    const label = document.getElementById('time-label');
    return {
      open: typeof eventOpen === 'function' && eventOpen() === true,
      display: document.getElementById('event-banner').style.display,
      tod: G.timeOfDay, days: G.days, warmth: G.warmth,
      label: label ? label.textContent : '',
    };
  });
  ok(parked.open && parked.display === 'block',
    'Kind Stranger opens #event-banner and eventOpen() agrees');

  await page.waitForTimeout(8000);
  const held = await page.evaluate(() => ({
    tod: G.timeOfDay, days: G.days, warmth: G.warmth,
    open: typeof eventOpen === 'function' && eventOpen() === true,
    label: document.getElementById('time-label').textContent,
  }));
  ok(held.open && held.tod === parked.tod && held.days === parked.days && held.warmth === parked.warmth,
    `HV-82: the day is paused behind the event banner (tod ${parked.tod}->${held.tod}, days ${parked.days}->${held.days}, warmth ${parked.warmth}->${held.warmth})`);
  ok(held.label === parked.label,
    `the on-screen time label holds with the clock ("${parked.label}" -> "${held.label}")`);

  await page.evaluate(() => { closeEvent(); });
  await page.waitForTimeout(400);
  const closed = await page.evaluate(() => ({
    display: document.getElementById('event-banner').style.display,
    helper: typeof eventOpen === 'function' && eventOpen() === false,
  }));
  ok(closed.display === 'none' && closed.helper,
    'closeEvent dismisses the banner and eventOpen() agrees');

  await page.waitForTimeout(8000);
  const after = await page.evaluate(() => ({ tod: G.timeOfDay, days: G.days, warmth: G.warmth }));
  ok(after.days === parked.days + 1,
    `closing the banner lets the clock run — the dawn that was waiting lands (days ${parked.days} -> ${after.days})`);
  ok(after.warmth !== parked.warmth,
    `and the night's warmth drain lands with it (${parked.warmth} -> ${after.warmth})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
