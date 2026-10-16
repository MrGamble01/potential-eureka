/* HV-59 — The Bridge pauses the day clock.
 *
 * HV-56 paused tickDay behind the first-run crash course so reading
 * how the camp works does not cost daylight. The Bridge (#chain-modal)
 * is the same kind of reading: a full-screen overlay of everything
 * the camp remembers. Opening it did not pause tickDay, so a player
 * who spent a minute on it came back to a later hour, a colder night,
 * possibly a new dawn.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: tickDay still early-returns for game-over and the intro.
 *    The Bridge pause is a sibling of introOpen — a bridgeOpen()
 *    helper declared in config.js (the first game script), called
 *    from tickDay. ui.js is not touched: it still only opens and
 *    closes the overlay.
 * B. Behaviour on the real page: with The Bridge open, timeOfDay,
 *    days, warmth, and the on-screen time label hold even when a
 *    dawn is seconds away. Close it and that dawn lands. Reverting
 *    the pause fails the named hold assertion.
 *
 * Arrive as a returning camp (hv-intro-seen) so the crash-course
 * pause is not what is holding the clock.
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

(async () => {
  // --- A. source --------------------------------------------------------
  ok(tickAt >= 0 && /function tickDay\(dt\)\{/.test(tick),
     'tickDay is still in gameloop.js — guards the guard');

  ok(/if\(gameOverShown\)\s*return/.test(tick),
     'tickDay still freezes behind game-over');

  const introAt = tick.indexOf('if(introOpen()) return');
  ok(introAt >= 0, 'tickDay still freezes behind the crash course (introOpen)');

  const bridgeCallAt = tick.indexOf('if(bridgeOpen()) return');
  ok(bridgeCallAt > introAt,
     'tickDay also freezes behind The Bridge, via bridgeOpen(), after the intro pause');

  const helper = /function bridgeOpen\(\)\{\s*var m = document\.getElementById\('chain-modal'\);\s*return !!\(m && m\.classList\.contains\('open'\)\);\s*}/.exec(cfg);
  ok(!!helper,
     'bridgeOpen lives in config.js beside introOpen — first script, DOM classList of #chain-modal.open');

  ok(!/function bridgeOpen/.test(ui) && !/function tickDay/.test(ui),
     'ui.js was not given a pause API — it still only opens and closes the overlay');

  ok(!/getElementById\('chain-modal'\)/.test(tick),
     'tickDay itself does not reach into #chain-modal — it asks bridgeOpen()');

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {}
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  // --- B. behaviour -----------------------------------------------------
  const boot = await page.evaluate(() => ({
    intro: !!(document.getElementById('intro-modal') && document.getElementById('intro-modal').classList.contains('open')),
    chain: !!(document.getElementById('chain-modal') && document.getElementById('chain-modal').classList.contains('open')),
    over: !!document.getElementById('hv-gameover'),
    btn: !!document.getElementById('chain-btn'),
    dayMs: typeof DAY_LENGTH_MS === 'number' ? DAY_LENGTH_MS : null,
    tod: G.timeOfDay, days: G.days, warmth: G.warmth,
    helper: typeof bridgeOpen === 'function' && bridgeOpen() === false,
  }));
  ok(!boot.intro && !boot.over && boot.btn && !boot.chain,
     'a returning camp is not behind the crash course or game-over — The Bridge button is free');
  ok(boot.dayMs === 600000,
     `DAY_LENGTH_MS is the ten-minute day this wait is sized against (${boot.dayMs})`);
  ok(boot.helper, 'bridgeOpen() is live on the page and reports closed on boot');

  // Prove the clock is actually running before we open anything, so a
  // suite that froze the whole loop would fail here rather than look
  // like a pause.
  await page.waitForTimeout(2000);
  const running = await page.evaluate(() => G.timeOfDay);
  ok(running > boot.tod,
     `the day is running with The Bridge closed (timeOfDay ${boot.tod} -> ${running})`);

  await page.click('#chain-btn');
  await page.waitForTimeout(400);
  const opened = await page.evaluate(() => ({
    cls: document.getElementById('chain-modal').classList.contains('open'),
    helper: typeof bridgeOpen === 'function' && bridgeOpen() === true,
  }));
  ok(opened.cls && opened.helper,
     'clicking The Bridge opens #chain-modal and bridgeOpen() agrees');

  // Park the sun a few seconds before dawn. Without the pause, the wait
  // below crosses midnight and onNewDay fires — days++, warmth drains.
  // With it, all three hold, and the time label on the bar stays put.
  const parked = await page.evaluate(() => {
    G.timeOfDay = 0.99;
    G.weather = 'clear';
    G.forecast = 'clear';
    const label = document.getElementById('time-label');
    return {
      tod: G.timeOfDay, days: G.days, warmth: G.warmth,
      label: label ? label.textContent : '',
    };
  });
  await page.waitForTimeout(8000);
  const held = await page.evaluate(() => ({
    tod: G.timeOfDay, days: G.days, warmth: G.warmth,
    open: document.getElementById('chain-modal').classList.contains('open'),
    label: document.getElementById('time-label').textContent,
  }));
  ok(held.open && held.tod === parked.tod && held.days === parked.days && held.warmth === parked.warmth,
     `the day is paused behind The Bridge (daylight, warmth and dawn hold while a new morning is seconds away — tod ${parked.tod}->${held.tod}, days ${parked.days}->${held.days}, warmth ${parked.warmth}->${held.warmth})`);
  ok(held.label === parked.label,
     `the on-screen time label holds with the clock ("${parked.label}" -> "${held.label}")`);

  await page.click('#chain-close');
  await page.waitForTimeout(400);
  const closed = await page.$eval('#chain-modal', el => el.classList.contains('open'));
  ok(!closed, 'the close control dismisses The Bridge');

  await page.waitForTimeout(8000);
  const after = await page.evaluate(() => ({
    tod: G.timeOfDay, days: G.days, warmth: G.warmth,
  }));
  ok(after.days === parked.days + 1,
     `closing The Bridge lets the clock run — the dawn that was waiting lands (days ${parked.days} -> ${after.days})`);
  ok(after.warmth !== parked.warmth,
     `and the night's warmth drain lands with it (${parked.warmth} -> ${after.warmth})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
