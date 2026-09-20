/* Decision Space must activate the focused button without releasing the
 * simulation hold. Real canvas clicks, saved towns, and lifecycle saves only. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const kind of ['event', 'trader']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      await page.addInitScript(kind => {
        localStorage.setItem('hearthvale-v1', JSON.stringify({
          seed: 12345, day: 1, time: 10, seenIntro: true, muted: true,
          townName: 'Decision Keys', _nextId: 2, traderDay: kind === 'trader' ? 1 : 0,
          res: { wood: 40, stone: 20, food: 30, gold: 80 }, villagers: [],
          buildings: [{ id: 1, type: 'market', tx: 28, ty: 24, done: true }],
        }));
      }, kind);
      await page.goto(BASE + '/hearthvale.html');
      await page.click('#speedctl [data-sp="3"]');
      const mini = await page.locator('#minimap').boundingBox();
      const y = kind === 'trader' ? 22 : 25.5;
      await page.mouse.click(mini.x + mini.width * 29.5 / 56, mini.y + mini.height * y / 42);
      await page.mouse.click(640, 450);
      if (kind === 'event') await page.click('#p-caravan');
      await page.waitForSelector(`#${kind}.show`);
      const saved = () => page.evaluate(() => {
        window.dispatchEvent(new Event('beforeunload'));
        return JSON.parse(localStorage.getItem('hearthvale-v1'));
      });
      const before = await saved();
      // Blur the pointer's old control so Space is an unfocused game shortcut.
      await page.evaluate(() => document.activeElement.blur());
      await page.keyboard.press('Space');
      await page.waitForTimeout(1200);
      assert.equal((await saved()).time, before.time, `${kind}: unfocused Space must keep time held`);
      assert.equal(await page.locator('#speedctl .on').getAttribute('data-sp'), '0');
      console.log(`PASS ${kind}: Space keeps the decision paused`);
      if (kind === 'event') {
        await page.locator('#ev-choices button').first().focus();
        await page.keyboard.press('Space');
        await page.waitForSelector('#event.show', { state: 'hidden' });
        assert.equal((await saved()).caravanStake, true, 'Space stakes on the caravan');
      } else {
        const buy = page.locator('[data-act="buy"][data-k="wood"][data-q="1"]');
        await buy.focus();
        await page.keyboard.press('Space');
        const bought = await saved();
        assert.equal(bought.res.wood, before.res.wood + 1, 'Space buys exactly one wood');
        assert.equal(bought.time, before.time, 'Trading keeps time held');
        await page.keyboard.press('Escape');
        await page.waitForSelector('#trader.show', { state: 'hidden' });
      }
      assert.equal(await page.locator('#speedctl .on').getAttribute('data-sp'), '3', 'Closing restores triple speed');
      console.log(`PASS ${kind}: keyboard action works and prior speed returns`);
      const resumed = await saved();
      await page.waitForTimeout(500);
      assert.ok((await saved()).time > resumed.time, 'Simulation resumes after closing');
      await page.evaluate(() => document.activeElement.blur());
      await page.keyboard.press('Space');
      assert.equal(await page.locator('#speedctl .on').getAttribute('data-sp'), '0', 'Ordinary Space still pauses');
      await page.keyboard.press('Space');
      assert.equal(await page.locator('#speedctl .on').getAttribute('data-sp'), '3', 'Ordinary Space still resumes');
      assert.deepEqual(errors, []);
      console.log(`PASS ${kind}: simulation resumes, normal pause still works, no page errors`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
