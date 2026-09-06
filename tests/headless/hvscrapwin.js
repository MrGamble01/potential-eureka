/* HV-108 — Winter halves the dumpsters, and the Scrapper still
 * hauled a summer load.
 *
 * The crash course says: "Winter halves what the dumpsters give."
 * The Scrapper's card says: "Auto-scavenges every day."
 * The player's own dig applies `(G.season===3?.5:1)*weatherDef().scav`.
 * The hired Scrapper did not. Same bins. Same winter. Full haul.
 *
 *  A. Source: the Scrapper dawn haul uses the winter half.
 *  B. The worker card still says Auto-scavenges every day.
 *  C. The crash course still names the winter half.
 *  D. A pinned summer dawn (clear sky, rand → 0.5) yields +2 scraps
 *     and +1 can. The same pin in winter yields half: +1 scrap, +0 cans.
 *  E. Without a Scrapper the two seasons leave scraps and cans alone.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives onNewDay() on the production dawn.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'homeless-village.html'), 'utf8');

const scrapBlock = /if\(G\.workers\.scrapper\)\{[\s\S]*?log\('The Scrapper found some supplies\.'\);\s*\}/.exec(loop);
ok(!!scrapBlock, 'the Scrapper still hauls at dawn in gameloop.js');
ok(scrapBlock && /season\s*===\s*3/.test(scrapBlock[0]) && /0?\.5/.test(scrapBlock[0]),
  'HV-108: the Scrapper haul uses the winter half');
ok(/id:'scrapper'[\s\S]{0,80}Auto-scavenges every day/.test(cfg),
  'the worker card still says Auto-scavenges every day');
ok(/Winter halves what the dumpsters give/i.test(html),
  'the crash course still names the winter half');

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
    if (!sessionStorage.getItem('hvscrapwin-init')) {
      sessionStorage.setItem('hvscrapwin-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const card = await t(() => {
    const w = WORKER_DEFS.find(x => x.id === 'scrapper');
    return w ? w.desc : '';
  });
  ok(/auto-scavenges every day/i.test(card),
    `the live worker card still says Auto-scavenges every day (${card})`);

  // helper: one controlled dawn.
  // onNewDay increments days then sets season = floor(days/7)%4.
  // days 6 → 7 is summer (1). days 20 → 21 is winter (3).
  // Math.random = 0.5 → rand(1,3)=2 scraps, rand(0,2)=1 can,
  // clear sky (spring/summer/winter all read 0.5 as clear), no snap.
  const dawn = (startDays, scrapper) => t(new Function(`
    const real = Math.random;
    Math.random = () => 0.5;
    G.population = 1; G.dog = 0; G.dogMetDay = 99;
    G.structures.tent = false; G.structures.garden = false;
    G.structures.pantry = false; G.structures.soup_kitchen = false;
    G.structures.workbench = false; G.structures.toolbox = false;
    G.structures.coats = false; G.structures.barrel = false;
    G.workers.cook = null; G.workers.lookout = false;
    G.workers.scrapper = ${scrapper ? 'true' : 'false'};
    G.rep = 0; G.snapUntil = null; G.days = ${startDays}; G.warmth = 90;
    G.health = 80; G.morale = 50; G.food = 20;
    G.scraps = 10; G.cans = 10;
    G.forecast = 'clear'; G.lastEventDay = 999;
    G.ticketsSent = 0; G.rayDebt = 0; G.rainBetOn = false;
    G.dumpsterLockDay = -1; G.petitions = {};
    G.regulars = {marisol:0, ray:0, dee:0};
    onNewDay();
    Math.random = real;
    return { scraps: G.scraps, cans: G.cans, season: G.season, weather: G.weather, days: G.days };
  `));

  const summer = await dawn(6, true);
  ok(summer.season === 1 && summer.weather === 'clear',
    `summer dawn is a clear summer day (season=${summer.season}, weather=${summer.weather})`);
  ok(summer.scraps === 12 && summer.cans === 11,
    `summer Scrapper haul is +2 scraps +1 can (10/10 → ${summer.scraps}/${summer.cans})`);

  const winter = await dawn(20, true);
  ok(winter.season === 3 && winter.weather === 'clear',
    `winter dawn is a clear winter day (season=${winter.season}, weather=${winter.weather})`);
  ok(winter.scraps === 11 && winter.cans === 10,
    `HV-108: winter halves the Scrapper haul — +1 scrap +0 cans (10/10 → ${winter.scraps}/${winter.cans})`);

  const bareS = await dawn(6, false);
  const bareW = await dawn(20, false);
  ok(bareS.scraps === 10 && bareS.cans === 10 && bareW.scraps === 10 && bareW.cans === 10,
    `without a Scrapper neither season moves scraps or cans (S ${bareS.scraps}/${bareS.cans}, W ${bareW.scraps}/${bareW.cans})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
