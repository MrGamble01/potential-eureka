/* Camera input is safe before DOMContentLoaded and still works after init. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 900, height: 900 }, { width: 1400, height: 900 }]) {
      for (const early of [false, true]) {
        const context = await browser.newContext({ viewport,
          isMobile: viewport.width < 1000, hasTouch: viewport.width < 1000 });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(String(error)));
        if (early) await page.route('**/hearthvale.html', async route => {
          const response = await route.fetch();
          // Dispatch browser events after listeners are installed but before
          // DOMContentLoaded. No game internals or production hooks are exposed.
          const body = (await response.text()).replace('</body>', `<script>
            document.documentElement.dataset.inputReadyState = document.readyState;
            const canvas = document.getElementById('game');
            canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 100, clientY: 100 }));
            canvas.dispatchEvent(new WheelEvent('wheel', { clientX: 100, clientY: 100, deltaY: -120, cancelable: true }));
          </script></body>`);
          await route.fulfill({ response, body });
        });
        await page.goto(BASE + '/hearthvale.html');
        if (early) assert.equal(await page.locator('html').getAttribute('data-input-ready-state'), 'loading');
        assert.deepEqual(errors, [], 'startup input must not throw');
        await page.click('#welcome-close');
        const box = await page.locator('#game').boundingBox();
        const x = box.x + box.width / 2, y = box.y + box.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 60, y + 40, { steps: 5 });
        assert(await page.locator('#game').evaluate(el => el.classList.contains('panning')), 'drag still pans');
        await page.mouse.up();
        await page.mouse.wheel(0, -120);
        await page.waitForTimeout(100);
        assert.deepEqual(errors, [], 'drag and wheel must not throw');
        console.log(`PASS ${viewport.width}: ${early ? 'pre-init' : 'normal'} input, load, drag, wheel`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
