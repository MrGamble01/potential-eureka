/* HV-59 — The Bridge pauses the day.
 *
 * HV-56 paused tickDay behind the first-run crash course so reading
 * how the camp works does not cost daylight. The Bridge (#chain-modal)
 * is the same kind of reading: a full-screen overlay of everything
 * the camp remembers. Opening it did not pause tickDay, so a player
 * who spent a minute on it came back to a later hour, a colder night,
 * possibly a new dawn — the same class of miss, now on the memory
 * overlay.
 *
 * This suite has two jobs, and the second is the one that earns its keep.
 *
 * A. Source: tickDay still early-returns for game-over and the intro,
 *    and now also for #chain-modal.open. A DOM classList read in
 *    gameloop.js — no new API in ui.js, no window.__ hook.
 * B. Behaviour, driven through the real page: with The Bridge open,
 *    timeOfDay, days and warmth hold still even when a dawn is
 *    seconds away. Close it and that dawn lands. Reverting the pause
 *    fails the named hold assertion.
 *
 * Arrive as a returning camp (hv-intro-seen) so the crash-course
 * pause is not what is holding the clock. Same load as the other hv*
 * suites: homeless-village.html, classic-script globals, no hook.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const tickAt = loop.indexOf('function tickDay(dt){');
const tick = tickAt >= 0 ? loop.slice(tickAt, tickAt + 2200) : '';

(async () => {
  // --- A. source --------------------------------------------------------
  ok(tickAt >= 0 && /function tickDay\(dt\)\{/.test(tick),
     'tickDay is still in gameloop.js — guards the guard');

  ok(/if\(gameOverShown\)\s*return/.test(tick),
     'tickDay still freezes behind game-over');

  const introAt = tick.indexOf('if(introOpen()) return');
  ok(introAt >= 0, 'tickDay still freezes behind the crash course (introOpen)');

  const chainAt = tick.indexOf("getElementById('chain-modal')");
  ok(chainAt > introAt,
     'the Bridge pause sits in tickDay after the intro pause, as a getElementById of chain-modal');
  ok(chainAt >= 0 && /classList\.contains\(\s*['"]open['"]\s*\)/.test(tick.slice(chainAt, chainAt + 220)),
     'it is a DOM classList read of #chain-modal.open — no ui.js API');

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
  }));
  ok(!boot.intro && !boot.over && boot.btn && !boot.chain,
     'a returning camp is not behind the crash course or game-over — The Bridge button is free');
  ok(boot.dayMs === 600000,
     `DAY_LENGTH_MS is the ten-minute day this wait is sized against (${boot.dayMs})`);

  // Prove the clock is actually running before we open anything, so a
  // suite that froze the whole loop would fail here rather than look
  // like a pause.
  await page.waitForTimeout(2000);
  const running = await page.evaluate(() => G.timeOfDay);
  ok(running > boot.tod,
     `the day is running with The Bridge closed (timeOfDay ${boot.tod} -> ${running})`);

  await page.click('#chain-btn');
  await page.waitForTimeout(400);
  const opened = await page.$eval('#chain-modal', el => el.classList.contains('open')).catch(() => false);
  ok(opened, 'clicking The Bridge opens #chain-modal');

  // Park the sun a few seconds before dawn. Without the pause, the wait
  // below crosses midnight and onNewDay fires — days++, warmth drains.
  // With it, all three hold. That is the named assertion reverting the
  // pause fails.
  const parked = await page.evaluate(() => {
    G.timeOfDay = 0.99;
    G.weather = 'clear';
    G.forecast = 'clear';
    return { tod: G.timeOfDay, days: G.days, warmth: G.warmth };
  });
  await page.waitForTimeout(8000);
  const held = await page.evaluate(() => ({
    tod: G.timeOfDay, days: G.days, warmth: G.warmth,
    open: document.getElementById('chain-modal').classList.contains('open'),
  }));
  ok(held.open && held.tod === parked.tod && held.days === parked.days && held.warmth === parked.warmth,
     `the day is paused behind The Bridge (daylight, warmth and dawn hold while a new morning is seconds away — tod ${parked.tod}->${held.tod}, days ${parked.days}->${held.days}, warmth ${parked.warmth}->${held.warmth})`);

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
