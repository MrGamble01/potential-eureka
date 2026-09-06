/*
 * HV-8 — the bulletin board (re-runnable: classic scripts, globals
 * reachable, save cleared on first load).
 *  A. The board button renders with today's posting (day-rotation formula).
 *  B. Completing the job pays the exact posted amounts and closes the day.
 *  C. A second attempt is refused; the button is disabled with a ✓.
 *  D. The next dawn re-opens the board with the NEXT job in the rotation.
 *  E. Job payouts with morale clamp at 100.
 *  F. oddJobDay persists; a pre-HV-8 save migrates to -1.
 *  Z. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvo-init')) {
      sessionStorage.setItem('hvo-init', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  // A. board renders today's posting
  const board = await t(() => {
    G.days = 3;                     // day 3 → ODD_JOBS[3] (scrapyard)
    buildActionUI();
    const btn = document.getElementById('action-oddjob');
    return { label: btn.textContent, disabled: btn.disabled, job: todaysJob().id };
  });
  ok(board.job === 'scrapyd' && board.label.includes('Sort at the scrapyard') && !board.disabled,
    `day 3 posts the scrapyard job (${board.job})`);

  // B. exact payout
  const paid = await t(() => {
    G.scraps = 0; G.cans = 0;
    finishAction(oddJobAction());
    return { scraps: G.scraps, cans: G.cans, day: G.oddJobDay,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' ') };
  });
  ok(paid.scraps === 5 && paid.cans === 2 && paid.day === 3, `scrapyard pays +5 scraps +2 cans (${paid.scraps}/${paid.cans})`);
  ok(paid.log.includes('Odd job done'), 'the payout is logged');

  // C. once per day
  const again = await t(() => {
    const before = G.scraps;
    doAction(oddJobAction());
    const btn = document.getElementById('action-oddjob');
    return { scraps: G.scraps, before, disabled: btn.disabled, check: btn.textContent.includes('✓'),
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' ') };
  });
  ok(again.scraps === again.before && again.log.includes('done — check the board tomorrow'), 'a second attempt is refused');
  ok(again.disabled && again.check, 'the button reads done ✓');

  // D. dawn rotation (suppress events; day 4 → dogwalk)
  const dawn = await t(() => {
    G.lastEventDay = G.days + 5; G.forecast = 'clear'; G.food = 50; G.dog = 0;
    onNewDay();
    const btn = document.getElementById('action-oddjob');
    return { day: G.days, job: todaysJob().id, disabled: btn.disabled, label: btn.textContent };
  });
  ok(dawn.day === 4 && dawn.job === 'dogwalk' && !dawn.disabled,
    `next dawn posts the next job (${dawn.job}), board open again`);

  // E. morale clamp (dogwalk gives +6 morale)
  const clamp = await t(() => {
    G.morale = 97; G.goodwill = 0;
    finishAction(oddJobAction());
    return { morale: G.morale, goodwill: G.goodwill };
  });
  ok(clamp.morale === 100 && clamp.goodwill === 2, `dogwalk: morale clamps at 100, +2 goodwill lands`);

  // F. persistence + migration
  await t(() => saveGame());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const back = await t(() => ({ day: G.oddJobDay, disabled: document.getElementById('action-oddjob').disabled }));
  ok(back.day === 4 && back.disabled, 'reload keeps today-done state');
  await t(() => {
    const s = JSON.parse(localStorage.getItem('homeless_village_v1'));
    delete s.oddJobDay;
    localStorage.setItem('homeless_village_v1', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const legacy = await t(() => ({ day: G.oddJobDay, open: !document.getElementById('action-oddjob').disabled }));
  ok(legacy.day === -1 && legacy.open, 'pre-HV-8 save migrates with the board open');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
