/* HV-64 — Hold a Camp Meeting said +2 morale a head, then capped at 10.
 *
 * meetingAction().tooltip: "+2 morale a head".
 * finishAction used Math.min(10, 2*heads). Five voices hit the
 * ceiling exactly, so hvmeeting never saw it. Six residents
 * (a full village plus a hire) should earn +12, not +10.
 *
 *  A. The tooltip still promises +2 a head — that is the contract.
 *  B. Six heads pay +12 morale, not +10. The pot still scales (5 items).
 *  C. Five heads still pay +10 — hvmeeting's village case stays true.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction(meetingAction()).
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
    if (!sessionStorage.getItem('hvmeetcap-init')) {
      sessionStorage.setItem('hvmeetcap-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const tip = await page.evaluate(() => meetingAction().tooltip);
  ok(/\+2 morale a head/i.test(tip),
    `the meeting tooltip still promises +2 morale a head`);

  const six = await page.evaluate(() => {
    G.goalIndex = GOALS.length;
    G.meetingDay = -9;
    G.days = 10;
    G.population = 6;
    G.morale = 50;
    G.food = 0; G.cans = 0; G.scraps = 0; G.wood = 0; G.cardboard = 0;
    finishAction(meetingAction());
    const pot = G.food + G.cans + G.scraps + G.wood + G.cardboard;
    return { morale: G.morale, gain: G.morale - 50, pot };
  });
  ok(six.gain === 12 && six.morale === 62,
    `six heads pay +12 morale, not +10 (got +${six.gain}, morale ${six.morale})`);
  ok(six.pot === 5,
    `the pot still scales — five items from everyone but you (got ${six.pot})`);

  const five = await page.evaluate(() => {
    G.goalIndex = GOALS.length;
    G.meetingDay = -9;
    G.days = 20;
    G.population = 5;
    G.morale = 50;
    G.goodwill = 10;
    G.food = 0; G.cans = 0; G.scraps = 0; G.wood = 0; G.cardboard = 0;
    finishAction(meetingAction());
    return { morale: G.morale, gain: G.morale - 50 };
  });
  ok(five.gain === 10 && five.morale === 60,
    `five heads still pay +10 (got +${five.gain})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
