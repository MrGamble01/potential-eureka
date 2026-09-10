/* HV-275 — a cold morning said the cold gets into everything,
 * then Borrow from Ray still fronted a summer stake.
 *
 * Dawn names it: "The cold gets into everything." Old Ray
 * holds the bench by the bridge and fronts 4 goodwill on the
 * spot. A Cold Snap sky already thins the corner (pan 0.75).
 * The bench never emptied. A pinned cold morning still handed
 * over +4 and booked 5 owed.
 *
 * #739 is the mid-debt lock. #813 is Rest nearby. #823 is
 * busk × the named snap. This is the cold sky at Ray's bench.
 *
 *  A. Source: dawn still says the cold gets into everything.
 *     Borrow still promises 4 on the spot against 5 owed.
 *  B. Source: doAction refuses borrow on weather==='cold'
 *     before setTimeout. ui.js does not.
 *  C. Live: a cold doAction starts no job, pays nothing,
 *     and names the cold. The old 2s timer still pays nothing.
 *  D. finishAction on a cold sky also pays nothing.
 *  E. A clear front still pays +4 / books 5.
 *  F. Heat, rain, and a named snap under a clear sky still
 *     pay +4 / 5 — not this ticket.
 *  G. Mid-debt still refuses a second loan.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production borrow path.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const doAt = player.indexOf('function doAction(a){');
const finishAt = player.indexOf('function finishAction(a){');
const doBlock = doAt >= 0 && finishAt > doAt ? player.slice(doAt, finishAt) : '';
const timeoutAt = doBlock.indexOf('setTimeout');
const borrowAt = doBlock.indexOf("a.id==='borrow'");
const borrowGate = borrowAt >= 0 && timeoutAt > borrowAt ? doBlock.slice(borrowAt, timeoutAt) : '';

ok(/The cold gets into everything/.test(loop)
  && /BORROW_AMT\s*=\s*4/.test(cfg)
  && /BORROW_OWED\s*=\s*5/.test(cfg)
  && /fronts 4 goodwill on the spot/.test(cfg),
  'dawn still says the cold gets into everything; Ray still fronts 4 against 5');
ok(borrowGate && /weather\s*===\s*'cold'/.test(borrowGate),
  'HV-275: doAction refuses Borrow on a cold sky before the timer');
ok(!/borrow/.test(ui) && !/weather\s*===\s*'cold'/.test(ui),
  'ui.js untouched — the refuse lives in doAction');

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
    if (!sessionStorage.getItem('hvraycold-init')) {
      sessionStorage.setItem('hvraycold-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const coldClick = await page.evaluate(() => {
    delete activeJobs.borrow;
    G.cooldowns.borrow = 0;
    G.weather = 'cold';
    G.rayDebt = 0;
    G.goodwill = 10;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    const a = ACTIONS.find(x => x.id === 'borrow');
    doAction(a);
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      job: !!activeJobs.borrow,
      gw: G.goodwill,
      debt: G.rayDebt || 0,
      named: /cold/i.test(log) && /Ray|bench|ledger|gone/i.test(log),
    };
  });
  ok(!coldClick.job && coldClick.gw === 10 && coldClick.debt === 0,
    `HV-275: a cold Borrow starts no job (job=${coldClick.job}, gw=${coldClick.gw}, debt=${coldClick.debt})`);
  ok(coldClick.named, 'the log names Ray gone in from the cold');

  await page.waitForTimeout(2500);
  const afterTimer = await page.evaluate(() => ({
    job: !!activeJobs.borrow,
    gw: G.goodwill,
    debt: G.rayDebt || 0,
  }));
  ok(!afterTimer.job && afterTimer.gw === 10 && afterTimer.debt === 0,
    `the old 2s timer still pays nothing (gw=${afterTimer.gw}, debt=${afterTimer.debt})`);

  const finishCold = await page.evaluate(() => {
    G.weather = 'cold';
    G.rayDebt = 0;
    G.goodwill = 10;
    finishAction({ id: 'borrow' });
    return { gw: G.goodwill, debt: G.rayDebt || 0 };
  });
  ok(finishCold.gw === 10 && finishCold.debt === 0,
    `finishAction on a cold sky also pays nothing (gw=${finishCold.gw}, debt=${finishCold.debt})`);

  const clear = await page.evaluate(() => {
    G.weather = 'clear';
    G.rayDebt = 0;
    G.goodwill = 10;
    G.regulars = { marisol: 0, ray: 0, dee: 0 };
    finishAction({ id: 'borrow' });
    return { gw: G.goodwill, debt: G.rayDebt || 0 };
  });
  ok(clear.gw === 14 && clear.debt === 5,
    `a clear front still pays +4 / books 5 (gw=${clear.gw}, debt=${clear.debt})`);

  const heat = await page.evaluate(() => {
    G.weather = 'heat';
    G.rayDebt = 0;
    G.goodwill = 10;
    finishAction({ id: 'borrow' });
    return { gw: G.goodwill, debt: G.rayDebt || 0 };
  });
  ok(heat.gw === 14 && heat.debt === 5,
    `a scorcher still fronts +4 (heat is not this ticket, gw=${heat.gw})`);

  const rain = await page.evaluate(() => {
    G.weather = 'rain';
    G.rayDebt = 0;
    G.goodwill = 10;
    finishAction({ id: 'borrow' });
    return { gw: G.goodwill, debt: G.rayDebt || 0 };
  });
  ok(rain.gw === 14 && rain.debt === 5,
    `a rainy bench still fronts +4 (rain is not this ticket, gw=${rain.gw})`);

  const snap = await page.evaluate(() => {
    G.weather = 'clear';
    G.snapUntil = G.days + 9;
    G.rayDebt = 0;
    G.goodwill = 10;
    finishAction({ id: 'borrow' });
    G.snapUntil = null;
    return { gw: G.goodwill, debt: G.rayDebt || 0, gripping: typeof snapActive === 'function' ? snapActive() : false };
  });
  ok(snap.gw === 14 && snap.debt === 5,
    `a named snap under a clear sky still fronts +4 (the snap is not this ticket)`);

  const mid = await page.evaluate(() => {
    G.weather = 'clear';
    G.rayDebt = 3;
    G.goodwill = 10;
    finishAction({ id: 'borrow' });
    return { gw: G.goodwill, debt: G.rayDebt || 0 };
  });
  ok(mid.gw === 10 && mid.debt === 3,
    `mid-debt still refuses a second loan (gw=${mid.gw}, debt=${mid.debt})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
