/* Snip: one tap, one cut. Pause holds the fuse. Restart deals it again. */
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
      await page.goto(BASE + '/#snip', { waitUntil: 'load' });
      await page.waitForSelector('#view-snip.active #snip-canvas');
      ok((await page.locator('#snip-score').innerText()).trim() === '0', width + ' opens at zero');
      const hit = await page.evaluate(() => {
        const el = document.getElementById('snip-pause');
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return {
          id: top && top.id,
          h: Math.round(r.height),
          on: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
        };
      });
      ok(hit.id === 'snip-pause' && hit.h >= 44 && hit.on,
        width + ' pause is on screen (' + hit.id + ', ' + hit.h + 'px)');
      await page.locator('#snip-pause').click();
      ok((await page.locator('#snip-state').innerText()).trim() === 'Paused', width + ' pause holds the fuse');
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await page.waitForTimeout(400);
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      ok((await page.locator('#snip-pause').innerText()).trim() === 'Resume', width + ' focus leaves the chosen pause');
      await page.locator('#snip-pause').click();
      await page.keyboard.press(' ');
      await page.waitForSelector('#snip-overlay', { state: 'visible' });
      ok(/FUSE/.test(await page.locator('#snip-overlay').innerText()), width + ' a miss ends the fuse');
      await page.locator('#snip-overlay').click();
      await page.waitForFunction(() => document.getElementById('snip-overlay').style.display === 'none');
      ok((await page.locator('#snip-score').innerText()).trim() === '0', width + ' a tap deals a fresh fuse');
      await page.waitForFunction(() => {
        const c = document.getElementById('snip-canvas');
        const ctx = c.getContext('2d');
        const dpr = c.width / 480;
        const y = Math.round(140 * dpr);
        const row = ctx.getImageData(0, y, c.width, 1).data;
        let min = c.width;
        let max = 0;
        let n = 0;
        for (let i = 0; i < c.width; i++) {
          const o = i * 4;
          if (row[o] > 245 && row[o + 1] > 140 && row[o + 2] < 80) {
            n += 1;
            if (i < min) min = i;
            if (i > max) max = i;
          }
        }
        if (n < 4) return false;
        const mid = ((min + max) / 2) / dpr;
        return mid > 200 && mid < 236;
      }, null, { timeout: 8000 });
      await page.keyboard.press(' ');
      const cutPaint = await page.evaluate(() => {
        const c = document.getElementById('snip-canvas');
        const ctx = c.getContext('2d');
        const dpr = c.width / 480;
        const row = ctx.getImageData(Math.round(160 * dpr), Math.round(70 * dpr), Math.round(140 * dpr), Math.round(36 * dpr)).data;
        let n = 0;
        for (let i = 0; i < row.length; i += 4) {
          if (row[i] > 240 && row[i + 1] > 200 && row[i + 2] > 100 && row[i + 2] < 180) n += 1;
        }
        return n;
      });
      await page.waitForFunction(() => document.getElementById('snip-score').textContent.trim() === '1', null, { timeout: 4000 });
      const scored = (await page.locator('#snip-score').innerText()).trim();
      const overlay = await page.locator('#snip-overlay').evaluate((el) => el.style.display);
      ok(scored === '1' && overlay === 'none' && cutPaint > 8,
        width + ' a cut in the gold paints CUT (' + scored + ', ' + cutPaint + ')');
      await page.close();
    }
  } finally {
    await browser.close();
  }
  ok(errs.length === 0, 'no page errors' + (errs.length ? ' — ' + errs[0] : ''));
  console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
