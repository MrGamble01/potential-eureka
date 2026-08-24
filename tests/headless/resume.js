/* P4 Jump Back In: hidden fresh; after play, shows last-played first
   and navigates on click. */
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
  ok(await page.evaluate(() => document.getElementById('jump-back-in').hidden), 'hidden on a fresh profile');

  // Play snake then tetris briefly
  await page.evaluate(() => { location.hash = '#snake'; });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { location.hash = '#tetris'; });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { location.hash = '#arcade'; });
  await page.waitForTimeout(600);

  const row = await page.evaluate(() => ({
    hidden: document.getElementById('jump-back-in').hidden,
    chips: [...document.querySelectorAll('.resume-chip')].map(c => c.textContent),
  }));
  ok(!row.hidden && row.chips.length >= 2, `row appears with ${row.chips.length} chips`);
  ok(/Tetris.*last played/.test(row.chips[0]), `last-played leads (${row.chips[0]})`);
  await page.click('.resume-chip');
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => document.getElementById('view-tetris').classList.contains('active')),
     'clicking a chip jumps into the game');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
