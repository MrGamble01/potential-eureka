/*
 * HV-112 — Dumpsters Locked greyed the bins, and Forage Area
 * still looked open.
 *
 * HV-63 stamped the day so Scavenge and Forage both refuse:
 * "Dumpsters are locked today." updateScavengeGate paints the
 * 🗑️ button dashed and dim. Forage Area stays gold. Hover it
 * and it still offers cardboard and wood. Click it and the log
 * admits the woods are closed. The paint never heard the lock.
 *
 *  A. Source: updateScavengeGate paints #action-forage on a lock day.
 *  B. Stood on a bin, the lock dims Forage Area — not a walk-up grey.
 *  C. Scavenge is locked-today too (not a 🚶 while you stand on it).
 *  D. A click still refuses — the day stamp is still the lock.
 *  E. Isolation: a new dawn lifts the paint; the 3.2 walk-up stays;
 *     forage still searches for cardboard and wood when the bins open.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives dumpster_locked.effect + updateScavengeGate + doAction.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'homeless-village/css/game.css'), 'utf8');

const gate = /function updateScavengeGate\([\s\S]*?\n\}/.exec(player);
ok(!!gate, 'updateScavengeGate is still in player.js — guards the paint');
ok(gate && /action-forage/.test(gate[0]),
  'HV-112: updateScavengeGate paints Forage Area when the bins are locked');
ok(gate && /locked-today/.test(gate[0]),
  'the lock paint is locked-today — not a walk-up grey on the woods');
ok(/\.action-btn\.locked-today/.test(css),
  'game.css knows locked-today — ui.js is not this ticket');
ok(!/homeless-village\/js\/ui\.js/.test(player) && !/function buildActionUI/.test(player),
  'the paint lives in player.js — ui.js is not this ticket');

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
    try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {}
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const locked = await page.evaluate(() => {
    const bin = dumpsters[0];
    player.position.set(bin.position.x, 0, bin.position.z);
    G.cooldowns = {};
    delete activeJobs.scavenge;
    delete activeJobs.forage;
    const ev = EVENTS_BAD.find(e => e.id === 'dumpster_locked');
    ev.effect();
    updateScavengeGate();
    const scav = document.getElementById('action-scavenge');
    const forage = document.getElementById('action-forage');
    doAction(ACTIONS.find(a => a.id === 'forage'));
    const forageStarted = !!activeJobs.forage;
    delete activeJobs.forage;
    return {
      days: G.days,
      lockDay: G.dumpsterLockDay,
      forageCls: forage ? forage.className : '',
      forageTip: forage ? forage.getAttribute('data-tip') : '',
      forageTitle: forage ? forage.title : '',
      scavCls: scav ? scav.className : '',
      forageStarted,
      inRange: scavengeInRange(),
    };
  });

  ok(locked.lockDay === locked.days && locked.inRange,
    `stood on a bin on a lock day (lockDay ${locked.lockDay}, inRange ${locked.inRange})`);
  ok(/\blocked-today\b/.test(locked.forageCls),
    `Forage Area reads locked-today — not gold (${locked.forageCls})`);
  ok(/\blocked-today\b/.test(locked.scavCls) && !/\bout-of-range\b/.test(locked.scavCls),
    `Scavenge is locked-today too, not a 🚶 on the bin (${locked.scavCls})`);
  ok(/locked today/i.test(locked.forageTitle),
    `Forage Area's title admits the lock (${locked.forageTitle})`);
  ok(!locked.forageStarted,
    'a click still refuses — the day stamp is still the lock');

  const open = await page.evaluate(() => {
    G.dumpsterLockDay = -1;
    updateScavengeGate();
    const forage = document.getElementById('action-forage');
    const scav = document.getElementById('action-scavenge');
    G.cooldowns = {};
    delete activeJobs.forage;
    doAction(ACTIONS.find(a => a.id === 'forage'));
    const forageStarted = !!activeJobs.forage;
    delete activeJobs.forage;
    return {
      forageCls: forage ? forage.className : '',
      scavCls: scav ? scav.className : '',
      forageStarted,
      range: SCAVENGE_RANGE,
    };
  });
  ok(!/\blocked-today\b/.test(open.forageCls) && !/\blocked-today\b/.test(open.scavCls),
    'lifting the lock lifts the paint on both buttons');
  ok(open.forageStarted,
    'an open morning still starts a forage');
  ok(open.range === 3.2,
    'the 3.2 walk-up on the bins stays where it was');

  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
