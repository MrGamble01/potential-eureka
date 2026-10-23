const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
const BODY = fs.readFileSync(path.join(ROOT, '404.html'));
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    await page.route('**/snip', async (route) => {
      if (route.request().resourceType() !== 'document') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 404,
        contentType: 'text/html; charset=utf-8',
        body: BODY,
      });
    });
    await page.goto(BASE + '/snip', { waitUntil: 'commit', timeout: 20000 });
    await page.waitForURL(/#snip/, { timeout: 15000 });
    await page.waitForSelector('#view-snip.active #snip-canvas', { timeout: 15000 });
    ok(/Snip/.test(await page.title()), 'a missing /snip opens Snip (' + page.url() + ')');
    ok(errs.length === 0, 'no page errors' + (errs[0] ? ' — ' + errs[0] : ''));
  } finally {
    await browser.close();
  }
  console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
