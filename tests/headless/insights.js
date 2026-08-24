/* IDEA-SITE-8 — local insights.
   Playing games records launches + seconds; the HOF renders the panel;
   utility views don't count; the panel hides on a fresh profile. */
const { chromium } = require('playwright');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext()).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // Fresh: panel empty
  await page.evaluate(() => { location.hash = '#halloffame'; });
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => document.getElementById('hof-insights').innerHTML === ''),
     'fresh profile shows no panel');

  // Play snake for ~3s, then tetris twice briefly
  await page.evaluate(() => { location.hash = '#snake'; });
  await page.waitForTimeout(3200);
  await page.evaluate(() => { location.hash = '#tetris'; });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { location.hash = '#arcade'; });
  await page.waitForTimeout(400);
  await page.evaluate(() => { location.hash = '#tetris'; });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { location.hash = '#productivity'; }); // not a game
  await page.waitForTimeout(600);

  const stats = await page.evaluate(() => JSON.parse(localStorage.getItem('eureka-stats')));
  ok(stats.launches.snake === 1 && stats.launches.tetris === 2, `launches counted (snake 1, tetris ${stats.launches.tetris})`);
  ok(stats.seconds.snake >= 2 && stats.seconds.snake <= 6, `snake seconds accrued (${stats.seconds.snake}s)`);
  ok(!stats.launches.productivity, 'utility views are not plays');
  const today = await page.evaluate(() => Utils.todayKey());
  ok(stats.days[today] >= 3, `daily total accrues (${stats.days[today]}s today)`);

  // Panel renders
  await page.evaluate(() => { location.hash = '#halloffame'; });
  await page.waitForTimeout(700);
  const panel = await page.evaluate(() => document.getElementById('hof-insights').textContent);
  ok(/YOUR ARCADE/.test(panel) && /3 plays/.test(panel), `panel renders totals (${panel.slice(0, 60)})`);
  ok(/favourite Snake/.test(panel), 'favourite is the most-played game');
  ok(/Never sent anywhere/.test(panel), 'privacy note present');
  const bars = await page.evaluate(() => document.querySelectorAll('.ins-row').length);
  ok(bars === 2, `per-game bars render (${bars})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
