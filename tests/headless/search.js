/* P4 card search: filters by name and tag, counts, Esc clears. */
const { chromium } = require('playwright');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const visible = () => page.evaluate(() =>
    [...document.querySelectorAll('.arcade-grid .arcade-card')].filter(c => c.style.display !== 'none').length);

  const total = await visible();
  ok(total === 8, `all 8 showcase cards visible initially (${total})`);

  await page.fill('#card-search', 'tetris');
  const byTetris = await visible();
  ok(byTetris === 1, `"tetris" filters to 1 (${byTetris})`);

  await page.fill('#card-search', 'cozy');   // tag search
  const byCozy = await visible();
  ok(byCozy === 2, `tag "Cozy" finds Hearthvale and Voxel Isle (${byCozy})`);
  const count = await page.evaluate(() => document.getElementById('card-search-count').textContent);
  ok(new RegExp(byCozy + ' games').test(count), `count readout live (${count})`);

  await page.fill('#card-search', 'zzzz');
  ok(await visible() === 0, 'no matches hides everything');

  await page.focus('#card-search');
  await page.keyboard.press('Escape');
  ok(await visible() === total, 'Esc clears back to the full grid');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
