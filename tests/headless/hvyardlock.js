/*
 * HV-163 — Dumpsters Locked said nothing to scavenge today,
 * then Sort at the scrapyard still paid a full haul.
 *
 * The lock card says property management put locks on the
 * dumpsters — nothing to scavenge today. Scavenge and Forage
 * already refuse. The bulletin board still posted Sort at
 * the scrapyard and paid +5 scraps +2 cans — the same goods
 * the bins give.
 *
 * #753 is the Scrapper's dawn dig. #795 is Forage looking
 * open. This is the board job.
 *
 *  A. Source: the card still says today; the odd-job path
 *     reads dumpsterLockDay for scrapyd.
 *  B. A live lock on scrapyard day: finishAction pays 0,
 *     names the lock, does not stamp the day.
 *  C. doAction does not start the 8s job.
 *  D. An unlocked scrapyard still pays +5/+2.
 *  E. Depot and the garden lot still pay during a lock.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives doAction + finishAction(oddjob).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const odd = /\} else if\(a\.id==='oddjob'\)\{([\s\S]*?)\n  \} else if\(a\.id==='mural'\)/.exec(player);
ok(/Nothing to scavenge today/.test(loop) && /id:'scrapyd'[\s\S]{0,160}?decent haul/.test(cfg),
  'the lock still says nothing to scavenge today; the yard still posts a decent haul');
ok(odd && /scrapyd/.test(odd[1]) && /dumpsterLockDay/.test(odd[1]),
  'HV-163: the odd-job finish reads the lock for the scrapyard');

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
    if (!sessionStorage.getItem('hvyardlock-init')) {
      sessionStorage.setItem('hvyardlock-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const locked = await page.evaluate(() => {
    G.days = 3; // scrapyd
    G.dumpsterLockDay = 3;
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
      stamped: G.oddJobDay === 3,
      named: /locked/i.test(log),
    };
  });
  ok(locked.job === 'scrapyd' && locked.scraps === 0 && locked.cans === 0
    && !locked.stamped && locked.named,
    'HV-163: a locked scrapyard pays 0, names the lock, and leaves the board open');

  const door = await page.evaluate(() => {
    G.days = 3;
    G.dumpsterLockDay = 3;
    G.oddJobDay = -9;
    delete activeJobs.oddjob;
    G.cooldowns = {};
    doAction(oddJobAction());
    const started = !!activeJobs.oddjob;
    delete activeJobs.oddjob;
    return started;
  });
  ok(!door, 'doAction does not start the scrapyard job on a locked day');

  const open = await page.evaluate(() => {
    G.days = 3;
    G.dumpsterLockDay = -1;
    G.oddJobDay = -9;
    G.scraps = 0;
    G.cans = 0;
    G.structures.toolbox = false;
    finishAction(oddJobAction());
    return { scraps: G.scraps, cans: G.cans, day: G.oddJobDay };
  });
  ok(open.scraps === 5 && open.cans === 2 && open.day === 3,
    'an unlocked scrapyard still pays +5 scraps +2 cans');

  const others = await page.evaluate(() => {
    G.dumpsterLockDay = 0;
    G.structures.toolbox = false;
    G.days = 0; // depot
    G.oddJobDay = -9;
    G.goodwill = 0;
    finishAction(oddJobAction());
    const depot = G.goodwill;
    G.days = 2; // gardenh
    G.dumpsterLockDay = 2;
    G.oddJobDay = -9;
    G.food = 10;
    G.weather = 'clear';
    finishAction(oddJobAction());
    return { depot, garden: G.food - 10 };
  });
  ok(others.depot === 5 && others.garden === 4,
    'depot and the garden lot still pay during a lock');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
