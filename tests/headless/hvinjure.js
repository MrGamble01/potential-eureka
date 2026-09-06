/* HV-83 — Injury said "the next while" and wore off in 90 seconds.
 *
 * The event card promises: "Moving slowly for the next while."
 * The effect wrote G.injuredUntil = Date.now()+90000. A day is
 * ten minutes. Ninety seconds later Rest and Scavenge were full
 * speed while the day bar still had most of the morning left.
 *
 * Same class as Dumpsters Locked (today vs a minute) and Fire
 * Went Out (overnight vs 30s). #725 is walk speed; #724 is
 * crafts ignoring injury. Neither is the 90s duration.
 *
 * Write-first, hook-free, source-driven.
 *
 * A. The card still says "the next while". The effect stamps
 *    G.injuredDay (not Date.now()+90000). doAction reads the day.
 *    load migrates a missing stamp. ui.js is not touched.
 * B. Mid-day trigger: Rest takes 1.8x. The remaining window is
 *    minutes, not ~90s. Wiping the wall-clock still leaves Rest
 *    slow. A new dawn lifts it.
 *
 * Named assertion: HV-83: Injury lasts the rest of the day, not 90 seconds.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg    = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const loop   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const save   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/save.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui     = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const evAt = loop.indexOf("id:'injury'");
const ev = evAt >= 0 ? loop.slice(evAt, evAt + 700) : '';
const doAt = player.indexOf('function doAction');
const doAct = doAt >= 0 ? player.slice(doAt, doAt + 2200) : '';

(async () => {
  ok(/next while/i.test(ev),
     `the Injury card still promises "the next while" (got ${JSON.stringify((ev.match(/desc:'[^']+'/)||[''])[0])})`);

  ok(!/Date\.now\(\)\s*\+\s*90000/.test(ev),
     'the effect no longer writes a 90-second wall-clock');

  ok(/G\.injuredDay\s*=\s*G\.days/.test(ev),
     'the limp is stamped on today — dawn, not a timer, owns the while');

  ok(/injuredDay/.test(doAct) && /injuredDay===G\.days/.test(doAct.replace(/\s/g,'')),
     'doAction slows actions from injuredDay, not Date.now()+90s');

  ok(/injuredDay:\s*-1/.test(cfg),
     'G defaults injuredDay to -1 — a fresh camp is not limping');

  ok(/typeof G\.injuredDay!=='number'/.test(save),
     'loadGame migrates a pre-HV-83 save that never wrote injuredDay');

  ok(!/injuredDay/.test(ui) && !/id:'injury'/.test(ui),
     'ui.js is not this ticket — it still only shows the event banner');

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

  const boot = await page.evaluate(() => ({
    intro: !!(document.getElementById('intro-modal') && document.getElementById('intro-modal').classList.contains('open')),
    ev: !!(typeof EVENTS_BAD !== 'undefined' && EVENTS_BAD.some(e => e.id === 'injury')),
    day: typeof G.injuredDay === 'number' ? G.injuredDay : null,
    dayLen: typeof DAY_LENGTH_MS === 'number' ? DAY_LENGTH_MS : 0,
    rest: (ACTIONS.find(a => a.id === 'rest') || {}).time,
  }));
  ok(!boot.intro && boot.ev,
     'a returning camp can fire Injury — not behind the crash course');
  ok(boot.day === -1 && boot.dayLen === 600000 && boot.rest === 3000,
     `a fresh camp is not limping (injuredDay ${boot.day}, Rest ${boot.rest}ms)`);

  const mid = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'injury');
    const rest = ACTIONS.find(a => a.id === 'rest');
    const real = Math.random;
    Math.random = () => 0;
    G.days = 4;
    G.timeOfDay = 0.5;
    G.cooldowns = {};
    delete activeJobs.rest;
    const t0 = Date.now();
    ev.effect();
    Math.random = real;
    const remaining = G.injuredUntil ? G.injuredUntil - t0 : 0;
    doAction(rest);
    const dur = activeJobs.rest ? activeJobs.rest.duration : 0;
    delete activeJobs.rest;
    const btn = document.getElementById('action-rest');
    if (btn) { btn.classList.remove('active-job'); btn.disabled = false; }
    return {
      remaining, lockDay: G.injuredDay, days: G.days,
      dur, restTime: rest.time,
    };
  });
  ok(mid.lockDay === 4,
     `the limp is stamped on today (injuredDay ${mid.lockDay})`);
  ok(mid.dur === Math.floor(mid.restTime * 1.8) || mid.dur === mid.restTime * 1.8,
     `Rest is 1.8x while injured (dur ${mid.dur}, rest ${mid.restTime})`);
  ok(mid.remaining > 240000 && mid.remaining <= 300000,
     `HV-83: Injury lasts the rest of the day, not 90 seconds (remaining ${mid.remaining}ms)`);

  const wiped = await page.evaluate(() => {
    const rest = ACTIONS.find(a => a.id === 'rest');
    G.injuredUntil = 0;
    G.cooldowns = {};
    delete activeJobs.rest;
    doAction(rest);
    const dur = activeJobs.rest ? activeJobs.rest.duration : 0;
    delete activeJobs.rest;
    const btn = document.getElementById('action-rest');
    if (btn) { btn.classList.remove('active-job'); btn.disabled = false; }
    return { dur, restTime: rest.time, lockDay: G.injuredDay };
  });
  ok(wiped.dur === wiped.restTime * 1.8,
     `wiping the wall-clock still leaves Rest slow (dur ${wiped.dur})`);

  const dawn = await page.evaluate(() => {
    const rest = ACTIONS.find(a => a.id === 'rest');
    G.days = (G.days || 0) + 1;
    G.cooldowns = {};
    delete activeJobs.rest;
    doAction(rest);
    const dur = activeJobs.rest ? activeJobs.rest.duration : 0;
    delete activeJobs.rest;
    const btn = document.getElementById('action-rest');
    if (btn) { btn.classList.remove('active-job'); btn.disabled = false; }
    return { dur, restTime: rest.time, days: G.days, lockDay: G.injuredDay };
  });
  ok(dawn.dur === dawn.restTime,
     `a new dawn lifts the limp — Rest is full speed (dur ${dawn.dur}, day ${dawn.days})`);

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
