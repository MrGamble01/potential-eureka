/* Archive Wing shortfall — hook-free production saves and real chip/funding
 * clicks. pagehide flushes the existing save; no game globals or test hooks.
 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const SAVE_KEY = 'startup-tycoon-v7';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const width of [1280, 768]) {
      for (const funded of [false, true]) {
        const context = await browser.newContext({ viewport: { width, height: 880 } });
        const page = await context.newPage();
        page.setDefaultTimeout(10000);
        const errors = [];
        page.on('pageerror', error => errors.push(String(error)));
        await page.addInitScript(({ key, cash }) => {
          localStorage.setItem(key, JSON.stringify({ v: 7, cash,
            allTimeCash: cash, lifetimeCash: cash, fundingRoundIdx: 0,
            jeff: null, ideaWorkers: 0, offlineRatePerSec: 0, savedAt: Date.now() }));
          localStorage.setItem('tyc-mark', JSON.stringify({ panels: 3 }));
          localStorage.setItem('tyc-archive', JSON.stringify({ built: false, visits: 0 }));
          localStorage.setItem('tycoon:welcomeSeen-v1', '1');
          localStorage.setItem('tycoon:tipsEnabled', 'false');
        }, { key: SAVE_KEY, cash: funded ? 24900 : 24300 });
        await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load' });
        const chip = page.locator('#archive-chip');
        const snapshot = () => page.evaluate(key => {
          window.dispatchEvent(new Event('pagehide'));
          return { cash: JSON.parse(localStorage.getItem(key)).cash,
            archive: JSON.parse(localStorage.getItem('tyc-archive')) };
        }, SAVE_KEY);
        const shortfall = async amount => {
          assert.equal(await chip.textContent(), `🗄️ Need $${amount} more`);
          assert.match(await chip.getAttribute('title'), new RegExp(`Need \\$${amount} more to build it`));
          assert.equal(await chip.evaluate(el => el.style.opacity), '0.45');
        };
        // Returning players receive the existing $100 welcome-back bonus.
        if (!funded) {
          const before = await snapshot();
          assert.deepEqual(before, { cash: 24400, archive: { built: false, visits: 0 } });
          await shortfall('600');
          await chip.click();
          assert.equal(await page.locator('.toast').filter({ hasText:
            'Need $600 more to build the Archive Wing.' }).count(), 1);
          assert.deepEqual(await snapshot(), before);
          // Leave the chip before funding: the shared tooltip restores its cached title on blur.
          await page.mouse.move(width - 10, 870);
          await page.keyboard.press('Tab');
          await page.evaluate(() => window.dispatchEvent(new Event('blur')));
          if (width <= 900) await page.locator('#sidebar-toggle').click();
          await page.locator('#funding-panel > .panel-title').click();
          await page.locator('#funding-btn').click(); // Pre-seed: +$100, still broke.
          if (width <= 900) await page.waitForSelector('#drawer-backdrop.open', { state: 'hidden' });
          await shortfall('500');
          assert.deepEqual(await snapshot(), { cash: 24500, archive: { built: false, visits: 0 } });
          await chip.click();
          assert.equal(await page.locator('.toast').filter({ hasText:
            'Need $500 more to build the Archive Wing.' }).count(), 1);
          assert.deepEqual(await snapshot(), { cash: 24500, archive: { built: false, visits: 0 } });
          // Leave the chip before funding: the shared tooltip restores its cached title on blur.
          await page.mouse.move(width - 10, 870);
          await page.keyboard.press('Tab');
          await page.evaluate(() => window.dispatchEvent(new Event('blur')));
          if (width <= 900) await page.locator('#sidebar-toggle').click();
          await page.locator('#funding-btn').click(); // Seed: +$500, exactly affordable.
          if (width <= 900) await page.waitForSelector('#drawer-backdrop.open', { state: 'hidden' });
          console.log(`PASS ${width}: broke refusal and live partial funding without spend/build`);
        }
        assert.equal((await snapshot()).cash, 25000);
        assert.equal(await chip.textContent(), '🗄️ wing $25k');
        assert.match(await chip.getAttribute('title'), /Click to build it\./);
        assert.doesNotMatch(await chip.getAttribute('title'), /Need|cannot afford/);
        assert.equal(await chip.evaluate(el => el.style.opacity), '');
        await chip.click();
        assert.deepEqual(await snapshot(), { cash: 0, archive: { built: true, visits: 0 } });
        assert.equal(await chip.textContent(), '🗄️ archive');
        assert.match(await chip.getAttribute('title'), /A visit pays \$375\. Visited 0 times\./);
        await chip.click();
        assert.deepEqual(await snapshot(), { cash: 375, archive: { built: true, visits: 1 } });
        assert.match(await chip.getAttribute('title'), /has had its visit this session/);
        await chip.click();
        assert.deepEqual(await snapshot(), { cash: 375, archive: { built: true, visits: 1 } });
        assert.deepEqual(errors, []);
        console.log(`PASS ${width} (${funded ? 'funded seed' : 'live funding'}): exact-cost build, visit pays once, zero page errors`);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
