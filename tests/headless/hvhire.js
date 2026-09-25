/* Hook-free: seed production state, click real hire buttons, and complete a
 * production deposit to verify HUD refresh. No game functions are replaced. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    for (const width of [1280, 768]) {
      const page = await browser.newPage({ viewport: { width, height: 880 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => localStorage.setItem('hv-intro-seen', '1'));
      await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
      await page.waitForFunction(() => document.getElementById('hire-scrapper'));
      // Pause browser time so random day events cannot change seeded resources.
      const now = Date.now();
      await page.clock.install({ time: now });
      await page.clock.pauseAt(now + 1000);
      await page.evaluate(() => {
        G.goodwill = 1.25; G.workers = {}; G.goalIndex = GOALS.length;
        buildWorkersUI(); updateHUD();
      });
      const expected = { scrapper: 8, builder: 12, cook: 10, lookout: 15 };
      for (const [id, cost] of Object.entries(expected)) {
        const button = page.locator('#hire-' + id);
        const name = await button.locator('..').locator('.w-name').textContent();
        const shortfall = Math.ceil(cost - 1.25);
        assert.equal(await button.textContent(), `Need ${shortfall} more`);
        assert.equal(await button.getAttribute('title'), `Need ${shortfall} more goodwill to recruit ${name}.`);
        await button.click();
        assert.equal(await page.locator('.log-line').last().textContent(), `> Need ${shortfall} more goodwill to recruit ${name}.`);
        assert.deepEqual(await page.evaluate(() => ({ goodwill: G.goodwill, workers: G.workers })), { goodwill: 1.25, workers: {} });
      }
      await page.evaluate(() => {
        G.structures.cart = true; G.cans = 6; G.weather = 'clear'; G.depositDay = -1;
        finishAction({ id: 'deposit', cooldown: 0 });
      });
      assert.equal(await page.evaluate(() => G.goodwill), 4.25);
      for (const [id, cost] of Object.entries(expected)) {
        assert.equal(await page.locator('#hire-' + id).textContent(), `Need ${Math.ceil(cost - 4.25)} more`);
      }
      // Exact affordability restores the cost and original flavor title.
      await page.evaluate(() => { G.goodwill = 8; updateHUD(); });
      const scrapper = page.locator('#hire-scrapper');
      assert.equal(await scrapper.textContent(), '8🩶');
      assert.equal(await scrapper.getAttribute('title'), 'Auto-scavenges every day');
      const population = await page.evaluate(() => G.population);
      await scrapper.click();
      assert.deepEqual(await page.evaluate(() => ({ goodwill: G.goodwill, hired: G.workers.scrapper, population: G.population })),
        { goodwill: 0, hired: true, population: Math.min(20, population + 1) });
      assert.equal(await page.locator('.worker-row.hired').textContent(), '🔍Scrapperactive');
      assert.equal(await page.locator('#hire-builder').textContent(), 'Need 12 more');
      assert.equal(await page.locator('.log-line').last().textContent(), '> Scrapper joined the community.');
      await page.evaluate(() => { G.goodwill = 20; updateHUD(); });
      assert.equal(await page.locator('.worker-row.hired').textContent(), '🔍Scrapperactive');
      assert.equal(await page.locator('#hire-builder').textContent(), '12🩶');
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}: all worker shortfalls, refusal without spending, live gain, exact-cost hire, active row, zero page errors`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
