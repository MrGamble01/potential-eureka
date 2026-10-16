/* HV-73 — the odd job's progress bar never moved.
 *
 * Every action button carries a `.btn-progress` span, and main.js's
 * frame loop fills it as the job runs. That loop walks the fixed
 * ACTIONS table only. The bulletin-board odd job, the mural session,
 * the camp meeting, the deposit run, the busker's set, the newcomer's
 * bed, the bus ticket and the dry corner are appended by buildActionUI
 * outside that table — so a click on any of them pulsed the border red
 * and left the bar at 0% for the whole 6–8 second job. The one action a
 * brand-new camp can take that is NOT in ACTIONS is the odd job, and it
 * is the longest button on the panel.
 *
 *  A. A fixed action (scavenge) still fills its bar — the control.
 *  B. HV-73: the odd job's bar is off 0% while the job runs, and it
 *     climbs between two samples (monotone, not a stuck value).
 *  C. When the job resolves, the bar reads 0% again.
 *  D. A dynamic job that ends WITHOUT a panel rebuild (the ticket's ask
 *     lapsing mid-job, the dry corner refusing a short purse) also
 *     returns to 0% — the reset is not left to buildActionUI.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives doAction with the real timers; reads the bar's
 * inline width the way the player sees it.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };
const pct = s => parseFloat(String(s || '0').replace('%', '')) || 0;

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvprogress-init')) {
      sessionStorage.setItem('hvprogress-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const width = id => page.evaluate(i => {
    const pb = document.getElementById('progress-' + i);
    return pb ? pb.style.width : null;
  }, id);

  // A — control: a fixed ACTIONS button still animates.
  await page.evaluate(() => {
    const bin = dumpsters[0];
    player.position.set(bin.position.x, 0, bin.position.z);
    G.cooldowns = {};
    doAction(ACTIONS.find(a => a.id === 'scavenge'));
  });
  await page.waitForTimeout(1000);
  const scavW = pct(await width('scavenge'));
  ok(scavW > 0, `control: the scavenge bar fills while its job runs (${scavW.toFixed(1)}%)`);

  // B — HV-73: the odd job's bar.
  const started = await page.evaluate(() => {
    G.days = 0; G.oddJobDay = -1;      // day 0 posts the depot job: 8000ms
    buildActionUI();
    doAction(oddJobAction());
    const job = activeJobs.oddjob;
    return { running: !!job, duration: job && job.duration, label: todaysJob().label };
  });
  ok(started.running, `the odd job starts (${started.label}, ${started.duration}ms)`);
  await page.waitForTimeout(1500);
  const odd1 = pct(await width('oddjob'));
  ok(odd1 > 0,
    `HV-73: the odd job's progress bar is off 0% while the job runs (${odd1.toFixed(1)}% at ~1.5s)`);
  await page.waitForTimeout(1500);
  const odd2 = pct(await width('oddjob'));
  ok(odd2 > odd1,
    `and it climbs between samples (${odd1.toFixed(1)}% → ${odd2.toFixed(1)}%)`);
  ok(odd2 < 100, `and it has not already pegged at 100% three seconds into an eight-second job (${odd2.toFixed(1)}%)`);

  // C — the job resolves; the bar is back at zero.
  await page.waitForFunction(() => !activeJobs.oddjob, null, { timeout: 12000 });
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({
    w: (document.getElementById('progress-oddjob') || {}).style ? document.getElementById('progress-oddjob').style.width : null,
    done: oddJobDone(),
    disabled: document.getElementById('action-oddjob').disabled,
  }));
  ok(after.done && after.disabled, `the odd job paid out and closed for the day (done=${after.done}, disabled=${after.disabled})`);
  ok(pct(after.w) === 0, `and its bar reads 0% again (${JSON.stringify(after.w)})`);

  // D — a dynamic job that ends with no panel rebuild still resets.
  // Open the mural (Known+ and 2 scraps), start it, then resolve the job
  // out from under the loop the way a lapsed ask does — activeJobs loses
  // the entry and nothing calls buildActionUI.
  const mural = await page.evaluate(() => {
    G.rep = 30; G.scraps = 5; G.muralDay = -1; G.mural = 0;
    buildActionUI();
    doAction(muralAction());
    return { running: !!activeJobs.mural };
  });
  ok(mural.running, 'the mural session starts');
  await page.waitForTimeout(1000);
  const mur1 = pct(await width('mural'));
  ok(mur1 > 0, `the mural bar fills too (${mur1.toFixed(1)}%)`);
  await page.evaluate(() => { delete activeJobs.mural; });
  await page.waitForTimeout(300);
  const mur2 = pct(await width('mural'));
  ok(mur2 === 0, `a job that ends without a rebuild still drops its bar to 0% (${mur2.toFixed(1)}%)`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
