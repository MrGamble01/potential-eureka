/* Hook-free: Fair Bulbs tint the starter-room string lights.
 * A bare office keeps the gold bulbs on the north wall.
 * Shown cash and the deal prices stay on the same numbers.
 * The corner lamp and the whiteboard stay on their own colors.
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
  const lights = play.slice(play.indexOf('// String lights along the north wall'), play.indexOf('// String lights along the north wall') + 2500);
  assert.match(play, /engCostScale:\s+1\.45/, 'engineer cost scale stays 1.45');
  assert.match(play, /featurePriceBase:\s+8/, 'feature price stays 8');
  assert.match(play, /ceoDeskRange:\s+2\.0/, 'CEO desk range stays 2.0');
  assert.match(play, /id: 'left', gx: -1, gz: 0, cost: 150/, 'engineering pod still costs 150');
  assert.match(play, /color: 0xf0d890, emissive: 0xf0c060, emissiveIntensity: 0\.25/, 'the corner shade stays brass');
  assert.match(play, /color: 0xf8f8f5/, 'the starter whiteboard stays white');
  assert.match(lights, /color: 0xffdd66, emissive: 0xffcc44, emissiveIntensity: 0\.75/, 'a bare string is still the gold bulbs');
  assert.match(lights, /-7 \+ i \* 1\.27, 2\.85 \+ Math\.sin\(i \* 0\.9\) \* 0\.12, -7\.6/, 'the bulbs stay on the north wall');
  assert.match(lights, /name = 'string-light-glass'/, 'the shop glass is built with the string');
  assert.doesNotMatch(play, /stand-hearth|board-ink|lamp-founder|pendant-tide|ceo-lamp/, 'this slice does not add the other lamp or board looks');
  assert.doesNotMatch(play, /window\.__/, 'no test hook on the office');
  console.log('PASS deal numbers and the bare string stay put');

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
              owned: { 'festoon-fair': 1 },
              equipped: { festoon: 'festoon-fair' },
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
        festoon: window.EurekaCosmetics && window.EurekaCosmetics.look().festoon,
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
          // Unlit shop glass #cc66ff. The capture keeps that hex.
          if (r >= 185 && r <= 225 && g >= 80 && g <= 125 && b >= 235 && b > r + 20 && b > g + 100) n++;
        }
        return n;
      }, 'data:image/png;base64,' + png.toString('base64'));
      return { page: page, shown: shown, count: count };
    }

    const bare = await office(false);
    const worn = await office(true);
    console.log('bare', bare.count, 'worn', worn.count);
    console.log('cash', bare.shown.cash, worn.shown.cash, 'look', worn.shown.festoon && worn.shown.festoon.id);

    assert.equal(bare.shown.festoon, null, 'bare office wears no fair bulbs');
    assert.equal(worn.shown.festoon && worn.shown.festoon.id, 'festoon-fair', 'worn office reads fair bulbs');
    assert.equal(worn.shown.festoon.accent, '#cc66ff', 'worn string keeps the shop accent');
    assert.equal(bare.count, 0, 'bare north wall has no shop glass');
    assert.ok(worn.count >= 20, 'the string shows the glass (' + worn.count + ')');
    assert.equal(bare.shown.cash, worn.shown.cash, 'wearing the string does not change the purse');
    assert.ok(bare.shown.cash >= 100 && bare.shown.cash < 1000, 'cash stays an integer purse');
    assert.deepEqual(errors, [], 'zero page errors');
    console.log('PASS fair bulbs ' + worn.count + ' glass pixels, cash ' + bare.shown.cash);
    await bare.page.close();
    await worn.page.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
