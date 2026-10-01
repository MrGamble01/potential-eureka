/* HV-63 — Dumpsters Locked said "today" and lasted a minute.
 *
 * The event card promises: "Nothing to scavenge today."
 * The effect wrote a 60s scavenge cooldown and a 45s forage
 * cooldown. A 10-minute day then unlocked the bins while the
 * card was still the last thing the player read.
 *
 *  A. The card still says today — that is the promise under test.
 *  B. After the lock lands, wiping the short cooldown still cannot
 *     start a scavenge (or a forage). The lock is the day, not a timer.
 *  C. A new dawn lifts it — scavenge starts again from the same bin.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives EVENTS_BAD.dumpster_locked.effect and doAction.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvlock-init')) {
      sessionStorage.setItem('hvlock-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  // A — the card's promise
  const card = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'dumpster_locked');
    return { title: ev && ev.title, desc: ev && ev.desc };
  });
  ok(card && /today/i.test(card.desc),
    `the Dumpsters Locked card promises "today" (got ${JSON.stringify(card && card.desc)})`);

  // Stand on a bin so the proximity gate is not the thing under test.
  const locked = await page.evaluate(() => {
    const bin = dumpsters[0];
    player.position.set(bin.position.x, 0, bin.position.z);
    G.cooldowns = {};
    delete activeJobs.scavenge;
    delete activeJobs.forage;
    const ev = EVENTS_BAD.find(e => e.id === 'dumpster_locked');
    const t0 = Date.now();
    ev.effect();
    const cdScav = G.cooldowns.scavenge ? G.cooldowns.scavenge - t0 : 0;
    const cdFor = G.cooldowns.forage ? G.cooldowns.forage - t0 : 0;
    // The tell of the old bug: wipe the minute timer. If the lock was
    // only that timer, both actions start. If the lock is the day, they
    // stay refused.
    G.cooldowns = {};
    doAction(ACTIONS.find(a => a.id === 'scavenge'));
    const scavStarted = !!activeJobs.scavenge;
    delete activeJobs.scavenge;
    doAction(ACTIONS.find(a => a.id === 'forage'));
    const forStarted = !!activeJobs.forage;
    delete activeJobs.forage;
    return {
      days: G.days,
      lockDay: G.dumpsterLockDay,
      cdScav, cdFor,
      scavStarted, forStarted,
    };
  });
  ok(!locked.scavStarted,
    `after the lock, wiping the short cooldown still cannot start a scavenge (started=${locked.scavStarted}, lockDay=${locked.lockDay}, was ${locked.cdScav}ms)`);
  ok(!locked.forStarted,
    `and cannot start a forage either (started=${locked.forStarted}, was ${locked.cdFor}ms)`);
  ok(locked.lockDay === locked.days,
    `the lock is stamped on today's day (${locked.lockDay} === ${locked.days})`);

  // C — dawn lifts it
  const dawn = await page.evaluate(() => {
    G.days = (G.days || 0) + 1;
    G.cooldowns = {};
    delete activeJobs.scavenge;
    const bin = dumpsters[0];
    player.position.set(bin.position.x, 0, bin.position.z);
    doAction(ACTIONS.find(a => a.id === 'scavenge'));
    const started = !!activeJobs.scavenge;
    delete activeJobs.scavenge;
    return { started, days: G.days, lockDay: G.dumpsterLockDay };
  });
  ok(dawn.started,
    `a new dawn lifts the lock — scavenge starts again (day ${dawn.days}, lockDay ${dawn.lockDay})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
