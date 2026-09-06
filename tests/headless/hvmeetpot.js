/*
 * HV-111 — Hold a Camp Meeting said the pot takes something from
 * each resident, then skipped you.
 *
 * meetingAction().tooltip: "a little something for the pot from
 * each resident". finishAction loops `for (mi = 1; mi < heads)` —
 * everyone but you. Two voices add one item. Three add two.
 * hvmeeting and hvmeetcap pin that pot math. The tooltip is the lie.
 *
 *  A. The tooltip names who actually tosses: everyone but you.
 *     It does not say "each resident" as if you fill the pot too.
 *  B. Two heads still add one pot item (the other voice).
 *  C. Isolation: three heads add two; six heads add five —
 *     hvmeeting C and hvmeetcap B stay true. Morale is still +2 a head.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction(meetingAction()). No ui.js.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const tipSrc = /function meetingAction\(\)\{[\s\S]*?tooltip:'([^']+)'/.exec(cfg);
ok(tipSrc && !/from each resident/i.test(tipSrc[1]) && /everyone but you|each other|the others|beyond you/i.test(tipSrc[1]),
  `the meeting tooltip names who tosses, not "each resident" (got: ${tipSrc ? tipSrc[1] : 'missing'})`);

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
    if (!sessionStorage.getItem('hvmeetpot-init')) {
      sessionStorage.setItem('hvmeetpot-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const liveTip = await page.evaluate(() => meetingAction().tooltip);
  ok(!/from each resident/i.test(liveTip) && /everyone but you|each other|the others|beyond you/i.test(liveTip),
    `the live tooltip matches (got: ${liveTip})`);

  const pot = (heads) => page.evaluate((n) => {
    G.goalIndex = GOALS.length;
    G.population = n;
    G.meetingDay = -9;
    G.meetings = 0;
    G.morale = 50;
    G.food = 0; G.cans = 0; G.scraps = 0; G.wood = 0; G.cardboard = 0;
    finishAction(meetingAction());
    return {
      pot: G.food + G.cans + G.scraps + G.wood + G.cardboard,
      morale: G.morale,
    };
  }, heads);

  const two = await pot(2);
  ok(two.pot === 1 && two.morale === 54,
    `two heads: one pot item and +4 morale (pot=${two.pot}, morale=${two.morale})`);

  const three = await pot(3);
  ok(three.pot === 2 && three.morale === 56,
    `three heads: two pot items and +6 morale — hvmeeting C stays (pot=${three.pot})`);

  const six = await pot(6);
  ok(six.pot === 5 && six.morale === 62,
    `six heads: five pot items and +12 morale — hvmeetcap stays (pot=${six.pot}, morale=${six.morale})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
