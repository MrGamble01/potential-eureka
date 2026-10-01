/*
 * HV-237 — Sort at the scrapyard said dirty work, then a rainy
 * day still paid a dry-day haul.
 *
 * The posting is outdoor dirty work: +5 scraps, +2 cans. Rain
 * already halves the panhandle corner. The scrapyard paid the
 * dry-day take under a wet sky.
 *
 * Cold morning and winter are not this card. Dumpsters Locked
 * is not this card. Flyers and the deposit run are not this card.
 *
 *  A. Source: the odd-job payout names rain on the scrapyard.
 *  B. A clear day still pays the posted haul.
 *  C. Rain cuts the yard. Depot and flyers stay dry-day.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction(oddJobAction()) on the production row.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const config = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const finishAt = player.indexOf('function finishAction(a){');
const finish = finishAt >= 0 ? player.slice(finishAt) : '';
const oddAt = finish.indexOf("a.id==='oddjob'");
const muralAt = finish.indexOf("a.id==='mural'");
const oddBlock = oddAt >= 0 && muralAt > oddAt ? finish.slice(oddAt, muralAt) : '';

ok(finishAt >= 0 && oddAt >= 0 && /todaysJob/.test(oddBlock),
  'odd-job payout is still in finishAction');
ok(/scrapyd/.test(oddBlock) && /weather==='rain'/.test(oddBlock),
  'HV-237: the scrapyard payout names rain');
ok(/Dirty work, decent haul/.test(config) && /id:'scrapyd'/.test(config),
  'the posting is still dirty work at the scrapyard');
ok(!/homeless-village\/js\/ui\.js/.test(player) && !/homeless-village\/js\/ui\.js/.test(config),
  'the wet haul lives in finishAction — ui.js is not this ticket');

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
    if (!sessionStorage.getItem('hvyard-init')) {
      sessionStorage.setItem('hvyard-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const dry = await t(() => {
    G.days = 3;
    G.weather = 'clear';
    G.oddJobDay = -1;
    G.scraps = 0; G.cans = 0; G.structures.toolbox = false;
    finishAction(oddJobAction());
    return { id: todaysJob().id, scraps: G.scraps, cans: G.cans };
  });
  ok(dry.id === 'scrapyd' && dry.scraps === 5 && dry.cans === 2,
    `a clear day still pays the posted haul (${dry.scraps} scraps, ${dry.cans} cans)`);

  const wet = await t(() => {
    G.days = 3;
    G.weather = 'rain';
    G.oddJobDay = -1;
    G.scraps = 0; G.cans = 0; G.structures.toolbox = false;
    finishAction(oddJobAction());
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return { scraps: G.scraps, cans: G.cans, log };
  });
  ok(wet.scraps === 2 && wet.cans === 1,
    `rain cuts the yard (${wet.scraps} scraps, ${wet.cans} cans)`);
  ok(/slick|wet haul|rain/i.test(wet.log),
    'the feed names the wet yard');

  const depot = await t(() => {
    G.days = 0;
    G.weather = 'rain';
    G.oddJobDay = -1;
    G.goodwill = 0;
    finishAction(oddJobAction());
    return { id: todaysJob().id, gw: G.goodwill };
  });
  ok(depot.id === 'depot' && depot.gw === 5,
    `depot on a wet morning still pays the posted lift (${depot.gw})`);

  const flyers = await t(() => {
    G.days = 1;
    G.weather = 'rain';
    G.oddJobDay = -1;
    G.goodwill = 0; G.morale = 50;
    finishAction(oddJobAction());
    return { id: todaysJob().id, gw: G.goodwill, morale: G.morale };
  });
  ok(flyers.id === 'flyers' && flyers.gw === 3 && flyers.morale === 54,
    `flyers on a wet day still pay the posted shop take (${flyers.gw} gw, morale ${flyers.morale})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
