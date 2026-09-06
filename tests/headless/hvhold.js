/*
 * HV-114 — Lookout said sweep in ~30 seconds, then The Bridge
 * didn't hold the trucks.
 *
 * HV-59 paused tickDay behind #chain-modal so reading The Bridge
 * does not burn daylight. The Lookout's warning is a different
 * clock: maybeEvent armed a wall-clock delay, then startSweep
 * still fired while the overlay was open. The log said ~30
 * seconds. The trucks did not wait.
 *
 *  A. Source: the Lookout / Biscuit branches arm a hold, not a
 *     wall-clock delay. tickDay ticks that hold before it returns
 *     for The Bridge. ui.js is untouched.
 *  B. Live: a Lookout warning, then The Bridge open for longer
 *     than the promised window — the sweep stays off-stage.
 *  C. Close The Bridge and the same window later, the trucks land.
 *  D. Biscuit's shorter window is still the hold, not a separate
 *     clock. Kind Stranger is still a food drop, not a sweep.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives maybeEvent() and the real #chain-btn.
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

const maybeAt = loop.indexOf('function maybeEvent(){');
const maybe = maybeAt >= 0 ? loop.slice(maybeAt, maybeAt + 2200) : '';
const lookAt = maybe.indexOf('if(G.workers.lookout)');
const dogAt  = maybe.indexOf('else if(G.dog===2)');
const elseAt = maybe.indexOf('} else {');
const look = lookAt >= 0 && dogAt > lookAt ? maybe.slice(lookAt, dogAt) : '';
const dog  = dogAt >= 0 && elseAt > dogAt ? maybe.slice(dogAt, elseAt) : '';

const tickAt = loop.indexOf('function tickDay(dt){');
const tick = tickAt >= 0 ? loop.slice(tickAt, tickAt + 900) : '';
const holdAt = loop.indexOf('function tickSweepHold');
const hold = holdAt >= 0 ? loop.slice(holdAt, holdAt + 900) : '';
const trigAt = loop.indexOf('function triggerEvent');
const trig = trigAt >= 0 ? loop.slice(trigAt, trigAt + 280) : '';

// --- A. source --------------------------------------------------------
ok(maybeAt >= 0 && look.length > 0 && dog.length > 0,
   'maybeEvent still has the Lookout branch and the Biscuit branch');

ok(/armSweepHold\s*\(\s*30000\s*\)/.test(look) && !/setTimeout/.test(look),
   'Lookout arms a 30s hold — the trucks are not on a wall-clock delay');

ok(/armSweepHold\s*\(\s*15000\s*\)/.test(dog) && !/setTimeout/.test(dog),
   'Biscuit arms a 15s hold — half the Lookout window, same clock');

ok(/LOOKOUT: Police activity nearby\. Sweep in ~30 seconds!/.test(look),
   'the Lookout log still promises ~30 seconds');

ok(tickAt >= 0 && /tickSweepHold\s*\(\s*dt\s*\)/.test(tick),
   'tickDay ticks the hold — the pause can see it while The Bridge is open');

const holdCallAt = tick.indexOf('tickSweepHold(dt)');
const introAt = tick.indexOf('if(introOpen()) return');
const bridgeAt = tick.indexOf('if(bridgeOpen()) return');
ok(holdCallAt >= 0 && holdCallAt < introAt && introAt < bridgeAt,
   'the hold ticks before the intro and Bridge returns — HV-59 still pauses the day');

ok(holdAt >= 0 && /introOpen\s*\(\s*\)/.test(hold) && /bridgeOpen\s*\(\s*\)/.test(hold),
   'tickSweepHold waits while the crash course or The Bridge is open');

ok(/sweepHoldArmed\s*=\s*false/.test(trig),
   'triggerEvent disarms the hold so a landed card cannot fire twice');

ok(!/armSweepHold/.test(ui) && !/tickSweepHold/.test(ui) && !/sweepHoldArmed/.test(ui),
   'ui.js was not given the hold — it still only paints the warning');

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
    if (!sessionStorage.getItem('hvhold-init')) {
      sessionStorage.setItem('hvhold-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // --- B. Lookout warning, then The Bridge holds the trucks ------------
  const armed = await t(() => {
    const real = Math.random;
    Math.random = () => 0.1;
    G.days = 5; G.lastEventDay = 0;
    G.workers.lookout = true; G.dog = 0;
    G.sweepWarned = false; G.packedUp = false;
    G.goalIndex = GOALS.length;
    const swept = G.timesSwept;
    maybeEvent();
    Math.random = real;
    return {
      warned: G.sweepWarned,
      swept: G.timesSwept - swept,
      visible: document.getElementById('sweep-warning').style.display === 'block',
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
      intro: !!(document.getElementById('intro-modal') && document.getElementById('intro-modal').classList.contains('open')),
    };
  });
  ok(armed.warned && armed.swept === 0 && armed.visible && !armed.intro,
     'Lookout warns — the sweep is staged, not instant');
  ok(/Sweep in ~30 seconds/.test(armed.log),
     'the on-screen log still names the ~30 second window');

  await page.click('#chain-btn');
  await page.waitForTimeout(400);
  const opened = await t(() => ({
    cls: document.getElementById('chain-modal').classList.contains('open'),
    helper: typeof bridgeOpen === 'function' && bridgeOpen() === true,
  }));
  ok(opened.cls && opened.helper,
     'clicking The Bridge opens #chain-modal and bridgeOpen() agrees');

  await page.waitForTimeout(32000);
  const held = await t(() => ({
    open: document.getElementById('chain-modal').classList.contains('open'),
    warned: G.sweepWarned,
    swept: G.timesSwept,
    banner: document.getElementById('ev-title').textContent,
    visible: document.getElementById('sweep-warning').style.display === 'block',
    eta: (document.getElementById('sweep-eta') || {}).textContent || '',
  }));
  ok(held.open && held.warned && held.swept === 0 && held.visible && held.banner !== 'City Sweep',
     `The Bridge holds the trucks past the promised window (swept ${held.swept}, banner "${held.banner}", eta ${held.eta})`);

  // --- C. close The Bridge — the same window later, they land ----------
  await page.click('#chain-close');
  await page.waitForTimeout(400);
  const closed = await page.$eval('#chain-modal', el => el.classList.contains('open'));
  ok(!closed, 'the close control dismisses The Bridge');

  await page.waitForTimeout(32000);
  const landed = await t(() => ({
    swept: G.timesSwept,
    banner: document.getElementById('ev-title').textContent,
    warned: G.sweepWarned,
    visible: document.getElementById('sweep-warning').style.display === 'block',
  }));
  ok(landed.swept >= 1 && landed.banner === 'City Sweep' && !landed.warned,
     `closing The Bridge lets the hold run — the sweep lands (swept ${landed.swept}, banner "${landed.banner}")`);

  // --- D. Biscuit still uses the hold; Kind Stranger is not a sweep ----
  const biscuit = await t(() => {
    const real = Math.random;
    Math.random = () => 0.1;
    G.workers.lookout = false; G.dog = 2;
    G.sweepWarned = false; G.packedUp = false;
    const swept = G.timesSwept;
    maybeEvent();
    Math.random = real;
    const out = {
      warned: G.sweepWarned,
      swept: G.timesSwept - swept,
      visible: document.getElementById('sweep-warning').style.display === 'block',
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
    G.sweepWarned = false;
    if (typeof showSweepWarning === 'function') showSweepWarning(false);
    return out;
  });
  ok(biscuit.warned && biscuit.swept === 0 && biscuit.visible,
     'no Lookout: Biscuit still warns instead of an instant sweep');
  ok(/Biscuit will not stop barking/.test(biscuit.log),
     'the warning is still the dog barking');

  const stranger = await t(() => {
    const ev = EVENTS_GOOD.find(e => e.id === 'kind_stranger');
    const real = Math.random;
    Math.random = () => 0.5;
    G.goodwill = 10; G.food = 0; G.timesSwept = 0;
    triggerEvent(ev, true);
    Math.random = real;
    return { goodwill: G.goodwill, food: G.food, swept: G.timesSwept, banner: document.getElementById('ev-title').textContent };
  });
  ok(stranger.goodwill === 10 && stranger.food > 0 && stranger.swept === 0 && stranger.banner === 'Kind Stranger',
     `Kind Stranger is still a food drop, not a sweep (food=${stranger.food})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
