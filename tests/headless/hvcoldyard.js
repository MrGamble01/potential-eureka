/* HV-189 — a cold morning said the cold gets into everything,
 * then Sort at the scrapyard still paid a warm-day haul.
 *
 * Dawn names it: "The cold gets into everything." The scrapyard
 * posting is dirty work, a decent haul — +5 scraps, +2 cans.
 * Dumpsters already feel a cold sky (scav 0.75). The yard never
 * did. A pinned sort on a cold morning still paid summer.
 *
 * #857 is winter (the season) at the same yard. #853 is the lock
 * card. #872 is a cold depot lift. This is the cold sky at the
 * yard.
 *
 *  A. Source: dawn still says the cold gets into everything.
 *     The yard still promises a decent haul of +5 / +2.
 *  B. Source: the scrapyard payout reads weather==='cold'.
 *     ui.js does not.
 *  C. Live: a pinned cold sort pays half (2 scraps, 1 can)
 *     and names the cold.
 *  D. The same sort on a clear day still pays +5 / +2.
 *  E. A clear winter morning still pays +5 / +2 — season is
 *     #857's fight, not this one.
 *  F. The toolbox still adds +2 on a cold sort. Depot on a
 *     cold day still pays +5 (different posting).
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production odd-job payout.
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

const job = /a\.id==='oddjob'[\s\S]*?} else if\(a\.id==='mural'\)/.exec(player);
const body = job ? job[0] : '';

ok(/The cold gets into everything/.test(loop)
  && /id:'scrapyd'[\s\S]{0,180}?Dirty work, decent haul/.test(cfg)
  && /\+5 scraps, \+2 cans/.test(cfg),
  'dawn still says the cold gets into everything; the yard still promises +5 / +2');
ok(body && /scrapyd/.test(body) && /weather\s*===\s*'cold'/.test(body),
  'HV-189: the scrapyard payout reads a cold sky');
ok(!/scrapyd/.test(ui) && !/weather\s*===\s*'cold'/.test(ui),
  'ui.js untouched — the cut lives on the odd-job payout');

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
    if (!sessionStorage.getItem('hvcoldyard-init')) {
      sessionStorage.setItem('hvcoldyard-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const sortAt = (weather, season, toolbox) => page.evaluate(({ weather, season, toolbox }) => {
    G.days = 3;
    G.oddJobDay = -1;
    G.weather = weather;
    G.season = season;
    G.structures.toolbox = !!toolbox;
    G.scraps = 0;
    G.cans = 0;
    G.goodwill = 0;
    G.rep = 0;
    finishAction(oddJobAction());
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      job: todaysJob().id,
      scraps: G.scraps,
      cans: G.cans,
      gw: G.goodwill,
      named: /cold|yard/i.test(log) && /thinner|half/i.test(log),
    };
  }, { weather, season, toolbox });

  const cold = await sortAt('cold', 0, false);
  ok(cold.job === 'scrapyd' && cold.scraps === 2 && cold.cans === 1,
    `HV-189: a cold sort pays half (scraps ${cold.scraps}, cans ${cold.cans})`);
  ok(cold.named, 'the log names the cold at the yard');

  const clear = await sortAt('clear', 0, false);
  ok(clear.job === 'scrapyd' && clear.scraps === 5 && clear.cans === 2,
    `a clear sort still pays the posted haul (scraps ${clear.scraps}, cans ${clear.cans})`);

  const winter = await sortAt('clear', 3, false);
  ok(winter.job === 'scrapyd' && winter.scraps === 5 && winter.cans === 2,
    `a clear winter morning still pays +5 / +2 (season is not this ticket)`);

  const tools = await sortAt('cold', 0, true);
  ok(tools.scraps === 2 && tools.cans === 1 && tools.gw === 2,
    `the toolbox still adds +2 on a cold sort (gw ${tools.gw})`);

  const depot = await page.evaluate(() => {
    G.days = 0;
    G.oddJobDay = -1;
    G.weather = 'cold';
    G.structures.toolbox = false;
    G.goodwill = 0;
    finishAction(oddJobAction());
    return { job: todaysJob().id, gw: G.goodwill };
  });
  ok(depot.job === 'depot' && depot.gw === 5,
    `a cold depot lift still pays +5 (different posting, gw ${depot.gw})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
