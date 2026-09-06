/*
 * HV-167 — Winter halves the dumpsters, then Sort at the
 * scrapyard still paid a summer haul.
 *
 * The crash course says winter halves what the dumpsters give.
 * Player scavenge already uses that cut. #788 is the Scrapper's
 * dawn dig. #850 is Forage Area. #853 is the lock on this same
 * board job. The bulletin still posted Sort at the scrapyard
 * and paid +5 scraps +2 cans through winter — dumpster goods
 * at summer rates.
 *
 *  A. Source: the card still says a decent haul; the odd-job
 *     path reads season for scrapyd.
 *  B. A live winter scrapyard: finishAction pays the halved
 *     haul (2 scraps, 1 can) and names winter.
 *  C. A spring scrapyard still pays +5/+2.
 *  D. Depot and the garden lot still pay full in winter.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives finishAction(oddjob). ui.js unread.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
const SHOT = process.env.HVYARDWIN_SHOT || '';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const odd = /\} else if\(a\.id==='oddjob'\)\{([\s\S]*?)\n  \} else if\(a\.id==='mural'\)/.exec(player);
ok(/id:'scrapyd'[\s\S]{0,160}?decent haul/.test(cfg)
  && /G\.season===3\?\.5:1/.test(player),
  'the yard still posts a decent haul; winter already halves the bins');
ok(odd && /scrapyd/.test(odd[1]) && /season===3/.test(odd[1]),
  'HV-167: the odd-job finish reads winter for the scrapyard');

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
    if (!sessionStorage.getItem('hvyardwin-init')) {
      sessionStorage.setItem('hvyardwin-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const winter = await page.evaluate(() => {
    G.days = 3;
    G.season = 3;
    G.oddJobDay = -9;
    G.scraps = 0;
    G.cans = 0;
    G.structures.toolbox = false;
    G.goalIndex = GOALS.length;
    finishAction(oddJobAction());
    const log = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent).join('\n');
    return {
      job: todaysJob().id,
      scraps: G.scraps,
      cans: G.cans,
      named: /winter/i.test(log),
    };
  });
  ok(winter.job === 'scrapyd' && winter.scraps === 2 && winter.cans === 1 && winter.named,
    `HV-167: a winter scrapyard pays the halved haul (${winter.scraps} scraps, ${winter.cans} cans) and names it`);

  if (SHOT) {
    await page.screenshot({ path: path.join(SHOT, 'hv167-winter-yard.png'), fullPage: true });
  }

  const spring = await page.evaluate(() => {
    G.days = 3;
    G.season = 0;
    G.oddJobDay = -9;
    G.scraps = 0;
    G.cans = 0;
    G.structures.toolbox = false;
    finishAction(oddJobAction());
    return { scraps: G.scraps, cans: G.cans, day: G.oddJobDay };
  });
  ok(spring.scraps === 5 && spring.cans === 2 && spring.day === 3,
    'a spring scrapyard still pays +5 scraps +2 cans');

  const others = await page.evaluate(() => {
    G.season = 3;
    G.structures.toolbox = false;
    G.days = 0;
    G.oddJobDay = -9;
    G.goodwill = 0;
    finishAction(oddJobAction());
    const depot = G.goodwill;
    G.days = 2;
    G.oddJobDay = -9;
    G.food = 10;
    G.weather = 'clear';
    finishAction(oddJobAction());
    return { depot, garden: G.food - 10 };
  });
  ok(others.depot === 5 && others.garden === 4,
    'depot and the garden lot still pay full in winter');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
