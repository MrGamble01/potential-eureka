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
      await page.goto(BASE + '/#stitch', { waitUntil: 'load' });
      await page.waitForSelector('#view-stitch.active #stitch-canvas');
      ok((await page.locator('#stitch-score').innerText()).trim() === '0', width + ' opens at zero');
      const hit = await page.evaluate(() => {
        const el = document.getElementById('stitch-pause');
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return {
          id: top && top.id,
          h: Math.round(r.height),
          on: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
        };
      });
      ok(hit.id === 'stitch-pause' && hit.h >= 44 && hit.on,
        width + ' pause is on screen (' + hit.id + ', ' + hit.h + 'px)');
      await page.locator('#stitch-pause').click();
      ok((await page.locator('#stitch-state').innerText()).trim() === 'Paused', width + ' pause holds the thread');
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await page.waitForTimeout(400);
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      ok((await page.locator('#stitch-pause').innerText()).trim() === 'Resume', width + ' focus leaves the chosen pause');
      await page.locator('#stitch-pause').click();
      await page.keyboard.press('r');
      await page.keyboard.press(' ');
      await page.waitForSelector('#stitch-overlay', { state: 'visible' });
      const missPaint = await page.evaluate(() => {
        const c = document.getElementById('stitch-canvas');
        const ctx = c.getContext('2d');
        const dpr = c.width / 480;
        const row = ctx.getImageData(Math.round(190 * dpr), Math.round(120 * dpr), Math.round(100 * dpr), Math.round(36 * dpr)).data;
        let n = 0;
        for (let i = 0; i < row.length; i += 4) {
          if (row[i] > 220 && row[i + 1] > 210 && row[i + 2] > 200) n += 1;
        }
        return n;
      });
      const earlyState = (await page.locator('#stitch-state').innerText()).trim();
      ok(/EARLY/.test(await page.locator('#stitch-overlay').innerText()) && earlyState === 'EARLY' && missPaint > 8,
        width + ' an early sew paints EARLY (' + missPaint + ', ' + earlyState + ')');
      await page.locator('#stitch-overlay').click();
      await page.waitForFunction(() => document.getElementById('stitch-overlay').style.display === 'none');
      ok((await page.locator('#stitch-score').innerText()).trim() === '0', width + ' a tap deals a fresh run');
      await page.waitForFunction(() => {
        const c = document.getElementById('stitch-canvas');
        const ctx = c.getContext('2d');
        const dpr = c.width / 480;
        const img = ctx.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        let sum = 0;
        for (let py = 0; py < c.height; py += 2) {
          for (let px = 0; px < c.width; px += 2) {
            const o = (py * c.width + px) * 4;
            if (img[o] > 230 && img[o + 1] > 90 && img[o + 1] < 170 && img[o + 2] > 110 && img[o + 2] < 190) {
              n += 1;
              sum += px;
            }
          }
        }
        if (n < 8) return false;
        const tip = (sum / n) / dpr;
        return tip > 214 && tip < 266;
      }, null, { timeout: 8000 });
      await page.keyboard.press(' ');
      await page.waitForFunction(() => document.getElementById('stitch-score').textContent.trim() === '1', null, { timeout: 4000 });
      const scored = (await page.locator('#stitch-score').innerText()).trim();
      const overlay = await page.locator('#stitch-overlay').evaluate((el) => el.style.display);
      ok(scored === '1' && overlay === 'none', width + ' a sew in the gold scores (' + scored + ')');
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
