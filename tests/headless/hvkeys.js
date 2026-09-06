/* HV-64 — Keys in Hand pauses the day clock.
 *
 * HV-56 / HV-59 paused tickDay behind the crash course and The Bridge
 * so reading does not cost daylight. Keys in Hand (#hv-graduation) is
 * the same kind of reading: a full-screen ending card. Opening it did
 * not pause tickDay, so a player who sat with Dena's keys came back
 * to a later hour, a colder night, possibly a new dawn counted on
 * the day they had just finished.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: tickDay still early-returns for game-over, the intro and
 *    The Bridge. The Keys pause is a sibling of those — a keysOpen()
 *    helper declared in config.js (the first game script), called
 *    from tickDay. ui.js is not touched: it still only builds and
 *    dismisses the card.
 * B. Behaviour on the real page: with Keys in Hand up, timeOfDay,
 *    days, warmth, and the on-screen time label hold even when a
 *    dawn is seconds away. Keep Building and that dawn lands.
 *    Reverting the pause fails the named hold.
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
const tick = tickAt >= 0 ? loop.slice(tickAt, tickAt + 2800) : '';

(async () => {
  // --- A. source --------------------------------------------------------
  ok(tickAt >= 0 && /function tickDay\(dt\)\{/.test(tick),
     'tickDay is still in gameloop.js — guards the guard');

  ok(/if\(gameOverShown\)\s*return/.test(tick),
     'tickDay still freezes behind game-over');

  const introAt = tick.indexOf('if(introOpen()) return');
  const bridgeAt = tick.indexOf('if(bridgeOpen()) return');
  ok(introAt >= 0, 'tickDay still freezes behind the crash course (introOpen)');
  ok(bridgeAt > introAt, 'tickDay still freezes behind The Bridge (bridgeOpen)');

  const keysCallAt = tick.indexOf('if(keysOpen()) return');
  ok(keysCallAt > bridgeAt,
     'tickDay also freezes behind Keys in Hand, via keysOpen(), after the Bridge pause');

  const helper = /function keysOpen\(\)\{\s*return !!document\.getElementById\('hv-graduation'\);\s*}/.exec(cfg);
  ok(!!helper,
     'keysOpen lives in config.js beside introOpen / bridgeOpen — DOM existence of #hv-graduation');

  ok(!/function keysOpen/.test(ui) && !/function tickDay/.test(ui),
     'ui.js was not given a pause API — it still only builds and dismisses the card');

  ok(!/getElementById\('hv-graduation'\)/.test(tick),
     'tickDay itself does not reach into #hv-graduation — it asks keysOpen()');

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
    over: !!document.getElementById('hv-gameover'),
    card: !!document.getElementById('hv-graduation'),
    dayMs: typeof DAY_LENGTH_MS === 'number' ? DAY_LENGTH_MS : null,
    tod: G.timeOfDay, days: G.days, warmth: G.warmth,
    helper: typeof keysOpen === 'function' && keysOpen() === false,
    show: typeof showGraduation === 'function',
  }));
  ok(!boot.intro && !boot.over && !boot.card && boot.show,
     'a returning camp is not behind the crash course, game-over, or Keys in Hand');
  ok(boot.dayMs === 600000,
     `DAY_LENGTH_MS is the ten-minute day this wait is sized against (${boot.dayMs})`);
  ok(boot.helper, 'keysOpen() is live on the page and reports closed on boot');

  await page.waitForTimeout(2000);
  const running = await page.evaluate(() => G.timeOfDay);
  ok(running > boot.tod,
     `the day is running with Keys in Hand down (timeOfDay ${boot.tod} -> ${running})`);

  await page.evaluate(() => { showGraduation(); });
  await page.waitForTimeout(400);
  const opened = await page.evaluate(() => ({
    card: !!document.getElementById('hv-graduation'),
    helper: typeof keysOpen === 'function' && keysOpen() === true,
  }));
  ok(opened.card && opened.helper,
     'showGraduation() puts #hv-graduation on the page and keysOpen() agrees');

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
    card: !!document.getElementById('hv-graduation'),
    label: document.getElementById('time-label').textContent,
  }));
  ok(held.card && held.tod === parked.tod && held.days === parked.days && held.warmth === parked.warmth,
     `the day is paused behind Keys in Hand (daylight, warmth and dawn hold while a new morning is seconds away — tod ${parked.tod}->${held.tod}, days ${parked.days}->${held.days}, warmth ${parked.warmth}->${held.warmth})`);
  ok(held.label === parked.label,
     `the on-screen time label holds with the clock ("${parked.label}" -> "${held.label}")`);

  await page.click('#hv-grad-stay');
  await page.waitForTimeout(400);
  const closed = await page.evaluate(() => ({
    card: !!document.getElementById('hv-graduation'),
    helper: typeof keysOpen === 'function' && keysOpen() === false,
    done: !!G.arcDone,
  }));
  ok(!closed.card && closed.helper && closed.done,
     'Keep Building dismisses Keys in Hand, keysOpen() agrees, and the sandbox is marked');

  await page.waitForTimeout(8000);
  const after = await page.evaluate(() => ({
    tod: G.timeOfDay, days: G.days, warmth: G.warmth,
  }));
  ok(after.days === parked.days + 1,
     `Keep Building lets the clock run — the dawn that was waiting lands (days ${parked.days} -> ${after.days})`);
  ok(after.warmth !== parked.warmth,
     `and the night's warmth drain lands with it (${parked.warmth} -> ${after.warmth})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
