/* Jeff signing bonus — hook-free: seed the production save, use real funding
 * and recruit controls, and inspect saves flushed through pagehide. No game
 * globals or injected hooks. dispatchEvent exercises the disabled-click guard.
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
    const page = await browser.newPage({ viewport: { width: 1280, height: 880 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.addInitScript(key => {
      localStorage.setItem(key, JSON.stringify({ v: 7, cash: 4300,
        allTimeCash: 4300, lifetimeCash: 4300, fundingRoundIdx: 0,
        jeff: null, ideaWorkers: 0, offlineRatePerSec: 0, savedAt: Date.now() }));
      localStorage.setItem('tycoon:welcomeSeen-v1', '1');
      localStorage.setItem('tycoon:tipsEnabled', 'false');
    }, SAVE_KEY);
    await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load' });
    const button = page.locator('#recruit-jeff-btn');
    const snapshot = () => page.evaluate(key => {
      window.dispatchEvent(new Event('pagehide'));
      return JSON.parse(localStorage.getItem(key));
    }, SAVE_KEY);
    const shortfall = async amount => {
      assert.equal(await button.locator('.cost').textContent(), `Need $${amount} more`);
      assert.equal(await button.isDisabled(), true);
      assert.match(await button.getAttribute('title'), new RegExp(`Need \\$${amount} more.*signing bonus`));
    };

    // Returning players receive the existing $100 welcome-back bonus.
    assert.equal((await snapshot()).cash, 4400);
    await shortfall('600');
    await button.dispatchEvent('click');
    assert.equal(await page.locator('.toast').filter({ hasText: 'Need $600 more to pay Jeff Jackets’ signing bonus.' }).count(), 1);
    const refused = await snapshot();
    assert.equal(refused.cash, 4400);
    assert.equal(refused.jeff, null);
    console.log('PASS  broke tag, disabled title, forced refusal toast; no spend or Jeff');

    await page.locator('#funding-panel > .panel-title').click();
    await page.locator('#funding-btn').click(); // Pre-seed: +$100.
    await shortfall('500');
    await page.locator('#funding-btn').click(); // Seed: +$500, exactly affordable.
    assert.equal(await button.isEnabled(), true);
    assert.equal(await button.locator('.cost').textContent(), '$5.0k');
    assert.equal(await button.getAttribute('title'), 'A legendary closer, by all accounts. Steep signing bonus — but a closer like this pays for himself, right?');
    const before = await snapshot();
    assert.equal(before.cash, 5000);
    assert.equal(before.jeff, null);
    await button.click();
    const hired = await snapshot();
    assert.equal(before.cash - hired.cash, 5000);
    assert.equal(hired.cash, 0);
    assert.equal(hired.jeff.stage, 'bdr');
    assert.equal(await button.textContent(), '⬆️ Promote Jeff to AM');
    console.log('PASS  funding refreshes shortfall and affordability; hire spends exactly $5,000 and spawns Jeff');

    assert.equal(await button.isEnabled(), true);
    await button.click();
    const promoted = await snapshot();
    assert.equal(promoted.cash, 0);
    assert.equal(promoted.jeff.stage, 'am');
    assert.equal(await button.isVisible(), false);
    assert.deepEqual(errors, []);
    console.log('PASS  promotion at $0 remains free; zero page errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
