/*
 * HV-171 — Walk the neighbor's dogs said fresh air, then a scorcher
 * still paid +6 morale.
 *
 * The bulletin posting is "Fresh air, wagging tails. +2 goodwill,
 * +6 morale." Wagging tails is a different ticket (hungry Biscuit).
 * Fresh air is this one. A Heat Wave dawn already tells the camp
 * it is a scorcher. The walk still paid the full lift.
 *
 *  A. Source: the odd-job payout reads heat on the dog walk; ui.js
 *     is untouched. The posting still promises fresh air.
 *  B. A pinned scorcher walk does not add the +6 morale.
 *  C. The neighbor still pays +2 goodwill.
 *  D. A clear / rain / cold walk still pays +6.
 *  E. Sort at the scrapyard still pays its haul on a scorcher
 *     (different job — not this ticket).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction() on the production odd job.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');
const odd = /a\.id==='oddjob'[\s\S]*?} else if\(a\.id==='mural'/.exec(player);
ok(!!odd, 'odd-job payout is still in player.js');
ok(odd && /dogwalk/.test(odd[0]) && /heat/.test(odd[0]),
  'HV-171: odd-job payout reads heat on the dog walk');
ok(/Fresh air, wagging tails/.test(cfg),
  'the posting still promises fresh air');
ok(!/dogwalk/.test(ui) || !/weather==='heat'/.test(ui),
  'ui.js untouched — the wilt lives on the odd-job payout');

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
    if (!sessionStorage.getItem('hvdogheat-init')) {
      sessionStorage.setItem('hvdogheat-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const walk = (weather, extra) => page.evaluate(({ weather, extra }) => {
    G.days = 4;
    G.oddJobDay = -1;
    G.goalIndex = GOALS.length;
    G.weather = weather;
    G.morale = 50;
    G.goodwill = 0;
    G.structures.toolbox = false;
    G.dog = 0;
    G.dogHungry = false;
    Object.assign(G, extra || {});
    finishAction(oddJobAction());
    return {
      job: todaysJob().id,
      morale: G.morale,
      goodwill: G.goodwill,
      log: Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join(' '),
    };
  }, { weather, extra });

  const heat = await walk('heat');
  ok(heat.job === 'dogwalk',
    `day 4 still posts the dog walk (${heat.job})`);
  ok(heat.morale === 50,
    `HV-171: a scorcher walk does not add the +6 (50 → ${heat.morale})`);
  ok(heat.goodwill === 2,
    `the neighbor still pays +2 goodwill (${heat.goodwill})`);

  const clear = await walk('clear');
  ok(clear.morale === 56 && clear.goodwill === 2,
    `a clear walk still pays +6 / +2 (${clear.morale}/${clear.goodwill})`);

  const rain = await walk('rain');
  ok(rain.morale === 56,
    `rain still pays the lift — not this ticket (${rain.morale})`);

  const cold = await walk('cold');
  ok(cold.morale === 56,
    `cold still pays the lift — not this ticket (${cold.morale})`);

  const yard = await page.evaluate(() => {
    G.days = 3;
    G.oddJobDay = -1;
    G.goalIndex = GOALS.length;
    G.weather = 'heat';
    G.scraps = 0;
    G.cans = 0;
    G.structures.toolbox = false;
    finishAction(oddJobAction());
    return { job: todaysJob().id, scraps: G.scraps, cans: G.cans };
  });
  ok(yard.job === 'scrapyd' && yard.scraps === 5 && yard.cans === 2,
    `the scrapyard still pays its haul on a scorcher (${yard.scraps}/${yard.cans})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
