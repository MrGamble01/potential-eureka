/* Clasp: one tap shuts the needle. A miss paints MISS. A shut in the gold scores. */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];
  try {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({
        viewport: { width, height: width === 390 ? 844 : 800 },
        isMobile: width === 390,
        hasTouch: width === 390,
      });
      page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
      await page.goto(BASE + '/#clasp', { waitUntil: 'load' });
      await page.waitForSelector('#view-clasp.active #clasp-canvas');
      ok((await page.locator('#clasp-score').innerText()).trim() === '0', width + ' opens at zero');
      const hit = await page.evaluate(() => {
        const el = document.getElementById('clasp-pause');
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return {
          id: top && top.id,
          h: Math.round(r.height),
          on: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
        };
      });
      ok(hit.id === 'clasp-pause' && hit.h >= 44 && hit.on,
        width + ' pause is on screen (' + hit.id + ', ' + hit.h + 'px)');
      await page.locator('#clasp-pause').click();
      ok((await page.locator('#clasp-state').innerText()).trim() === 'Paused', width + ' pause holds the needle');
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await page.waitForTimeout(400);
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      ok((await page.locator('#clasp-pause').innerText()).trim() === 'Resume', width + ' focus leaves the chosen pause');
      await page.locator('#clasp-pause').click();
      await page.keyboard.press(' ');
      await page.waitForSelector('#clasp-overlay', { state: 'visible' });
      const missPaint = await page.evaluate(() => {
        const c = document.getElementById('clasp-canvas');
        const ctx = c.getContext('2d');
        const dpr = c.width / 480;
        const x = Math.round(200 * dpr);
        const y = Math.round(120 * dpr);
        const w = Math.round(80 * dpr);
        const h = Math.round(36 * dpr);
        const row = ctx.getImageData(x, y, w, h).data;
        let n = 0;
        for (let i = 0; i < row.length; i += 4) {
          if (row[i] > 220 && row[i + 1] > 210 && row[i + 2] > 200) n += 1;
        }
        return n;
      });
      ok(/MISS/.test(await page.locator('#clasp-overlay').innerText()) && missPaint > 8,
        width + ' a miss is painted on the canvas (' + missPaint + ')');
      await page.locator('#clasp-overlay').click();
      await page.waitForFunction(() => document.getElementById('clasp-overlay').style.display === 'none');
      ok((await page.locator('#clasp-score').innerText()).trim() === '0', width + ' a tap deals a fresh sweep');
      await page.waitForFunction(() => {
        const c = document.getElementById('clasp-canvas');
        const ctx = c.getContext('2d');
        const dpr = c.width / 480;
        const img = ctx.getImageData(0, 0, c.width, c.height).data;
        const px = 240 * dpr;
        const py = 210 * dpr;
        let best = -1;
        let bx = 0;
        let by = 0;
        let n = 0;
        for (let y = 0; y < c.height; y += 2) {
          for (let x = 0; x < c.width; x += 2) {
            const o = (y * c.width + x) * 4;
            if (img[o] > 200 && img[o + 1] > 190 && img[o + 2] > 170) {
              n += 1;
              const dx = x - px;
              const dy = py - y;
              const r2 = dx * dx + dy * dy;
              if (r2 > best) {
                best = r2;
                bx = x;
                by = y;
              }
            }
          }
        }
        if (n < 12 || best < (90 * dpr) * (90 * dpr)) return false;
        const ang = Math.atan2((py - by) / dpr, (bx - px) / dpr);
        return ang > 1.50 && ang < 1.64;
      }, null, { timeout: 8000 });
      await page.keyboard.press(' ');
      await page.waitForFunction(() => document.getElementById('clasp-score').textContent.trim() === '1', null, { timeout: 4000 });
      const scored = (await page.locator('#clasp-score').innerText()).trim();
      const overlay = await page.locator('#clasp-overlay').evaluate((el) => el.style.display);
      ok(scored === '1' && overlay === 'none', width + ' a shut in the gold scores (' + scored + ')');
      await page.close();
    }
  } finally {
    await browser.close();
  }
  ok(errs.length === 0, 'no page errors' + (errs.length ? ' - ' + errs[0] : ''));
  console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
