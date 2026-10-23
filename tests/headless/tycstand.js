/* Hook-free: Hearth Shade tints the starter-room standing lamp.
 * A bare office keeps the brass cone in the corner.
 * Shown cash and the deal prices stay on the same numbers.
 * Ceiling pendants and the desk lamp are different slots.
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
  const lamp = play.slice(play.indexOf('// Standing lamp'), play.indexOf('// Standing lamp') + 2800);
  assert.match(play, /engCostScale:\s+1\.45/, 'engineer cost scale stays 1.45');
  assert.match(play, /featurePriceBase:\s+8/, 'feature price stays 8');
  assert.match(play, /ceoDeskRange:\s+2\.0/, 'CEO desk range stays 2.0');
  assert.match(play, /id: 'left', gx: -1, gz: 0, cost: 150/, 'engineering pod still costs 150');
  assert.match(lamp, /new THREE\.PointLight\(0xffdc8a, 0\.55, 9\)/, 'the corner light stays the same lamp');
  assert.match(lamp, /color: 0xf0d890, emissive: 0xf0c060, emissiveIntensity: 0\.25/, 'a bare shade is still the brass cone');
  assert.match(lamp, /name = 'corner-stand-rim'/, 'the shop rim is built with the corner lamp');
  assert.doesNotMatch(play, /lamp-founder|ceo-lamp|pendant-tide|room-pendant/, 'this slice does not add the desk lamp or the ceiling glass');
  assert.doesNotMatch(play, /window\.__/, 'no test hook on the office');
  console.log('PASS deal numbers and the bare shade stay put');

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
              owned: { 'stand-hearth': 1 },
              equipped: { stand: 'stand-hearth' },
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
        stand: window.EurekaCosmetics && window.EurekaCosmetics.look().stand,
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
          // Unlit shop rim #3ec6ff. The capture keeps that hex.
          if (r >= 40 && r <= 90 && g >= 175 && g <= 225 && b >= 230 && b > g && b > r + 140) n++;
        }
        return n;
      }, 'data:image/png;base64,' + png.toString('base64'));
      return { page: page, shown: shown, count: count };
    }

    const bare = await office(false);
    const worn = await office(true);
    console.log('bare', bare.count, 'worn', worn.count);
    console.log('cash', bare.shown.cash, worn.shown.cash, 'look', worn.shown.stand && worn.shown.stand.id);

    assert.equal(bare.shown.stand, null, 'bare office wears no hearth shade');
    assert.equal(worn.shown.stand && worn.shown.stand.id, 'stand-hearth', 'worn office reads hearth shade');
    assert.equal(worn.shown.stand.accent, '#3ec6ff', 'worn shade keeps the shop accent');
    assert.equal(bare.count, 0, 'bare corner has no shop rim');
    assert.ok(worn.count >= 20, 'the corner lamp shows the rim (' + worn.count + ')');
    assert.equal(bare.shown.cash, worn.shown.cash, 'wearing the shade does not change the purse');
    assert.ok(bare.shown.cash >= 100 && bare.shown.cash < 1000, 'cash stays an integer purse');
    assert.deepEqual(errors, [], 'zero page errors');
    console.log('PASS hearth shade ' + worn.count + ' rim pixels, cash ' + bare.shown.cash);
    await bare.page.close();
    await worn.page.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
