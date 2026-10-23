/* Hook-free: the Founder Lamp is a Spark Shop look on the CEO desk.
 * A bare office draws no shop shade. Wearing the lamp paints it.
 * Shown cash and the deal constants stay on the same purse.
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const ROOT = path.join(__dirname, '..', '..');

(async () => {
  const play = fs.readFileSync(path.join(ROOT, 'tycoon/play.html'), 'utf8');
  assert.match(play, /engCostScale:\s+1\.45/, 'engineer cost scale stays 1.45');
  assert.match(play, /featurePriceBase:\s+8/, 'feature price stays 8');
  assert.match(play, /ceoDeskRange:\s+2\.0/, 'CEO desk range stays 2.0');
  assert.doesNotMatch(play, /window\.__/, 'no test hook on the office');
  console.log('PASS deal constants unchanged');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errors = [];
  try {
    async function office(wear) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 880 } });
      page.on('pageerror', (error) => errors.push(String(error)));
      await page.addInitScript((seed) => {
        localStorage.setItem('startup-tycoon-v7', JSON.stringify({
          cash: 0,
          allTimeCash: 1,
          v: 7,
          savedAt: Date.now(),
          offlineRatePerSec: 0,
          ownedRooms: ['starter'],
        }));
        localStorage.setItem('tycoon:tipsEnabled', '0');
        if (seed.wear) {
          localStorage.setItem('eureka-progress', JSON.stringify({
            v: 1,
            games: {},
            career: {
              sparks: 80,
              owned: { 'lamp-founder': 1 },
              equipped: { lamp: 'lamp-founder' },
            },
          }));
        } else {
          localStorage.removeItem('eureka-progress');
        }
      }, { wear: wear });
      await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load' });
      await page.waitForSelector('canvas[data-engine]');
      await page.waitForFunction(() => {
        const n = parseInt(document.querySelector('#cash-val').textContent, 10);
        return n >= 100;
      });
      const shown = await page.evaluate(() => ({
        cash: parseInt(document.querySelector('#cash-val').textContent, 10),
        lamp: window.EurekaCosmetics && window.EurekaCosmetics.look().lamp,
      }));
      await page.addStyleTag({ content: 'body > *:not(canvas){visibility:hidden !important}' });
      await page.waitForTimeout(400);
      const png = await page.locator('canvas[data-engine]').screenshot({ type: 'png' });
      const count = await page.evaluate(async (url) => {
        const img = new Image();
        img.src = url;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          // Unlit shop shade #ffb24a. The capture keeps that hex.
          if (r >= 240 && g >= 160 && g <= 195 && b >= 55 && b <= 95 && r > g + 50) n++;
        }
        return { n: n, w: c.width, h: c.height };
      }, 'data:image/png;base64,' + png.toString('base64'));
      return { page: page, shown: shown, count: count };
    }

    const bare = await office(false);
    const worn = await office(true);
    console.log('bare', JSON.stringify(bare.count), 'look', bare.shown.lamp, 'cash', bare.shown.cash);
    console.log('worn', JSON.stringify(worn.count), 'look', worn.shown.lamp, 'cash', worn.shown.cash);

    assert.equal(bare.shown.lamp, null, 'bare office wears no lamp');
    assert.equal(worn.shown.lamp && worn.shown.lamp.id, 'lamp-founder', 'worn office reads the founder lamp');
    assert.equal(worn.shown.lamp.color, '#ffb24a', 'worn lamp keeps the shop shade');
    assert.equal(bare.count.n, 0, 'bare desk has no shop shade');
    assert.ok(worn.count.n >= 200, 'worn desk paints the shade (' + worn.count.n + ')');
    assert.ok(bare.shown.cash >= 100 && bare.shown.cash < 1000, 'bare cash stays an integer purse');
    assert.ok(Math.abs(worn.shown.cash - bare.shown.cash) < 25, 'wearing the lamp does not change the purse');
    assert.deepEqual(errors, [], 'zero page errors');
    console.log('PASS founder lamp ' + worn.count.n + ' shade pixels, cash ' + bare.shown.cash + ' / ' + worn.shown.cash);
    await bare.page.close();
    await worn.page.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
